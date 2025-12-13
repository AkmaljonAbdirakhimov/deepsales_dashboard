"use client";

import { useEffect, useState, useMemo } from 'react';
import { Manager, HistoryPoint } from '@/types';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import { clsx } from 'clsx';
import { Filter, Calendar, User, Tag, Users, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { api, AudioFile, VolumeDataPoint } from '@/services/api';
import { Category } from '@/services/categoryService';

// Helper function to get criteria list from manager data
// Extracts unique criteria names from managers' criteria_scores for a given category
// Orders criteria by database id order (same as database)
const getCategoryCriteria = (managers: Manager[], category: string, categories: Category[]): string[] => {
    // First, get criteria from database in the correct order (by id)
    const dbCategory = categories.find(cat => cat.name === category);
    const dbCriteriaOrder: string[] = [];
    if (dbCategory && dbCategory.criteria) {
        // Criteria are already ordered by id from the backend
        dbCriteriaOrder.push(...dbCategory.criteria.map(c => c.name));
    }

    // Get all criteria that exist in manager data
    const criteriaSet = new Set<string>();
    managers.forEach(op => {
        const criteriaScores = op.criteria_scores?.[category] || {};
        Object.keys(criteriaScores).forEach(criterion => {
            criteriaSet.add(criterion);
        });
    });

    // Return criteria in database order, with any additional criteria from manager data appended
    const result: string[] = [];

    // Add criteria in database order
    dbCriteriaOrder.forEach(criterion => {
        if (criteriaSet.has(criterion)) {
            result.push(criterion);
            criteriaSet.delete(criterion);
        }
    });

    // Add any remaining criteria that weren't in the database (shouldn't happen, but just in case)
    criteriaSet.forEach(criterion => {
        result.push(criterion);
    });

    return result;
};

// Updated Palette
const COLORS = ['#4338ca', '#059669']; // Indigo-700, Emerald-600
const MANAGER_COLORS = [
    '#2563eb', // Blue
    '#db2777', // Pink
    '#9333ea', // Purple
    '#d97706', // Amber
    '#059669', // Emerald
    '#dc2626', // Red
    '#0891b2', // Cyan
    '#4f46e5', // Indigo
];

// Helper function to format tag display names
// Formats tag names dynamically, replacing underscores and capitalizing
const formatTagDisplayName = (tag: string): string => {
    if (!tag) return 'Boshqa';

    // Replace underscores with spaces and capitalize first letter of each word
    return tag
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

// Helper function to get category display name from database
// Maps category keys to actual category names from the database
const getCategoryDisplayName = (categoryKey: string, categories: Category[], managers: Manager[]): string => {
    // Get all unique category keys from managers' category_scores
    const categoryKeys = new Set<string>();
    managers.forEach(op => {
        if (op.category_scores) {
            Object.keys(op.category_scores).forEach(key => categoryKeys.add(key));
        }
    });

    // Try to find a database category that matches the categoryKey directly
    let dbCategory = categories.find(cat =>
        cat.name.toLowerCase() === categoryKey.toLowerCase()
    );

    if (dbCategory) {
        return dbCategory.name;
    }

    // Try to match with category keys from managers
    // The categoryKey might be used in category_scores, so check if any manager has this key
    if (categoryKeys.has(categoryKey)) {
        // Try to find a database category that matches any of the keys from managers
        for (const key of categoryKeys) {
            const matchingCategory = categories.find(cat =>
                cat.name.toLowerCase() === key.toLowerCase()
            );
            if (matchingCategory && key === categoryKey) {
                return matchingCategory.name;
            }
        }
    }

    // Try fuzzy matching - check if any database category name contains the key or vice versa
    for (const cat of categories) {
        if (cat.name.toLowerCase().includes(categoryKey.toLowerCase()) ||
            categoryKey.toLowerCase().includes(cat.name.toLowerCase())) {
            return cat.name;
        }
    }

    // Fallback: return the key itself capitalized
    return categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1);
};

// Custom Tooltip for Pie Charts
const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0];
        return (
            <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                <p className="text-sm font-medium text-gray-900">
                    {data.name}: <span className="font-bold text-indigo-600">{data.value}%</span>
                </p>
            </div>
        );
    }
    return null;
};

// Custom Tooltip for Stacked Bar Chart - Shows only numbers
const CustomStackedBarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                {payload.map((entry: any, index: number) => (
                    <p key={index} className="text-sm font-bold" style={{ color: entry.color }}>
                        {entry.value}%
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

// Custom Tooltip for Manager Criteria Chart - Shows manager names with values
const CustomManagerCriteriaTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                <p className="text-sm font-semibold text-gray-900 mb-2">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <p key={index} className="text-sm font-medium" style={{ color: entry.color }}>
                        {entry.name}: <span className="font-bold">{entry.value}%</span>
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

// Standard tooltip content style for all charts
const tooltipContentStyle = {
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '10px 12px',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -1px rgb(0 0 0 / 0.06)',
    color: '#111827', // Dark gray text
    fontSize: '14px',
    fontWeight: '500'
};



export default function Statistics() {
    // Default period constant
    const DEFAULT_PERIOD = '7d';

    // Helper function to convert period to backend-compatible format
    const convertPeriodToBackendFormat = (period: string): { period: string; startDate?: string; endDate?: string } => {
        const today = new Date();

        if (period === 'last_month') {
            const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const end = new Date(today.getFullYear(), today.getMonth(), 0);
            return {
                period: 'custom',
                startDate: start.toISOString().split('T')[0],
                endDate: end.toISOString().split('T')[0]
            };
        }

        if (period === 'this_month') {
            const start = new Date(today.getFullYear(), today.getMonth(), 1);
            const end = new Date(today);
            return {
                period: 'custom',
                startDate: start.toISOString().split('T')[0],
                endDate: end.toISOString().split('T')[0]
            };
        }

        if (period === 'this_year') {
            const start = new Date(today.getFullYear(), 0, 1);
            const end = new Date(today);
            return {
                period: 'custom',
                startDate: start.toISOString().split('T')[0],
                endDate: end.toISOString().split('T')[0]
            };
        }

        return { period };
    };

    const [managers, setManagers] = useState<Manager[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [processingFiles, setProcessingFiles] = useState<AudioFile[]>([]);
    const [completedFiles, setCompletedFiles] = useState<AudioFile[]>([]);
    const [volumeData, setVolumeData] = useState<VolumeDataPoint[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);

    // Filter States
    const [filterPeriod, setFilterPeriod] = useState(DEFAULT_PERIOD);
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [filterManager, setFilterManager] = useState('all');
    const [filterCategory, setFilterCategory] = useState('');

    // Comparison States
    const [comparisonMode, setComparisonMode] = useState(false);
    const [compareManager1, setCompareManager1] = useState<string>('');
    const [compareManager2, setCompareManager2] = useState<string>('');

    // Expanded cards state for AI suggestions
    const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());

    // Toggle card expansion
    const toggleCard = (managerId: number) => {
        setExpandedCards(prev => {
            const newSet = new Set(prev);
            if (newSet.has(managerId)) {
                newSet.delete(managerId);
            } else {
                newSet.add(managerId);
            }
            return newSet;
        });
    };

    // Expanded complaint tags state
    const [expandedComplaintTags, setExpandedComplaintTags] = useState<Set<string>>(new Set());

    // Toggle complaint tag expansion
    const toggleComplaintTag = (tag: string) => {
        setExpandedComplaintTags(prev => {
            const newSet = new Set(prev);
            if (newSet.has(tag)) {
                newSet.delete(tag);
            } else {
                newSet.add(tag);
            }
            return newSet;
        });
    };

    // Expanded mistake tags state
    const [expandedMistakeTags, setExpandedMistakeTags] = useState<Set<string>>(new Set());

    // Toggle mistake tag expansion
    const toggleMistakeTag = (tag: string) => {
        setExpandedMistakeTags(prev => {
            const newSet = new Set(prev);
            if (newSet.has(tag)) {
                newSet.delete(tag);
            } else {
                newSet.add(tag);
            }
            return newSet;
        });
    };

    // Expanded recommendation tags state
    const [expandedRecommendationTags, setExpandedRecommendationTags] = useState<Set<string>>(new Set());

    // Toggle recommendation tag expansion
    const toggleRecommendationTag = (tag: string) => {
        setExpandedRecommendationTags(prev => {
            const newSet = new Set(prev);
            if (newSet.has(tag)) {
                newSet.delete(tag);
            } else {
                newSet.add(tag);
            }
            return newSet;
        });
    };

    // Load categories from database
    useEffect(() => {
        const loadCategories = async () => {
            try {
                const categoriesData = await api.getCategories();
                setCategories(categoriesData);
                // Set filterCategory to first category if not set or if current value doesn't exist in categories
                if (categoriesData.length > 0) {
                    setFilterCategory(prev => {
                        // If no previous value or previous value doesn't exist in new categories, use first category
                        if (!prev || !categoriesData.find(cat => cat.name === prev)) {
                            return categoriesData[0].name;
                        }
                        return prev;
                    });
                }
            } catch (err) {
                console.error('Error loading categories:', err);
                // Set empty array on error
                setCategories([]);
            }
        };

        loadCategories();
    }, []);

    // Check for processing files and completed files
    useEffect(() => {
        const checkFiles = async () => {
            try {
                const files = await api.getFiles();
                const processing = files.filter(
                    f => f.status === 'processing' || f.status === 'pending'
                );
                const completed = files.filter(
                    f => f.status === 'completed' && f.transcription_id
                ).slice(0, 10); // Show last 10 completed files
                setProcessingFiles(processing);
                setCompletedFiles(completed);
            } catch (err) {
                console.error('Error checking files:', err);
            }
        };

        // Check immediately
        checkFiles();

        // Poll every 5 seconds
        const intervalId = setInterval(checkFiles, 5000);

        return () => {
            clearInterval(intervalId);
        };
    }, []);

    // Load managers data from backend
    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                setError(null);

                let period: string | undefined;
                let startDate = customStartDate;
                let endDate = customEndDate;

                // Map frontend period to backend period
                if (filterPeriod === 'custom' && customStartDate && customEndDate) {
                    period = 'custom';
                } else if (filterPeriod === 'all') {
                    period = DEFAULT_PERIOD; // Use default period
                } else {
                    // Convert special periods (last_month, this_month, this_year) to custom dates
                    const converted = convertPeriodToBackendFormat(filterPeriod);
                    period = converted.period;
                    if (converted.startDate && converted.endDate) {
                        startDate = converted.startDate;
                        endDate = converted.endDate;
                    }
                }

                // Load all managers and stats in parallel
                const [allManagers, statsData] = await Promise.all([
                    api.getManagers(), // Get all created managers
                    api.getManagersStats(period, startDate, endDate) // Get stats for managers with analyses
                ]);

                // Create a map of stats by manager ID
                const statsMap = new Map(statsData.map(stat => [stat.id, stat]));

                // Merge all managers with their stats (if available)
                const mergedManagers = allManagers.map(manager => {
                    const stats = statsMap.get(manager.id);
                    if (stats) {
                        // Manager has stats, use them
                        return stats;
                    } else {
                        // Manager exists but has no stats yet, return manager with empty stats
                        return {
                            id: manager.id,
                            name: manager.name,
                            total_audios: 0,
                            average_score: 0,
                            category_scores: {},
                            category_counts: {},
                            criteria_scores: {},
                            talk_ratio: { manager: 0, customer: 0 },
                            average_duration: 0,
                            category_mistakes: {},
                            client_complaints: {}
                        };
                    }
                });

                setManagers(mergedManagers);
            } catch (err) {
                console.error('Error loading managers:', err);
                setError(err instanceof Error ? err.message : 'Failed to load manager data');
                // Fallback to empty array or static data if needed
                setManagers([]);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [filterPeriod, customStartDate, customEndDate, processingFiles.length]);


    // Load volume data
    useEffect(() => {
        const loadVolumeData = async () => {
            try {
                let period: string | undefined = filterPeriod;
                let startDate = customStartDate;
                let endDate = customEndDate;

                if (filterPeriod === 'custom' && customStartDate && customEndDate) {
                    period = 'custom';
                } else if (filterPeriod === 'all') {
                    period = DEFAULT_PERIOD; // Use default period
                } else {
                    // Convert special periods (last_month, this_month, this_year) to custom dates
                    const converted = convertPeriodToBackendFormat(filterPeriod);
                    period = converted.period;
                    if (converted.startDate && converted.endDate) {
                        startDate = converted.startDate;
                        endDate = converted.endDate;
                    }
                }

                // Get manager IDs if filtering by specific manager
                const managerIds = filterManager !== 'all'
                    ? managers.filter(op => op.name === filterManager).map(op => op.id)
                    : managers.map(op => op.id);

                const volumeDataResponse = await api.getVolumeStats(period, startDate, endDate, managerIds.length > 0 ? managerIds : undefined);
                setVolumeData(volumeDataResponse);
            } catch (err) {
                console.error('Error loading volume data:', err);
                setVolumeData([]);
            }
        };

        loadVolumeData();
    }, [filterPeriod, customStartDate, customEndDate, filterManager, managers]);


    // Filter Logic
    const filteredManagers = managers.filter(op => {
        if (filterManager !== 'all' && op.name !== filterManager) return false;
        return true;
    });

    // Helper to get score based on category
    // Returns the category score for the selected filter category (sales, support, billing, technical)
    // This represents the average performance score for that specific category
    // Example: For "sales" category, returns the sales category score (e.g., 92% for Anvar, 68% for Malika)
    const getScore = (op: Manager) => {
        return op.category_scores?.[filterCategory] || 0;
    };

    // Get managers for comparison
    const getComparisonManagers = () => {
        if (comparisonMode && compareManager1 && compareManager2) {
            const op1 = managers.find(o => o.name === compareManager1);
            const op2 = managers.find(o => o.name === compareManager2);
            return op1 && op2 ? [op1, op2] : null;
        }
        return null;
    };

    const comparisonOps = getComparisonManagers();
    const isComparisonMode = comparisonMode && compareManager1 && compareManager2;

    // Import formatDuration from utils
    // Note: Using a custom format for this page (mins secs), but could use utils/dateTime formatDuration
    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    };

    // Prepare Criteria Data
    const { teamCriteriaData, managerCriteriaData } = useMemo(() => {
        const criteriaList = getCategoryCriteria(filteredManagers, filterCategory, categories);

        // Filter managers who have actual analyses for this category (category_counts > 0)
        const managersWithAnalyses = filteredManagers.filter(op => (op.category_counts?.[filterCategory] || 0) > 0);

        // Team Data
        const teamData = criteriaList.map(criterion => {
            const totalScore = managersWithAnalyses.reduce((acc, op) => {
                return acc + (op.criteria_scores?.[filterCategory]?.[criterion] || 0);
            }, 0);
            const avgScore = managersWithAnalyses.length > 0 ? Math.round(totalScore / managersWithAnalyses.length) : 0;
            return { criterion, score: avgScore };
        });

        // Manager Data (Grouped)
        const opData = criteriaList.map(criterion => {
            const dataPoint: any = { criterion };
            filteredManagers.forEach(op => {
                dataPoint[op.name] = op.criteria_scores?.[filterCategory]?.[criterion] || 0;
            });
            return dataPoint;
        });

        return { teamCriteriaData: teamData, managerCriteriaData: opData };
    }, [filterCategory, filteredManagers]);

    // Helper to generate dates for period
    const getDatesForPeriod = (period: string) => {
        const dates = [];
        const today = new Date();

        if (period === 'today') {
            dates.push(today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            return dates;
        }

        if (period === 'custom') {
            if (!customStartDate || !customEndDate) return [];
            // Let's treat them as local dates to avoid off-by-one errors due to timezone.
            const startParts = customStartDate.split('-').map(Number);
            const endParts = customEndDate.split('-').map(Number);
            const startDate = new Date(startParts[0], startParts[1] - 1, startParts[2]);
            const endDate = new Date(endParts[0], endParts[1] - 1, endParts[2]);

            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                dates.push(new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            }
            return dates;
        }

        if (period === 'last_month') {
            const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const end = new Date(today.getFullYear(), today.getMonth(), 0);
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                dates.push(new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            }
            return dates;
        }

        let days = 7;
        if (period === '7d') days = 7;
        else if (period === '30d') days = 30;
        else if (period === 'this_month') days = today.getDate();
        else if (period === 'this_year') {
            const start = new Date(today.getFullYear(), 0, 1);
            const diff = today.getTime() - start.getTime();
            days = Math.ceil(diff / (1000 * 3600 * 24));
        }
        else if (period === 'all') days = 90; // Limit to 90 for demo

        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            dates.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        }
        return dates;
    };

    // Prepare Volume Data (Real Data from API)
    const { teamVolumeData, managerVolumeData } = useMemo(() => {
        if (!volumeData || volumeData.length === 0) {
            return {
                teamVolumeData: [],
                managerVolumeData: []
            };
        }

        // Format dates to match the expected format (e.g., "Dec 3")
        const formattedData = volumeData.map(item => {
            const date = new Date(item.date);
            const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            const dayData: any = { date: formattedDate };
            let totalCount = 0;

            // Add manager-specific counts
            filteredManagers.forEach(op => {
                const count = item[op.name] || 0;
                dayData[op.name] = count;
                totalCount += typeof count === 'number' ? count : parseInt(String(count), 10) || 0;
            });

            dayData.total = totalCount;
            return dayData;
        });

        return {
            teamVolumeData: formattedData.map(d => ({ date: d.date, count: d.total })),
            managerVolumeData: formattedData
        };
    }, [volumeData, filteredManagers]);

    // Prepare Duration Data
    const { teamDurationData, managerDurationData } = useMemo(() => {
        const selectedCatDisplay = filterCategory.charAt(0).toUpperCase() + filterCategory.slice(1);
        const categories = [selectedCatDisplay];

        // Filter managers who have actual analyses for this category (category_counts > 0)
        const managersWithAnalyses = filteredManagers.filter(op => (op.category_counts?.[filterCategory] || 0) > 0);

        // Team Duration (Calculate average from real manager data)
        const totalDuration = managersWithAnalyses.reduce((sum, op) => sum + (op.average_duration || 0), 0);
        const avgDuration = managersWithAnalyses.length > 0 ? Math.round(totalDuration / managersWithAnalyses.length) : 0;

        const teamDur = categories.map(cat => ({
            category: cat,
            duration: avgDuration
        }));

        // Manager Duration (From real data)
        const opDur = filteredManagers.map(op => ({
            name: op.name,
            duration: op.average_duration || 0
        }));

        return { teamDurationData: teamDur, managerDurationData: opDur };
    }, [filterCategory, filteredManagers]);

    // Prepare Mistakes Data
    const { teamMistakesData, managerMistakesData } = useMemo(() => {
        // Helper function to extract count, recommendation, and tag from mistake data
        const extractMistakeInfo = (mistakeData: number | { count: number; recommendation?: string; tag?: string }): { count: number; recommendation: string; tag: string } => {
            if (typeof mistakeData === 'number') {
                return { count: mistakeData, recommendation: '', tag: 'other' };
            }
            return {
                count: mistakeData.count || 0,
                recommendation: mistakeData.recommendation || '',
                tag: mistakeData.tag || 'other'
            };
        };

        // Team Mistakes - Aggregate by tag, but keep mistake texts
        const teamMistakesByTag: Record<string, { count: number; mistakes: Array<{ text: string; count: number }> }> = {};
        filteredManagers.forEach(op => {
            const opMistakes = op.category_mistakes?.[filterCategory] || {};
            Object.entries(opMistakes).forEach(([mistakeText, mistakeData]) => {
                const info = extractMistakeInfo(mistakeData as any);
                const tag = info.tag || 'other';

                if (!teamMistakesByTag[tag]) {
                    teamMistakesByTag[tag] = {
                        count: 0,
                        mistakes: []
                    };
                }

                // Add to total count for this tag
                teamMistakesByTag[tag].count += info.count;

                // Add or update mistake text entry
                const existingMistake = teamMistakesByTag[tag].mistakes.find(m => m.text === mistakeText);
                if (existingMistake) {
                    existingMistake.count += info.count;
                } else {
                    teamMistakesByTag[tag].mistakes.push({
                        text: mistakeText,
                        count: info.count
                    });
                }
            });
        });

        // Convert to grouped format by tag
        const teamMistakes = Object.entries(teamMistakesByTag)
            .map(([tag, tagData]) => {
                // Sort mistakes within tag by count
                const sortedMistakes = tagData.mistakes.sort((a, b) => b.count - a.count);

                return {
                    tag: tag,
                    tagDisplayName: formatTagDisplayName(tag),
                    totalCount: tagData.count,
                    mistakes: sortedMistakes.map(m => ({
                        name: m.text,
                        count: m.count
                    }))
                };
            })
            .sort((a, b) => b.totalCount - a.totalCount); // Sort groups by total count

        // Manager Mistakes (Top 3 per manager)
        const managerMistakes = filteredManagers.map(op => {
            const opMistakes = op.category_mistakes?.[filterCategory] || {};
            const topMistakes = Object.entries(opMistakes)
                .map(([name, mistakeData]) => {
                    const info = extractMistakeInfo(mistakeData as any);
                    return { name, count: info.count, recommendation: info.recommendation };
                })
                .sort((a, b) => b.count - a.count)
                .slice(0, 3);

            return {
                ...op,
                topMistakes
            };
        });

        return { teamMistakesData: teamMistakes, managerMistakesData: managerMistakes };
    }, [filterCategory, filteredManagers]);

    // Prepare Recommendations Data
    const { teamRecommendationsData, managerRecommendationsData, comparisonRecommendationsData } = useMemo(() => {
        // Helper function to extract recommendations from mistake data
        const extractRecommendations = (mistakes: any, category: string): Array<{ mistake: string; recommendation: string; count: number }> => {
            const recommendations: Array<{ mistake: string; recommendation: string; count: number }> = [];
            const categoryMistakes = mistakes?.[category] || {};

            Object.entries(categoryMistakes).forEach(([mistakeName, mistakeData]) => {
                const data = mistakeData as any;
                if (typeof mistakeData === 'object' && data && data.recommendation) {
                    recommendations.push({
                        mistake: mistakeName,
                        recommendation: data.recommendation,
                        count: data.count || 0
                    });
                }
            });

            return recommendations.sort((a, b) => b.count - a.count);
        };

        // Team Recommendations - Group by tag
        const teamRecommendationsByTag: Record<string, Array<{ mistake: string; recommendation: string; count: number }>> = {};

        filteredManagers.forEach(op => {
            const opMistakes = op.category_mistakes?.[filterCategory] || {};
            Object.entries(opMistakes).forEach(([mistakeText, mistakeData]) => {
                const data = mistakeData as any;
                if (typeof mistakeData === 'object' && data && data.recommendation) {
                    const tag = data.tag || 'other';

                    if (!teamRecommendationsByTag[tag]) {
                        teamRecommendationsByTag[tag] = [];
                    }

                    // Check if this recommendation already exists for this tag
                    const existingRec = teamRecommendationsByTag[tag].find(r =>
                        r.mistake === mistakeText && r.recommendation === data.recommendation
                    );

                    if (existingRec) {
                        existingRec.count += (data.count || 0);
                    } else {
                        teamRecommendationsByTag[tag].push({
                            mistake: mistakeText,
                            recommendation: data.recommendation,
                            count: data.count || 0
                        });
                    }
                }
            });
        });

        // Convert to grouped format
        const teamRecommendations = Object.entries(teamRecommendationsByTag)
            .map(([tag, recommendations]) => {
                const sortedRecs = recommendations.sort((a, b) => b.count - a.count);
                const totalCount = recommendations.reduce((sum, r) => sum + r.count, 0);

                return {
                    tag: tag,
                    tagDisplayName: formatTagDisplayName(tag),
                    totalCount: totalCount,
                    recommendations: sortedRecs
                };
            })
            .sort((a, b) => b.totalCount - a.totalCount); // Sort groups by total count

        // Manager Recommendations
        const managerRecommendations = filteredManagers.map(op => ({
            ...op,
            recommendations: extractRecommendations(op.category_mistakes, filterCategory).slice(0, 5)
        }));

        // Comparison Recommendations
        let comparisonRecommendations: Array<{ managerName: string; recommendations: Array<{ mistake: string; recommendation: string; count: number }> }> = [];
        if (isComparisonMode && comparisonOps) {
            comparisonRecommendations = comparisonOps.map(op => ({
                managerName: op.name,
                recommendations: extractRecommendations(op.category_mistakes, filterCategory).slice(0, 5)
            }));
        }

        return {
            teamRecommendationsData: teamRecommendations,
            managerRecommendationsData: managerRecommendations,
            comparisonRecommendationsData: comparisonRecommendations
        };
    }, [filterCategory, filteredManagers, isComparisonMode, comparisonOps]);

    // Prepare Complaints Data - show actual objection texts grouped by tags
    const complaintsData = useMemo(() => {
        // Map to store each unique objection text with its count and tag
        const objectionTexts: Record<string, { count: number; tag: string }> = {};

        filteredManagers.forEach(op => {
            const opComplaints = op.client_complaints || {};
            Object.entries(opComplaints).forEach(([tag, data]) => {
                // Type guard for new format
                const complaintData = data as { count?: number; examples?: string[]; textCounts?: Record<string, number> } | number | string;

                if (typeof complaintData === 'object' && complaintData !== null && 'count' in complaintData) {
                    // New format: { count: number, examples: string[], textCounts: {} }
                    // Use textCounts if available for accurate counts per text
                    if (complaintData.textCounts && typeof complaintData.textCounts === 'object') {
                        Object.entries(complaintData.textCounts).forEach(([text, count]) => {
                            if (!objectionTexts[text]) {
                                objectionTexts[text] = { count: 0, tag: tag };
                            }
                            objectionTexts[text].count += (typeof count === 'number' ? count : parseInt(String(count)) || 0);
                        });
                    }
                    // Fallback to examples if textCounts not available
                    else if (complaintData.examples && Array.isArray(complaintData.examples)) {
                        complaintData.examples.forEach((example: string) => {
                            if (!objectionTexts[example]) {
                                objectionTexts[example] = { count: 0, tag: tag };
                            }
                            objectionTexts[example].count += 1;
                        });
                    }
                } else {
                    // Old format: simple count number (fallback)
                    // Can't show text for old format, skip
                }
            });
        });

        // Group by tag
        const groupedByTag: Record<string, Array<{ name: string; fullText: string; count: number; tag: string; tagDisplayName: string }>> = {};

        Object.entries(objectionTexts).forEach(([text, data]) => {
            const displayText = text.length > 60 ? text.substring(0, 57) + '...' : text;
            const complaintItem = {
                name: displayText,
                fullText: text,
                count: data.count,
                tag: data.tag,
                tagDisplayName: formatTagDisplayName(data.tag)
            };

            if (!groupedByTag[data.tag]) {
                groupedByTag[data.tag] = [];
            }
            groupedByTag[data.tag].push(complaintItem);
        });

        // Sort each group by count (descending) and convert to array format
        const result = Object.entries(groupedByTag).map(([tag, complaints]) => {
            const sortedComplaints = complaints.sort((a, b) => b.count - a.count);
            const totalCount = complaints.reduce((sum, c) => sum + c.count, 0);

            return {
                tag: tag,
                tagDisplayName: formatTagDisplayName(tag),
                totalCount: totalCount,
                complaints: sortedComplaints
            };
        }).sort((a, b) => b.totalCount - a.totalCount); // Sort groups by total count

        return result;
    }, [filteredManagers]);

    const getScoreColor = (score: number) => {
        if (score >= 90) return 'bg-emerald-100 text-emerald-800';
        if (score >= 80) return 'bg-blue-100 text-blue-800';
        if (score >= 70) return 'bg-yellow-100 text-yellow-800';
        return 'bg-red-100 text-red-800';
    };

    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) {
        return <div className="p-8 text-center text-gray-500">Statistikalar yuklanmoqda...</div>;
    }

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Statistikalar yuklanmoqda...</div>;
    }

    if (error) {
        return (
            <div className="p-8 text-center">
                <div className="text-red-500 mb-4">Xatolik: {error}</div>
                <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    Qayta yuklash
                </button>
            </div>
        );
    }

    if (managers.length === 0) {
        return (
            <div className="space-y-8">
                {/* Processing Status Banner */}
                {processingFiles.length > 0 ? (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6 shadow-sm">
                        <div className="flex items-start gap-3">
                            <Loader2 className="h-6 w-6 text-indigo-600 animate-spin mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                                <h3 className="font-semibold text-indigo-900 mb-2 text-lg">
                                    Tahlil qilinmoqda...
                                </h3>
                                <p className="text-sm text-indigo-700 mb-4">
                                    {processingFiles.length} ta audio fayl hozirda tahlil qilinmoqda.
                                    Natijalar tayyor bo'lganda avtomatik yangilanadi.
                                </p>
                                <div className="space-y-2">
                                    {processingFiles.slice(0, 5).map((file) => (
                                        <div key={file.id} className="text-sm text-indigo-600 flex items-center gap-2 bg-white/50 rounded-lg p-2">
                                            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></span>
                                            <span className="truncate flex-1">{file.original_name}</span>
                                            <span className="text-indigo-500 text-xs">({file.manager_name})</span>
                                        </div>
                                    ))}
                                    {processingFiles.length > 5 && (
                                        <div className="text-xs text-indigo-500 text-center pt-2">
                                            va yana {processingFiles.length - 5} ta fayl...
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}

                {/* Filters Bar */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-2 text-gray-500 mr-2">
                        <Filter size={20} />
                        <span className="font-medium">Filtrlar:</span>
                    </div>

                    {/* Period Filter */}
                    <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-gray-400" />
                        <select
                            value={filterPeriod}
                            onChange={(e) => setFilterPeriod(e.target.value)}
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 outline-none"
                        >
                            <option value="today">Bugun</option>
                            <option value="7d">Oxirgi 7 kun</option>
                            <option value="30d">Oxirgi 30 kun</option>
                            <option value="this_month">Bu oy</option>
                            <option value="last_month">O'tgan oy</option>
                            <option value="this_year">Bu yil</option>
                            <option value="all">Barcha vaqt</option>
                            <option value="custom">Boshqa davr</option>
                        </select>

                        {filterPeriod === 'custom' && (
                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                                <input
                                    type="date"
                                    value={customStartDate}
                                    onChange={(e) => setCustomStartDate(e.target.value)}
                                    className="bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded-lg p-2.5 outline-none"
                                    placeholder="Boshlash sanasi"
                                />
                                <span className="text-gray-400">-</span>
                                <input
                                    type="date"
                                    value={customEndDate}
                                    onChange={(e) => setCustomEndDate(e.target.value)}
                                    className="bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded-lg p-2.5 outline-none"
                                    placeholder="Tugash sanasi"
                                />
                            </div>
                        )}
                    </div>

                    {/* Manager Filter */}
                    <div className="flex items-center gap-2">
                        <User size={16} className="text-gray-400" />
                        <select
                            value={filterManager}
                            onChange={(e) => setFilterManager(e.target.value)}
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 outline-none"
                            disabled
                        >
                            <option value="all">Barcha managerlar</option>
                        </select>
                    </div>

                    {/* Category Filter */}
                    <div className="flex items-center gap-2">
                        <Tag size={16} className="text-gray-400" />
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 outline-none"
                            disabled={categories.length === 0}
                        >
                            {categories.length === 0 ? (
                                <option value="">Kategoriyalar yuklanmoqda...</option>
                            ) : (
                                <>
                                    <option value="">Barcha kategoriyalar</option>
                                    {categories.map((category) => (
                                        <option key={category.id} value={category.name}>
                                            {category.name}
                                        </option>
                                    ))}
                                </>
                            )}
                        </select>
                    </div>

                    {/* Comparison Mode Toggle */}
                    <div className="flex items-center gap-2 ml-auto">
                        <Users size={16} className="text-gray-400" />
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={comparisonMode}
                                onChange={(e) => setComparisonMode(e.target.checked)}
                                className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500"
                                disabled
                            />
                            <span className="text-sm text-gray-500">Taqqoslash rejimi</span>
                        </label>
                    </div>
                </div>

                {/* Empty State Message */}
                {processingFiles.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                        <p className="mb-2">Ma'lumot topilmadi.</p>
                        <p className="text-sm">Avval audio fayllarni yuklab, tahlil qiling.</p>
                    </div>
                )}
            </div>
        );
    }


    return (
        <div className="space-y-8">
            {/* Processing Status Banner */}
            {processingFiles.length > 0 && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                        <Loader2 className="h-5 w-5 text-indigo-600 animate-spin mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                            <h3 className="font-semibold text-indigo-900 mb-1">
                                Tahlil qilinmoqda...
                            </h3>
                            <p className="text-sm text-indigo-700 mb-2">
                                {processingFiles.length} ta audio fayl hozirda tahlil qilinmoqda.
                                Natijalar tayyor bo'lganda avtomatik yangilanadi.
                            </p>
                            <div className="space-y-1">
                                {processingFiles.slice(0, 3).map((file) => (
                                    <div key={file.id} className="text-xs text-indigo-600 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse"></span>
                                        <span className="truncate">{file.original_name}</span>
                                        <span className="text-indigo-500">({file.manager_name})</span>
                                    </div>
                                ))}
                                {processingFiles.length > 3 && (
                                    <div className="text-xs text-indigo-500">
                                        va yana {processingFiles.length - 3} ta fayl...
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}


            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2 text-gray-500 mr-2">
                    <Filter size={20} />
                    <span className="font-medium">Filtrlar:</span>
                </div>

                {/* Period Filter */}
                <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-gray-400" />
                    <select
                        value={filterPeriod}
                        onChange={(e) => setFilterPeriod(e.target.value)}
                        className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 outline-none"
                    >
                        <option value="today">Bugun</option>
                        <option value="7d">Oxirgi 7 kun</option>
                        <option value="30d">Oxirgi 30 kun</option>
                        <option value="this_month">Bu oy</option>
                        <option value="last_month">O'tgan oy</option>
                        <option value="this_year">Bu yil</option>
                        <option value="all">Barcha vaqt</option>
                        <option value="custom">Boshqa davr</option>
                    </select>

                    {filterPeriod === 'custom' && (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                            <input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                className="bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded-lg p-2.5 outline-none"
                                placeholder="Boshlash sanasi"
                            />
                            <span className="text-gray-400">-</span>
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                className="bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded-lg p-2.5 outline-none"
                                placeholder="Tugash sanasi"
                            />
                        </div>
                    )}
                </div>

                {/* Manager Filter */}
                <div className="flex items-center gap-2">
                    <User size={16} className="text-gray-400" />
                    <select
                        value={filterManager}
                        onChange={(e) => {
                            setFilterManager(e.target.value);
                        }}
                        className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 outline-none"
                    >
                        <option value="all">Barcha managerlar</option>
                        {managers.map(op => (
                            <option key={op.id} value={op.name}>{op.name}</option>
                        ))}
                    </select>
                </div>

                {/* Category Filter */}
                <div className="flex items-center gap-2">
                    <Tag size={16} className="text-gray-400" />
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 outline-none"
                        disabled={categories.length === 0}
                    >
                        {categories.length === 0 ? (
                            <option value="">Kategoriyalar yuklanmoqda...</option>
                        ) : (
                            categories.map((category) => (
                                <option key={category.id} value={category.name}>
                                    {category.name}
                                </option>
                            ))
                        )}
                    </select>
                </div>

                {/* Comparison Mode Toggle */}
                <div className="flex items-center gap-2 ml-auto">
                    <Users size={16} className="text-gray-400" />
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={comparisonMode}
                            onChange={(e) => {
                                setComparisonMode(e.target.checked);
                                if (!e.target.checked) {
                                    setCompareManager1('');
                                    setCompareManager2('');
                                }
                            }}
                            className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-700">Managerlarni solishtirish</span>
                    </label>
                </div>

                {/* Comparison Manager Selectors */}
                {comparisonMode && (
                    <div className="flex items-center gap-2 w-full animate-in fade-in slide-in-from-top-2">
                        <select
                            value={compareManager1}
                            onChange={(e) => {
                                const newValue = e.target.value;
                                setCompareManager1(newValue);
                                // Clear manager2 if it matches the newly selected manager1
                                if (newValue === compareManager2) {
                                    setCompareManager2('');
                                }
                            }}
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 outline-none flex-1"
                        >
                            <option value="">Manager 1 ni tanlang</option>
                            {managers
                                .filter(op => op.name !== compareManager2)
                                .map(op => (
                                    <option key={op.id} value={op.name}>{op.name}</option>
                                ))}
                        </select>
                        <span className="text-gray-400">vs</span>
                        <select
                            value={compareManager2}
                            onChange={(e) => {
                                const newValue = e.target.value;
                                setCompareManager2(newValue);
                                // Clear manager1 if it matches the newly selected manager2
                                if (newValue === compareManager1) {
                                    setCompareManager1('');
                                }
                            }}
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 outline-none flex-1"
                        >
                            <option value="">Manager 2 ni tanlang</option>
                            {managers
                                .filter(op => op.name !== compareManager1)
                                .map(op => (
                                    <option key={op.id} value={op.name}>{op.name}</option>
                                ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Top Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-gray-500 text-sm font-medium">Tahlil qilingan qo'ng'iroqlar</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                        {filteredManagers.reduce((acc, op) => acc + (op.category_counts?.[filterCategory] || 0), 0)}
                    </p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-gray-500 text-sm font-medium">O'rtacha jamoa balli ({getCategoryDisplayName(filterCategory, categories, managers) || filterCategory})</p>
                    <p className="text-3xl font-bold text-indigo-600 mt-2">
                        {(() => {
                            const managersWithAnalyses = filteredManagers.filter(op => (op.category_counts?.[filterCategory] || 0) > 0);
                            return managersWithAnalyses.length > 0
                                ? Math.round(managersWithAnalyses.reduce((acc, op) => acc + getScore(op), 0) / managersWithAnalyses.length)
                                : 0;
                        })()}%
                    </p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-gray-500 text-sm font-medium">Eng yaxshi natija</p>
                    <p className="text-xl font-bold text-emerald-600 mt-2">
                        {(() => {
                            const managersWithAnalyses = filteredManagers.filter(op => (op.category_counts?.[filterCategory] || 0) > 0);
                            return managersWithAnalyses.length > 0
                                ? managersWithAnalyses.reduce((prev, current) => getScore(prev) > getScore(current) ? prev : current).name
                                : '-';
                        })()}
                    </p>
                </div>
            </div>

            {/* Manager Comparison View - Show at top when active */}
            {comparisonMode && compareManager1 && compareManager2 && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-800 mb-6">
                        Managerlarni solishtirish: {compareManager1} vs {compareManager2}
                    </h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {[compareManager1, compareManager2].map((opName, idx) => {
                            const op = managers.find(o => o.name === opName);
                            if (!op) return null;
                            const score = getScore(op);
                            return (
                                <div key={`compare-${idx}-${op.id}`} className="border border-gray-200 rounded-lg p-4">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-lg font-bold text-gray-900">{op.name}</h3>
                                        <span className={clsx("px-3 py-1 rounded-lg font-bold", getScoreColor(score))}>
                                            {score}%
                                        </span>
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <div className="flex justify-between text-sm text-gray-600 mb-1">
                                                <span>Jami qo'ng'iroqlar</span>
                                                <span className="font-medium">{op.total_audios || 0}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-sm text-gray-600 mb-1">
                                                <span>O'rtacha ball</span>
                                                <span className="font-medium">{op.average_score || 0}%</span>
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1">
                                                {/* Average of all category scores: (sales + support + billing + technical) / 4 */}
                                                Barcha kategoriyalar bo'yicha o'rtacha ball
                                            </p>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-sm text-gray-600 mb-1">
                                                <span>Ko'rsatkich ({getCategoryDisplayName(filterCategory, categories, managers)})</span>
                                                <span className="font-medium">{score}%</span>
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1">
                                                {/* Category score = average of all criteria scores within that category */}
                                                {getCategoryDisplayName(filterCategory, categories, managers)} kategoriyasi bo'yicha o'rtacha ball
                                            </p>
                                            <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
                                                <div
                                                    className={clsx(
                                                        "h-2 rounded-full",
                                                        score >= 80 ? "bg-emerald-500" :
                                                            score >= 60 ? "bg-yellow-500" : "bg-red-500"
                                                    )}
                                                    style={{ width: `${score}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-sm text-gray-600 mb-1">
                                                <span>So'zlashish-tinglash nisbati</span>
                                                <span className="font-medium">
                                                    {op.talk_ratio?.manager || 0}% / {op.talk_ratio?.customer || 0}%
                                                </span>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-sm text-gray-600 mb-1">
                                                <span>O'rtacha davomiylik</span>
                                                <span className="font-medium">{formatDuration(op.average_duration || 0)}</span>
                                            </div>
                                        </div>
                                        {op.criteria_scores?.[filterCategory] && (
                                            <div className="mt-4 pt-4 border-t border-gray-200">
                                                <p className="text-sm font-medium text-gray-700 mb-2">Mezonlar bo'yicha:</p>
                                                <div className="space-y-2">
                                                    {Object.entries(op.criteria_scores[filterCategory]).map(([criterion, criterionScore]) => (
                                                        <div key={criterion}>
                                                            <div className="flex justify-between text-xs text-gray-600 mb-1">
                                                                <span>{criterion}</span>
                                                                <span className="font-medium">{criterionScore}%</span>
                                                            </div>
                                                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                                                                <div
                                                                    className={clsx(
                                                                        "h-1.5 rounded-full",
                                                                        criterionScore >= 80 ? "bg-emerald-500" :
                                                                            criterionScore >= 60 ? "bg-yellow-500" : "bg-red-500"
                                                                    )}
                                                                    style={{ width: `${criterionScore}%` }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Criteria Performance Section */}
            <div className={clsx("grid gap-8", (isComparisonMode || filterManager === 'all') ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
                {/* Comparison Mode: Manager 1 vs Manager 2 */}
                {isComparisonMode && comparisonOps ? (
                    <>
                        {/* Manager 1 Criteria Performance */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h2 className="text-xl font-semibold text-gray-800 mb-6">Mezonlarga rioya qilish - {comparisonOps[0].name}</h2>
                            <div className="h-80 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={getCategoryCriteria(managers, filterCategory, categories).map(criterion => ({
                                            criterion,
                                            score: comparisonOps[0].criteria_scores?.[filterCategory]?.[criterion] || 0
                                        }))}
                                        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis
                                            dataKey="criterion"
                                            angle={-45}
                                            textAnchor="end"
                                            interval={0}
                                            height={70}
                                            tick={{ fontSize: 12 }}
                                        />
                                        <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                                        <Tooltip
                                            cursor={{ fill: '#f3f4f6' }}
                                            contentStyle={tooltipContentStyle}
                                            formatter={(value: any) => [`${value}%`, '']}
                                            labelStyle={{ color: '#111827', fontWeight: '600', marginBottom: '4px' }}
                                        />
                                        <Bar dataKey="score" fill={MANAGER_COLORS[0]} name="Ball" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Manager 2 Criteria Performance */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h2 className="text-xl font-semibold text-gray-800 mb-6">Mezonlarga rioya qilish - {comparisonOps[1].name}</h2>
                            <div className="h-80 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={getCategoryCriteria(managers, filterCategory, categories).map(criterion => ({
                                            criterion,
                                            score: comparisonOps[1].criteria_scores?.[filterCategory]?.[criterion] || 0
                                        }))}
                                        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis
                                            dataKey="criterion"
                                            angle={-45}
                                            textAnchor="end"
                                            interval={0}
                                            height={70}
                                            tick={{ fontSize: 12 }}
                                        />
                                        <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                                        <Tooltip
                                            cursor={{ fill: '#f3f4f6' }}
                                            contentStyle={tooltipContentStyle}
                                            formatter={(value: any) => [`${value}%`, '']}
                                            labelStyle={{ color: '#111827', fontWeight: '600', marginBottom: '4px' }}
                                        />
                                        <Bar dataKey="score" fill={MANAGER_COLORS[1]} name="Ball" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Team Criteria Performance */}
                        {filterManager === 'all' && (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h2 className="text-xl font-semibold text-gray-800 mb-6">Mezonlarga rioya qilish - Jamoa o'rtachasi</h2>
                                <div className="h-80 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={teamCriteriaData}
                                            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis
                                                dataKey="criterion"
                                                angle={-45}
                                                textAnchor="end"
                                                interval={0}
                                                height={70}
                                                tick={{ fontSize: 12 }}
                                            />
                                            <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                                            <Tooltip
                                                cursor={{ fill: '#f3f4f6' }}
                                                contentStyle={tooltipContentStyle}
                                                formatter={(value: any) => [`${value}%`, '']}
                                                labelStyle={{ color: '#111827', fontWeight: '600', marginBottom: '4px' }}
                                            />
                                            <Bar dataKey="score" fill="#4338ca" name="O'rtacha ball" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        {/* Manager Criteria Comparison - Conditional Render */}
                        {!isComparisonMode && (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[400px]">
                                <h2 className="text-xl font-semibold text-gray-800 mb-6">Mezonlarga rioya qilish - Manager bo'yicha</h2>

                                {filteredManagers.length <= 5 ? (
                                    <div className="flex-1 w-full min-h-0">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={managerCriteriaData}
                                                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                <XAxis
                                                    dataKey="criterion"
                                                    angle={-45}
                                                    textAnchor="end"
                                                    interval={0}
                                                    height={70}
                                                    tick={{ fontSize: 12 }}
                                                />
                                                <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                                                <Tooltip
                                                    cursor={{ fill: '#f3f4f6' }}
                                                    content={<CustomManagerCriteriaTooltip />}
                                                />
                                                <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '20px' }} />
                                                {filteredManagers.map((op, index) => (
                                                    <Bar
                                                        key={op.id}
                                                        dataKey={op.name}
                                                        fill={MANAGER_COLORS[index % MANAGER_COLORS.length]}
                                                        radius={[4, 4, 0, 0]}
                                                    />
                                                ))}
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <div className="flex-1 overflow-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 z-10">
                                                <tr>
                                                    <th className="px-4 py-3 font-medium text-gray-700">Manager</th>
                                                    {getCategoryCriteria(filteredManagers, filterCategory, categories).map(criterion => (
                                                        <th key={criterion} className="px-4 py-3 font-medium text-gray-700 whitespace-nowrap">
                                                            {criterion}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {filteredManagers.map(op => (
                                                    <tr key={op.id} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                                                            {op.name}
                                                        </td>
                                                        {getCategoryCriteria(filteredManagers, filterCategory, categories).map(criterion => {
                                                            const score = op.criteria_scores?.[filterCategory]?.[criterion] || 0;
                                                            return (
                                                                <td key={criterion} className="px-4 py-3">
                                                                    <span className={clsx(
                                                                        "px-2.5 py-1 rounded-md font-medium text-xs inline-block text-center min-w-[3rem]",
                                                                        getScoreColor(score)
                                                                    )}>
                                                                        {score}%
                                                                    </span>
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {filteredManagers.length > 5 && (
                                    <div className="text-center text-xs text-gray-400 mt-2 border-t pt-2">
                                        Ko'proq managerlarni ko'rish uchun aylantiring
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Call Volume Section */}
            <div className={clsx("grid gap-8", (isComparisonMode || filterManager === 'all') ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
                {/* Comparison Mode: Manager 1 vs Manager 2 */}
                {isComparisonMode && comparisonOps ? (
                    <>
                        {/* Manager 1 Volume */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h2 className="text-xl font-semibold text-gray-800 mb-6">Qo'ng'iroq hajmi - {comparisonOps[0].name}</h2>
                            <div className="h-80 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart
                                        data={managerVolumeData.map(dayData => ({
                                            date: dayData.date,
                                            count: dayData[comparisonOps[0].name] || 0
                                        }))}
                                        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="date" padding={{ left: 30, right: 30 }} />
                                        <YAxis />
                                        <Tooltip
                                            cursor={{ stroke: '#9ca3af', strokeWidth: 1 }}
                                            contentStyle={tooltipContentStyle}
                                            labelStyle={{ color: '#111827', fontWeight: '600', marginBottom: '4px' }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="count"
                                            stroke={MANAGER_COLORS[0]}
                                            strokeWidth={3}
                                            dot={{ r: 4, fill: MANAGER_COLORS[0], strokeWidth: 2, stroke: '#fff' }}
                                            activeDot={{ r: 6, strokeWidth: 0 }}
                                            name="Qo'ng'iroqlar"
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Manager 2 Volume */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h2 className="text-xl font-semibold text-gray-800 mb-6">Qo'ng'iroq hajmi - {comparisonOps[1].name}</h2>
                            <div className="h-80 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart
                                        data={managerVolumeData.map(dayData => ({
                                            date: dayData.date,
                                            count: dayData[comparisonOps[1].name] || 0
                                        }))}
                                        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="date" padding={{ left: 30, right: 30 }} />
                                        <YAxis />
                                        <Tooltip
                                            cursor={{ stroke: '#9ca3af', strokeWidth: 1 }}
                                            contentStyle={tooltipContentStyle}
                                            labelStyle={{ color: '#111827', fontWeight: '600', marginBottom: '4px' }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="count"
                                            stroke={MANAGER_COLORS[1]}
                                            strokeWidth={3}
                                            dot={{ r: 4, fill: MANAGER_COLORS[1], strokeWidth: 2, stroke: '#fff' }}
                                            activeDot={{ r: 6, strokeWidth: 0 }}
                                            name="Qo'ng'iroqlar"
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Team Volume */}
                        {filterManager === 'all' && (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h2 className="text-xl font-semibold text-gray-800 mb-6">Qo'ng'iroq hajmi - Jamoa jami</h2>
                                <div className="h-80 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart
                                            data={teamVolumeData}
                                            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="date" padding={{ left: 30, right: 30 }} />
                                            <YAxis />
                                            <Tooltip
                                                cursor={{ stroke: '#9ca3af', strokeWidth: 1 }}
                                                contentStyle={tooltipContentStyle}
                                                labelStyle={{ color: '#111827', fontWeight: '600', marginBottom: '4px' }}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="count"
                                                stroke="#4338ca"
                                                strokeWidth={3}
                                                dot={{ r: 4, fill: '#4338ca', strokeWidth: 2, stroke: '#fff' }}
                                                activeDot={{ r: 6, strokeWidth: 0 }}
                                                name="Jami qo'ng'iroqlar"
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        {/* Manager Volume - Conditional */}
                        {!isComparisonMode && (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[400px]">
                                <h2 className="text-xl font-semibold text-gray-800 mb-6">Qo'ng'iroq hajmi - Manager bo'yicha</h2>

                                {filteredManagers.length <= 5 ? (
                                    <div className="flex-1 w-full min-h-0">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart
                                                data={managerVolumeData}
                                                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                <XAxis dataKey="date" padding={{ left: 30, right: 30 }} />
                                                <YAxis />
                                                <Tooltip
                                                    cursor={{ stroke: '#9ca3af', strokeWidth: 1 }}
                                                    contentStyle={tooltipContentStyle}
                                                    labelStyle={{ color: '#111827', fontWeight: '600', marginBottom: '4px' }}
                                                />
                                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                                {filteredManagers.map((op, index) => (
                                                    <Line
                                                        key={op.id}
                                                        type="monotone"
                                                        dataKey={op.name}
                                                        stroke={MANAGER_COLORS[index % MANAGER_COLORS.length]}
                                                        strokeWidth={2}
                                                        dot={{ r: 3, fill: MANAGER_COLORS[index % MANAGER_COLORS.length], strokeWidth: 2, stroke: '#fff' }}
                                                    />
                                                ))}
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <div className="flex-1 overflow-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 z-10">
                                                <tr>
                                                    <th className="px-4 py-3 font-medium text-gray-700">Manager</th>
                                                    {(getDatesForPeriod(filterPeriod)).map(date => (
                                                        <th key={date} className="px-4 py-3 font-medium text-gray-700 whitespace-nowrap">
                                                            {date}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {filteredManagers.map(op => (
                                                    <tr key={op.id} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                                                            {op.name}
                                                        </td>
                                                        {managerVolumeData.map(dayData => (
                                                            <td key={dayData.date} className="px-4 py-3">
                                                                {dayData[op.name] || 0}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {filteredManagers.length > 5 && (
                                    <div className="text-center text-xs text-gray-400 mt-2 border-t pt-2">
                                        Ko'proq managerlarni ko'rish uchun aylantiring
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Speak-to-Listen Ratio Section */}
            <div className={clsx("grid gap-8", (isComparisonMode || filterManager === 'all') ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
                {/* Comparison Mode: Manager 1 vs Manager 2 */}
                {isComparisonMode && comparisonOps ? (
                    <>
                        {/* Manager 1 Ratio */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h2 className="text-xl font-semibold text-gray-800 mb-6">So'zlashish-tinglash nisbati - {comparisonOps[0].name}</h2>
                            <div className="h-80 w-full flex items-center justify-center">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: 'Manager', value: comparisonOps[0].talk_ratio?.manager || 0 },
                                                { name: 'Mijoz', value: comparisonOps[0].talk_ratio?.customer || 0 }
                                            ]}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            <Cell fill={MANAGER_COLORS[0]} />
                                            <Cell fill="#059669" />
                                        </Pie>
                                        <Tooltip content={<CustomPieTooltip />} />
                                        <Legend verticalAlign="bottom" height={36} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Manager 2 Ratio */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h2 className="text-xl font-semibold text-gray-800 mb-6">So'zlashish-tinglash nisbati - {comparisonOps[1].name}</h2>
                            <div className="h-80 w-full flex items-center justify-center">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: 'Manager', value: comparisonOps[1].talk_ratio?.manager || 0 },
                                                { name: 'Mijoz', value: comparisonOps[1].talk_ratio?.customer || 0 }
                                            ]}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            <Cell fill={MANAGER_COLORS[1]} />
                                            <Cell fill="#059669" />
                                        </Pie>
                                        <Tooltip content={<CustomPieTooltip />} />
                                        <Legend verticalAlign="bottom" height={36} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Team Ratio */}
                        {filterManager === 'all' && (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h2 className="text-xl font-semibold text-gray-800 mb-6">So'zlashish-tinglash nisbati - Jamoa o'rtachasi</h2>
                                <div className="h-80 w-full flex items-center justify-center">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={(() => {
                                                    const managersWithAnalyses = filteredManagers.filter(op => (op.category_counts?.[filterCategory] || 0) > 0);
                                                    const managerRatio = managersWithAnalyses.length > 0
                                                        ? Math.round(managersWithAnalyses.reduce((acc, op) => acc + (op.talk_ratio?.manager || 0), 0) / managersWithAnalyses.length)
                                                        : 0;
                                                    const customerRatio = managersWithAnalyses.length > 0
                                                        ? Math.round(managersWithAnalyses.reduce((acc, op) => acc + (op.talk_ratio?.customer || 0), 0) / managersWithAnalyses.length)
                                                        : 0;
                                                    return [
                                                        { name: 'Manager', value: managerRatio },
                                                        { name: 'Mijoz', value: customerRatio }
                                                    ];
                                                })()}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={100}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                <Cell fill="#4f46e5" /> {/* Manager - Indigo */}
                                                <Cell fill="#059669" /> {/* Customer - Emerald */}
                                            </Pie>
                                            <Tooltip content={<CustomPieTooltip />} />
                                            <Legend verticalAlign="bottom" height={36} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        {/* Manager Ratio - Conditional */}
                        {!isComparisonMode && (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[400px]">
                                <h2 className="text-xl font-semibold text-gray-800 mb-6">So'zlashish-tinglash nisbati - Manager bo'yicha</h2>

                                {filteredManagers.length <= 5 ? (
                                    <div className="flex-1 w-full min-h-0">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={filteredManagers.map(op => ({
                                                    name: op.name,
                                                    Manager: op.talk_ratio?.manager || 0,
                                                    Mijoz: op.talk_ratio?.customer || 0
                                                }))}
                                                layout="vertical"
                                                margin={{ top: 20, right: 30, left: 40, bottom: 20 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                                <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                                                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                                                <Tooltip
                                                    cursor={{ fill: '#f3f4f6' }}
                                                    content={<CustomStackedBarTooltip />}
                                                />
                                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                                <Bar dataKey="Manager" stackId="a" fill="#4f46e5" radius={[0, 0, 0, 0]} />
                                                <Bar dataKey="Mijoz" stackId="a" fill="#059669" radius={[0, 4, 4, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <div className="flex-1 overflow-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 z-10">
                                                <tr>
                                                    <th className="px-4 py-3 font-medium text-gray-700">Manager</th>
                                                    <th className="px-4 py-3 font-medium text-gray-700">Manager %</th>
                                                    <th className="px-4 py-3 font-medium text-gray-700">Mijoz %</th>
                                                    <th className="px-4 py-3 font-medium text-gray-700">Ko'rinish</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {filteredManagers.map(op => (
                                                    <tr key={op.id} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                                                            {op.name}
                                                        </td>
                                                        <td className="px-4 py-3 font-bold text-indigo-600">{op.talk_ratio?.manager || 0}%</td>
                                                        <td className="px-4 py-3 font-bold text-emerald-600">{op.talk_ratio?.customer || 0}%</td>
                                                        <td className="px-4 py-3 min-w-[150px]">
                                                            <div className="w-full bg-gray-100 rounded-full h-2.5 flex overflow-hidden">
                                                                <div
                                                                    className="bg-indigo-600 h-2.5"
                                                                    style={{ width: `${op.talk_ratio?.manager || 0}%` }}
                                                                    title={`Manager: ${op.talk_ratio?.manager || 0}%`}
                                                                ></div>
                                                                <div
                                                                    className="bg-emerald-600 h-2.5"
                                                                    style={{ width: `${op.talk_ratio?.customer || 0}%` }}
                                                                    title={`Customer: ${op.talk_ratio?.customer || 0}%`}
                                                                ></div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {filteredManagers.length > 5 && (
                                    <div className="text-center text-xs text-gray-400 mt-2 border-t pt-2">
                                        Ko'proq managerlarni ko'rish uchun aylantiring
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Conversation Duration Section */}
            <div className={clsx("grid gap-8", (isComparisonMode || filterManager === 'all') ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
                {/* Comparison Mode: Manager 1 vs Manager 2 */}
                {isComparisonMode && comparisonOps ? (
                    <>
                        {/* Manager 1 Duration */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h2 className="text-xl font-semibold text-gray-800 mb-6">O'rtacha davomiylik - {comparisonOps[0].name}</h2>
                            <div className="h-80 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={[{ name: comparisonOps[0].name, duration: comparisonOps[0].average_duration || 0 }]}
                                        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" />
                                        <YAxis tickFormatter={(val) => `${Math.floor(val / 60)}m`} />
                                        <Tooltip
                                            cursor={{ fill: '#f3f4f6' }}
                                            contentStyle={tooltipContentStyle}
                                            formatter={(value: number) => [formatDuration(value), 'Davomiylik']}
                                            labelStyle={{ color: '#111827', fontWeight: '600', marginBottom: '4px' }}
                                        />
                                        <Bar dataKey="duration" fill={MANAGER_COLORS[0]} radius={[4, 4, 0, 0]} name="Davomiylik" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Manager 2 Duration */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h2 className="text-xl font-semibold text-gray-800 mb-6">O'rtacha davomiylik - {comparisonOps[1].name}</h2>
                            <div className="h-80 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={[{ name: comparisonOps[1].name, duration: comparisonOps[1].average_duration || 0 }]}
                                        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" />
                                        <YAxis tickFormatter={(val) => `${Math.floor(val / 60)}m`} />
                                        <Tooltip
                                            cursor={{ fill: '#f3f4f6' }}
                                            contentStyle={tooltipContentStyle}
                                            formatter={(value: number) => [formatDuration(value), 'Davomiylik']}
                                            labelStyle={{ color: '#111827', fontWeight: '600', marginBottom: '4px' }}
                                        />
                                        <Bar dataKey="duration" fill={MANAGER_COLORS[1]} radius={[4, 4, 0, 0]} name="Davomiylik" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Team Duration */}
                        {filterManager === 'all' && !isComparisonMode && (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h2 className="text-xl font-semibold text-gray-800 mb-6">O'rtacha davomiylik - Jamoa ({getCategoryDisplayName(filterCategory, categories, managers) || filterCategory})</h2>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 font-medium text-gray-700">Jamoa</th>
                                                <th className="px-4 py-3 font-medium text-gray-700">O'rtacha davomiylik</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            <tr className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                                                    {(() => {
                                                        const managersWithAnalyses = filteredManagers.filter(op => (op.category_counts?.[filterCategory] || 0) > 0);
                                                        return managersWithAnalyses.length > 0
                                                            ? `Jamoa (${managersWithAnalyses.length} manager${managersWithAnalyses.length > 1 ? 'lar' : ''})`
                                                            : 'Jamoa';
                                                    })()}
                                                </td>
                                                <td className="px-4 py-3 font-medium text-gray-700">
                                                    {(() => {
                                                        const managersWithAnalyses = filteredManagers.filter(op => (op.category_counts?.[filterCategory] || 0) > 0);
                                                        const totalDuration = managersWithAnalyses.reduce((sum, op) => sum + (op.average_duration || 0), 0);
                                                        const avgDuration = managersWithAnalyses.length > 0 ? Math.round(totalDuration / managersWithAnalyses.length) : 0;
                                                        return formatDuration(avgDuration);
                                                    })()}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Manager Duration - Conditional */}
                        {!isComparisonMode && (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[400px]">
                                <h2 className="text-xl font-semibold text-gray-800 mb-6">O'rtacha davomiylik - Manager bo'yicha</h2>

                                {filteredManagers.length <= 5 ? (
                                    <div className="flex-1 w-full min-h-0">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={managerDurationData}
                                                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                <XAxis dataKey="name" />
                                                <YAxis tickFormatter={(val) => `${Math.floor(val / 60)}m`} />
                                                <Tooltip
                                                    cursor={{ fill: '#f3f4f6' }}
                                                    contentStyle={tooltipContentStyle}
                                                    formatter={(value: number) => [formatDuration(value), 'Davomiylik']}
                                                    labelStyle={{ color: '#111827', fontWeight: '600', marginBottom: '4px' }}
                                                />
                                                <Bar dataKey="duration" fill="#059669" radius={[4, 4, 0, 0]} name="Davomiylik" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <div className="flex-1 overflow-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 z-10">
                                                <tr>
                                                    <th className="px-4 py-3 font-medium text-gray-700">Manager</th>
                                                    <th className="px-4 py-3 font-medium text-gray-700">O'rtacha davomiylik</th>
                                                    <th className="px-4 py-3 font-medium text-gray-700">Ko'rinish</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {filteredManagers.map(op => {
                                                    const duration = op.average_duration || 0;
                                                    const maxDuration = Math.max(...filteredManagers.map(o => o.average_duration || 0));
                                                    const percentage = (duration / maxDuration) * 100;

                                                    return (
                                                        <tr key={op.id} className="hover:bg-gray-50 transition-colors">
                                                            <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                                                                {op.name}
                                                            </td>
                                                            <td className="px-4 py-3 font-medium text-gray-700">
                                                                {formatDuration(duration)}
                                                            </td>
                                                            <td className="px-4 py-3 min-w-[150px]">
                                                                <div className="w-full bg-gray-100 rounded-full h-2.5 flex overflow-hidden">
                                                                    <div
                                                                        className="bg-emerald-600 h-2.5"
                                                                        style={{ width: `${percentage}%` }}
                                                                    ></div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {filteredManagers.length > 5 && (
                                    <div className="text-center text-xs text-gray-400 mt-2 border-t pt-2">
                                        Ko'proq managerlarni ko'rish uchun aylantiring
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Most Common Complaints Section */}
            {filterManager === 'all' && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                    <h2 className="text-xl font-semibold text-gray-800 mb-6">Eng ko'p berilgan e'tirozlar (Mijozlar bo'limi)</h2>
                    {complaintsData.length > 0 ? (
                        <div className="flex-1 overflow-auto">
                            <div className="space-y-2">
                                {complaintsData.map((tagGroup, groupIndex) => {
                                    const isExpanded = expandedComplaintTags.has(tagGroup.tag);
                                    return (
                                        <div key={groupIndex} className="border border-gray-200 rounded-lg overflow-hidden">
                                            {/* Tag Group Header */}
                                            <button
                                                onClick={() => toggleComplaintTag(tagGroup.tag)}
                                                className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between text-left"
                                            >
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    {isExpanded ? (
                                                        <ChevronDown className="w-5 h-5 text-gray-600 flex-shrink-0" />
                                                    ) : (
                                                        <ChevronRight className="w-5 h-5 text-gray-600 flex-shrink-0" />
                                                    )}
                                                    <span className="font-semibold text-gray-800 flex-1 truncate">
                                                        {tagGroup.complaints[0]?.fullText || tagGroup.complaints[0]?.name || tagGroup.tagDisplayName}
                                                    </span>
                                                    <span className="text-sm text-gray-500 flex-shrink-0 ml-2">
                                                        ({tagGroup.complaints.length} e'tiroz)
                                                    </span>
                                                </div>
                                            </button>

                                            {/* Expanded Content */}
                                            {isExpanded && (
                                                <div className="border-t border-gray-200">
                                                    <table className="w-full text-sm">
                                                        <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                                                            <tr>
                                                                <th className="px-4 py-3 font-medium text-gray-700 text-left">E'tiroz</th>
                                                                <th className="px-4 py-3 font-medium text-gray-700 text-left">Soni</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {tagGroup.complaints.map((complaint, complaintIndex) => (
                                                                <tr key={complaintIndex} className="hover:bg-gray-50 transition-colors">
                                                                    <td className="px-4 py-3 text-gray-900">
                                                                        {complaint.fullText || complaint.name}
                                                                    </td>
                                                                    <td className="px-4 py-3 font-medium text-gray-700">
                                                                        {complaint.count} marta
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="h-80 w-full flex items-center justify-center">
                            <div className="text-center text-gray-400">
                                <p className="text-lg mb-2">Ma'lumotlar mavjud emas</p>
                                <p className="text-sm">Mijozlar bo'limidan e'tirozlar hali qayd etilmagan</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Top Mistakes Section */}
            <div className={clsx("grid gap-8", (isComparisonMode || filterManager === 'all') ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
                {/* Comparison Mode: Manager 1 vs Manager 2 */}
                {isComparisonMode && comparisonOps ? (
                    <>
                        {/* Manager 1 Mistakes */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h2 className="text-xl font-semibold text-gray-800 mb-6">Eng ko'p xatolar - {comparisonOps[0].name} ({getCategoryDisplayName(filterCategory, categories, managers) || filterCategory})</h2>
                            <div className="h-80 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={Object.entries(comparisonOps[0].category_mistakes?.[filterCategory] || {})
                                            .map(([name, mistakeData]) => {
                                                const count = typeof mistakeData === 'number' ? mistakeData : ((mistakeData as any)?.count || 0);
                                                return { name, count };
                                            })
                                            .sort((a, b) => b.count - a.count)
                                            .slice(0, 5)}
                                        layout="vertical"
                                        margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                        <XAxis type="number" />
                                        <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} />
                                        <Tooltip
                                            cursor={{ fill: '#f3f4f6' }}
                                            contentStyle={tooltipContentStyle}
                                            labelStyle={{ color: '#111827', fontWeight: '600', marginBottom: '4px' }}
                                        />
                                        <Bar dataKey="count" fill={MANAGER_COLORS[0]} radius={[0, 4, 4, 0]} name="Takrorlanishi" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Manager 2 Mistakes */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h2 className="text-xl font-semibold text-gray-800 mb-6">Eng ko'p xatolar - {comparisonOps[1].name} ({getCategoryDisplayName(filterCategory, categories, managers) || filterCategory})</h2>
                            <div className="h-80 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={Object.entries(comparisonOps[1].category_mistakes?.[filterCategory] || {})
                                            .map(([name, mistakeData]) => {
                                                const count = typeof mistakeData === 'number' ? mistakeData : ((mistakeData as any)?.count || 0);
                                                return { name, count };
                                            })
                                            .sort((a, b) => b.count - a.count)
                                            .slice(0, 5)}
                                        layout="vertical"
                                        margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                        <XAxis type="number" />
                                        <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} />
                                        <Tooltip
                                            cursor={{ fill: '#f3f4f6' }}
                                            contentStyle={tooltipContentStyle}
                                            labelStyle={{ color: '#111827', fontWeight: '600', marginBottom: '4px' }}
                                        />
                                        <Bar dataKey="count" fill={MANAGER_COLORS[1]} radius={[0, 4, 4, 0]} name="Takrorlanishi" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Team Mistakes */}
                        {filterManager === 'all' && (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                                <h2 className="text-xl font-semibold text-gray-800 mb-6">Eng ko'p xatolar - Jamoa ({getCategoryDisplayName(filterCategory, categories, managers) || filterCategory})</h2>
                                {teamMistakesData.length > 0 ? (
                                    <div className="flex-1 overflow-auto">
                                        <div className="space-y-2">
                                            {teamMistakesData.map((tagGroup, groupIndex) => {
                                                const isExpanded = expandedMistakeTags.has(tagGroup.tag);
                                                return (
                                                    <div key={groupIndex} className="border border-gray-200 rounded-lg overflow-hidden">
                                                        {/* Tag Group Header */}
                                                        <button
                                                            onClick={() => toggleMistakeTag(tagGroup.tag)}
                                                            className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between text-left"
                                                        >
                                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                                {isExpanded ? (
                                                                    <ChevronDown className="w-5 h-5 text-gray-600 flex-shrink-0" />
                                                                ) : (
                                                                    <ChevronRight className="w-5 h-5 text-gray-600 flex-shrink-0" />
                                                                )}
                                                                <span className="font-semibold text-red-600 flex-1 truncate">
                                                                    {tagGroup.mistakes[0]?.name || tagGroup.tagDisplayName}
                                                                </span>
                                                                <span className="text-sm text-gray-500 flex-shrink-0 ml-2">
                                                                    ({tagGroup.mistakes.length} xato)
                                                                </span>
                                                            </div>
                                                        </button>

                                                        {/* Expanded Content */}
                                                        {isExpanded && (
                                                            <div className="border-t border-gray-200">
                                                                <table className="w-full text-sm">
                                                                    <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                                                                        <tr>
                                                                            <th className="px-4 py-3 font-medium text-gray-700 text-left">Xato</th>
                                                                            <th className="px-4 py-3 font-medium text-gray-700 text-left">Soni</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-gray-100">
                                                                        {tagGroup.mistakes.map((mistake, mistakeIndex) => (
                                                                            <tr key={mistakeIndex} className="hover:bg-gray-50 transition-colors">
                                                                                <td className="px-4 py-3 text-red-600">
                                                                                    {mistake.name}
                                                                                </td>
                                                                                <td className="px-4 py-3 font-medium text-gray-700">
                                                                                    {mistake.count}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-80 w-full flex items-center justify-center">
                                        <div className="text-center text-gray-400">
                                            <p className="text-lg mb-2">Ma'lumotlar mavjud emas</p>
                                            <p className="text-sm">Jamoa xatolari hali qayd etilmagan</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Manager Mistakes */}
                        {!isComparisonMode && (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                                <h2 className="text-xl font-semibold text-gray-800 mb-6">Eng ko'p xatolar - Manager bo'yicha</h2>
                                <div className="flex-1 overflow-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 z-10">
                                            <tr>
                                                <th className="px-4 py-3 font-medium text-gray-700">Manager</th>
                                                <th className="px-4 py-3 font-medium text-gray-700">Eng ko'p takrorlanadigan xato</th>
                                                <th className="px-4 py-3 font-medium text-gray-700">Soni</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {managerMistakesData.map(op => (
                                                <tr key={op.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                                                        {op.name}
                                                    </td>
                                                    <td className="px-4 py-3 text-red-600">
                                                        {op.topMistakes[0]?.name || '-'}
                                                    </td>
                                                    <td className="px-4 py-3 font-medium text-gray-700">
                                                        {op.topMistakes[0]?.count || 0}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                    </>
                )}
            </div>

            {/* Recommendations Section */}
            {(teamRecommendationsData.length > 0 || managerRecommendationsData.some(m => m.recommendations.length > 0) || comparisonRecommendationsData.some(c => c.recommendations.length > 0)) && (
                <div className="mt-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6">Tavsiyalar</h2>
                    <div className={clsx("grid gap-8", (isComparisonMode || filterManager === 'all') ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
                        {/* Comparison Mode: Manager 1 vs Manager 2 Recommendations */}
                        {isComparisonMode && comparisonRecommendationsData.length >= 2 ? (
                            <>
                                {/* Manager 1 Recommendations */}
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                    <h3 className="text-xl font-semibold text-gray-800 mb-6">
                                        Tavsiyalar - {comparisonRecommendationsData[0].managerName} ({getCategoryDisplayName(filterCategory, categories, managers) || filterCategory})
                                    </h3>
                                    {comparisonRecommendationsData[0].recommendations.length > 0 ? (
                                        <div className="space-y-3">
                                            {comparisonRecommendationsData[0].recommendations.map((rec, idx) => (
                                                <div key={idx} className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500 hover:bg-blue-100 transition-colors">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <span className="font-semibold text-gray-800 text-sm">{rec.mistake}</span>
                                                        <span className="text-xs text-gray-500 bg-blue-200 px-2 py-1 rounded-full">
                                                            {rec.count} marta
                                                        </span>
                                                    </div>
                                                    <p className="text-gray-700 text-sm leading-relaxed">{rec.recommendation}</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center text-gray-400 py-8">
                                            <p>Tavsiyalar mavjud emas</p>
                                        </div>
                                    )}
                                </div>

                                {/* Manager 2 Recommendations */}
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                    <h3 className="text-xl font-semibold text-gray-800 mb-6">
                                        Tavsiyalar - {comparisonRecommendationsData[1].managerName} ({getCategoryDisplayName(filterCategory, categories, managers) || filterCategory})
                                    </h3>
                                    {comparisonRecommendationsData[1].recommendations.length > 0 ? (
                                        <div className="space-y-3">
                                            {comparisonRecommendationsData[1].recommendations.map((rec, idx) => (
                                                <div key={idx} className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500 hover:bg-green-100 transition-colors">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <span className="font-semibold text-gray-800 text-sm">{rec.mistake}</span>
                                                        <span className="text-xs text-gray-500 bg-green-200 px-2 py-1 rounded-full">
                                                            {rec.count} marta
                                                        </span>
                                                    </div>
                                                    <p className="text-gray-700 text-sm leading-relaxed">{rec.recommendation}</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center text-gray-400 py-8">
                                            <p>Tavsiyalar mavjud emas</p>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Team Recommendations */}
                                {filterManager === 'all' && teamRecommendationsData.length > 0 && (
                                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                        <h3 className="text-xl font-semibold text-gray-800 mb-6">
                                            Tavsiyalar - Jamoa ({getCategoryDisplayName(filterCategory, categories, managers) || filterCategory})
                                        </h3>
                                        <div className="space-y-2">
                                            {teamRecommendationsData.map((tagGroup, groupIndex) => {
                                                const isExpanded = expandedRecommendationTags.has(tagGroup.tag);
                                                const firstRec = tagGroup.recommendations[0];
                                                return (
                                                    <div key={groupIndex} className="border border-gray-200 rounded-lg overflow-hidden">
                                                        {/* Tag Group Header */}
                                                        <button
                                                            onClick={() => toggleRecommendationTag(tagGroup.tag)}
                                                            className="w-full px-4 py-3 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center justify-between text-left"
                                                        >
                                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                                {isExpanded ? (
                                                                    <ChevronDown className="w-5 h-5 text-blue-600 flex-shrink-0" />
                                                                ) : (
                                                                    <ChevronRight className="w-5 h-5 text-blue-600 flex-shrink-0" />
                                                                )}
                                                                <div className="flex-1 min-w-0">
                                                                    <span className="font-semibold text-gray-800 text-sm block truncate">
                                                                        {firstRec?.mistake || tagGroup.tagDisplayName}
                                                                    </span>
                                                                    {!isExpanded && firstRec && (
                                                                        <p className="text-gray-600 text-xs mt-1 truncate">
                                                                            {firstRec.recommendation}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <span className="text-xs text-gray-500 bg-blue-200 px-2 py-1 rounded-full flex-shrink-0 ml-2">
                                                                    {tagGroup.recommendations.length} tavsiya
                                                                </span>
                                                            </div>
                                                        </button>

                                                        {/* Expanded Content */}
                                                        {isExpanded && (
                                                            <div className="border-t border-gray-200 bg-white">
                                                                <div className="space-y-3 p-4">
                                                                    {tagGroup.recommendations.map((rec, recIndex) => (
                                                                        <div key={recIndex} className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500 hover:bg-blue-100 transition-colors">
                                                                            <div className="flex items-start justify-between mb-2">
                                                                                <span className="font-semibold text-gray-800 text-sm">{rec.mistake}</span>
                                                                                <span className="text-xs text-gray-500 bg-blue-200 px-2 py-1 rounded-full">
                                                                                    {rec.count} marta
                                                                                </span>
                                                                            </div>
                                                                            <p className="text-gray-700 text-sm leading-relaxed">{rec.recommendation}</p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Manager Recommendations */}
                                {!isComparisonMode && (
                                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                        <h3 className="text-xl font-semibold text-gray-800 mb-6">Tavsiyalar - Manager bo'yicha</h3>
                                        <div className="space-y-6">
                                            {managerRecommendationsData
                                                .filter(m => m.recommendations.length > 0)
                                                .map(manager => (
                                                    <div key={manager.id} className="border-b border-gray-200 last:border-b-0 pb-6 last:pb-0">
                                                        <h4 className="font-semibold text-gray-800 mb-4 text-lg">{manager.name}</h4>
                                                        <div className="space-y-3">
                                                            {manager.recommendations.map((rec, idx) => (
                                                                <div key={idx} className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border-l-4 border-indigo-500 hover:shadow-md transition-shadow">
                                                                    <div className="flex items-start justify-between mb-2">
                                                                        <span className="font-semibold text-gray-800 text-sm">{rec.mistake}</span>
                                                                        <span className="text-xs text-gray-500 bg-indigo-200 px-2 py-1 rounded-full whitespace-nowrap">
                                                                            {rec.count} marta
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-gray-700 text-sm leading-relaxed">{rec.recommendation}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            {managerRecommendationsData.filter(m => m.recommendations.length > 0).length === 0 && (
                                                <div className="text-center text-gray-400 py-8">
                                                    <p>Tavsiyalar mavjud emas</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

        </div>
    );
}
