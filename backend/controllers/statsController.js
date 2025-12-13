
const { parseTimestamp } = require('../utils/timestamp');

// Helper function to build date filter (PostgreSQL syntax)
// Returns { filter: string, params: array } for custom period, or { filter: string, params: [] } for others
function buildDateFilter(period, startDate, endDate) {
    let dateFilter = '';
    const params = [];
    if (period === 'custom' && startDate && endDate) {
        // Use ? placeholders - they will be converted to $1, $2 by convertQuery
        // Cast the column to date and compare with parameter values cast to date
        dateFilter = `AND a.upload_date::date >= ?::date AND a.upload_date::date <= ?::date`;
        params.push(startDate, endDate);
    } else if (period === '7d') {
        dateFilter = `AND a.upload_date::date >= CURRENT_DATE - INTERVAL '7 days'`;
    } else if (period === '30d') {
        dateFilter = `AND a.upload_date::date >= CURRENT_DATE - INTERVAL '30 days'`;
    } else if (period === 'today') {
        dateFilter = `AND a.upload_date::date = CURRENT_DATE`;
    } else if (period === 'all') {
        // For 'all' period, return empty filter (caller can handle 90 days or no filter)
        dateFilter = '';
    }
    return { filter: dateFilter, params };
}

// Helper function to fetch categories and criterion mappings
async function fetchCategoriesAndMappings(db) {
    const dbCategories = await db.all('SELECT name FROM conversation_categories');
    const categoryKeys = new Set(dbCategories.map(cat => cat.name));

    const criteriaMappings = await db.all(`
        SELECT cc.name as criterion_name, cat.name as category_name
        FROM conversation_criteria cc
        JOIN conversation_categories cat ON cc.category_id = cat.id
    `);

    const criterionToCategory = {};
    for (const mapping of criteriaMappings) {
        criterionToCategory[mapping.criterion_name] = mapping.category_name;
    }

    return { categoryKeys, criterionToCategory };
}

// Helper function to fetch managers with date filter
async function fetchManagers(db, dateFilterObj) {
    const { filter: dateFilter, params: dateParams = [] } = dateFilterObj || { filter: '', params: [] };
    return await db.all(`
        SELECT DISTINCT m.id, m.name
        FROM managers m
        JOIN audio_files a ON m.id = a.manager_id
        JOIN analyses an ON a.id = an.audio_file_id
        WHERE a.status = 'completed'
        ${dateFilter}
    `, ...dateParams);
}

// Helper function to fetch analyses for a manager
async function fetchManagerAnalyses(db, managerId, dateFilterObj) {
    const { filter: dateFilter, params: dateParams = [] } = dateFilterObj || { filter: '', params: [] };
    return await db.all(`
        SELECT an.*, a.upload_date, t.segments as transcription_segments
        FROM analyses an
        JOIN audio_files a ON an.audio_file_id = a.id
        LEFT JOIN transcriptions t ON a.id = t.audio_file_id
        WHERE a.manager_id = ? AND a.status = 'completed'
        ${dateFilter}
    `, ...dateParams, managerId);
}

// Helper function to parse JSON fields from analysis
function parseAnalysisData(analysis, categoryKeys = null) {
    let critScores = {};
    let mistakes = {};
    let complaints = {};

    try {
        critScores = (analysis.criteria_scores && analysis.criteria_scores !== 'null')
            ? JSON.parse(analysis.criteria_scores) : {};
    } catch (e) {
        console.error('Error parsing criteria_scores:', e);
    }

    try {
        // First try to read from category_mistakes (if it exists from newer data)
        if (analysis.category_mistakes && analysis.category_mistakes !== 'null') {
            mistakes = JSON.parse(analysis.category_mistakes);
        }
        // Otherwise, read from mistakes array and transform it
        else if (analysis.mistakes && analysis.mistakes !== 'null') {
            const mistakesArray = JSON.parse(analysis.mistakes);
            // Use analysis category, or first available category from categoryKeys, or 'default'
            let category = analysis.category;
            if (!category && categoryKeys && categoryKeys.size > 0) {
                category = Array.from(categoryKeys)[0];
            }
            if (!category) {
                category = 'default';
            }

            mistakes = {};
            mistakes[category] = {};

            if (Array.isArray(mistakesArray)) {
                mistakesArray.forEach(mistakeObj => {
                    const mistakeKey = mistakeObj.mistake || 'Unknown mistake';
                    const recommendation = mistakeObj.recommendation || '';
                    const tag = mistakeObj.tag || 'other';

                    // Store mistake with count, recommendation, and tag
                    if (!mistakes[category][mistakeKey]) {
                        mistakes[category][mistakeKey] = {
                            count: 0,
                            recommendation: recommendation,
                            tag: tag
                        };
                    }
                    mistakes[category][mistakeKey].count += 1;
                    // Keep the first recommendation and tag encountered (or update if empty)
                    if (!mistakes[category][mistakeKey].recommendation && recommendation) {
                        mistakes[category][mistakeKey].recommendation = recommendation;
                    }
                    if (!mistakes[category][mistakeKey].tag && tag) {
                        mistakes[category][mistakeKey].tag = tag;
                    }
                });
            }
        } else {
            mistakes = {};
        }
    } catch (e) {
        console.error('Error parsing mistakes:', e);
        console.error('Analysis mistakes field:', analysis.mistakes);
        console.error('Analysis category_mistakes field:', analysis.category_mistakes);
        mistakes = {};
    }

    try {
        // First try to read from client_complaints (if it exists from newer data)
        if (analysis.client_complaints && analysis.client_complaints !== 'null') {
            const parsedComplaints = JSON.parse(analysis.client_complaints);
            // Check if it's already in tag-based format (has tag property)
            // Otherwise, convert old format to tag-based format
            complaints = {};
            if (typeof parsedComplaints === 'object' && !Array.isArray(parsedComplaints)) {
                Object.entries(parsedComplaints).forEach(([key, count]) => {
                    // If key looks like a tag (simple word), use it as tag
                    // Otherwise, treat as 'other' tag
                    const tag = key.length < 50 && !key.includes('.') ? key : 'other';
                    if (!complaints[tag]) {
                        complaints[tag] = { count: 0, examples: [], textCounts: {} };
                    }
                    const numCount = typeof count === 'number' ? count : parseInt(String(count)) || 0;
                    complaints[tag].count += numCount;
                    // Store example text if available
                    if (key.length > 50 || key.includes('.')) {
                        complaints[tag].examples.push(key);
                        // Track count for this text
                        if (!complaints[tag].textCounts[key]) {
                            complaints[tag].textCounts[key] = 0;
                        }
                        complaints[tag].textCounts[key] += numCount;
                    }
                });
            }
        }
        // Otherwise, read from objections array and transform it by tag
        else if (analysis.objections && analysis.objections !== 'null') {
            const objectionsArray = JSON.parse(analysis.objections);
            complaints = {};

            if (Array.isArray(objectionsArray)) {
                objectionsArray.forEach(obj => {
                    const tag = obj.tag || 'other';
                    if (!complaints[tag]) {
                        complaints[tag] = { count: 0, examples: [], textCounts: {} };
                    }
                    complaints[tag].count += 1;
                    // Store example text and track count per text
                    if (obj.text) {
                        complaints[tag].examples.push(obj.text);
                        // Track count per unique text
                        if (!complaints[tag].textCounts[obj.text]) {
                            complaints[tag].textCounts[obj.text] = 0;
                        }
                        complaints[tag].textCounts[obj.text] += 1;
                    }
                });
            }
        }
    } catch (e) {
        console.error('Error parsing client_complaints/objections:', e);
        console.error('Analysis objections field:', analysis.objections);
        console.error('Analysis client_complaints field:', analysis.client_complaints);
        complaints = {};
    }

    return { critScores, mistakes, complaints };
}

// Helper function to initialize aggregation structures
function initializeAggregationStructures(categoryKeys) {
    const categoryScores = {};
    const categoryCounts = {};
    const criteriaScores = {};
    const categoryMistakes = {};

    for (const key of categoryKeys) {
        categoryScores[key] = [];
        categoryCounts[key] = 0;
        criteriaScores[key] = {};
        categoryMistakes[key] = {};
    }

    return { categoryScores, categoryCounts, criteriaScores, categoryMistakes };
}

// Helper function to aggregate criteria scores
function aggregateCriteriaScores(critScores, criteriaScores, criterionToCategory, categoryKeys, analysis) {
    for (const [criterionName, score] of Object.entries(critScores)) {
        const dbCategoryName = criterionToCategory[criterionName];
        if (dbCategoryName) {
            if (!criteriaScores[dbCategoryName]) criteriaScores[dbCategoryName] = {};
            if (!criteriaScores[dbCategoryName][criterionName]) {
                criteriaScores[dbCategoryName][criterionName] = [];
            }
            criteriaScores[dbCategoryName][criterionName].push(score);
        } else {
            const fallbackCategory = analysis.category || (categoryKeys.size > 0 ? Array.from(categoryKeys)[0] : 'default');
            if (!criteriaScores[fallbackCategory]) criteriaScores[fallbackCategory] = {};
            if (!criteriaScores[fallbackCategory][criterionName]) {
                criteriaScores[fallbackCategory][criterionName] = [];
            }
            criteriaScores[fallbackCategory][criterionName].push(score);
        }
    }
}

// Helper function to aggregate mistakes
function aggregateMistakes(mistakes, categoryMistakes) {
    for (const [cat, mistakeData] of Object.entries(mistakes)) {
        if (!categoryMistakes[cat]) categoryMistakes[cat] = {};
        for (const [mistake, mistakeInfo] of Object.entries(mistakeData)) {
            // Handle both old format (just count) and new format (object with count, recommendation, and tag)
            if (typeof mistakeInfo === 'number') {
                // Legacy format: just a count
                if (!categoryMistakes[cat][mistake]) {
                    categoryMistakes[cat][mistake] = { count: 0, recommendation: '', tag: 'other' };
                }
                categoryMistakes[cat][mistake].count += mistakeInfo;
            } else {
                // New format: object with count, recommendation, and tag
                if (!categoryMistakes[cat][mistake]) {
                    categoryMistakes[cat][mistake] = {
                        count: 0,
                        recommendation: mistakeInfo.recommendation || '',
                        tag: mistakeInfo.tag || 'other'
                    };
                }
                categoryMistakes[cat][mistake].count += mistakeInfo.count || 1;
                // Keep the first recommendation and tag encountered (or update if empty)
                if (!categoryMistakes[cat][mistake].recommendation && mistakeInfo.recommendation) {
                    categoryMistakes[cat][mistake].recommendation = mistakeInfo.recommendation;
                }
                if (!categoryMistakes[cat][mistake].tag && mistakeInfo.tag) {
                    categoryMistakes[cat][mistake].tag = mistakeInfo.tag;
                }
            }
        }
    }
}

// Helper function to aggregate complaints
function aggregateComplaints(complaints, clientComplaints) {
    for (const [tag, data] of Object.entries(complaints)) {
        if (typeof data === 'object' && data !== null && 'count' in data) {
            // New format: { count: number, examples: string[], textCounts: {} }
            if (!clientComplaints[tag]) {
                clientComplaints[tag] = { count: 0, examples: [], textCounts: {} };
            }
            clientComplaints[tag].count += data.count || 0;
            // Merge examples (keep unique ones, no limit - store all objection texts)
            if (data.examples && Array.isArray(data.examples)) {
                data.examples.forEach(example => {
                    if (!clientComplaints[tag].examples.includes(example)) {
                        clientComplaints[tag].examples.push(example);
                    }
                });
            }
            // Merge text counts to track occurrences per unique text
            if (data.textCounts && typeof data.textCounts === 'object') {
                Object.entries(data.textCounts).forEach(([text, count]) => {
                    if (!clientComplaints[tag].textCounts[text]) {
                        clientComplaints[tag].textCounts[text] = 0;
                    }
                    clientComplaints[tag].textCounts[text] += (typeof count === 'number' ? count : parseInt(String(count)) || 0);
                });
            }
        } else {
            // Old format: simple count number
            const count = typeof data === 'number' ? data : parseInt(String(data)) || 0;
            const tagKey = tag.length < 50 && !tag.includes('.') ? tag : 'other';
            if (!clientComplaints[tagKey]) {
                clientComplaints[tagKey] = { count: 0, examples: [], textCounts: {} };
            }
            clientComplaints[tagKey].count += count;
            if (tag.length > 50 || tag.includes('.')) {
                if (!clientComplaints[tagKey].examples.includes(tag)) {
                    clientComplaints[tagKey].examples.push(tag);
                }
                // For old format, treat the tag itself as text with count 1
                if (!clientComplaints[tagKey].textCounts[tag]) {
                    clientComplaints[tagKey].textCounts[tag] = 0;
                }
                clientComplaints[tagKey].textCounts[tag] += count;
            }
        }
    }
}


// Helper function to calculate talk ratio and duration from segments with timestamps
function calculateTalkRatioWithTimestamps(segments) {
    let managerTime = 0;
    let customerTime = 0;
    let callDuration = 0;
    let maxEndTime = 0;

    const sortedSegments = [...segments].sort((a, b) => {
        const timeA = parseTimestamp(a.timestamp);
        const timeB = parseTimestamp(b.timestamp);
        if (timeA === null) return 1;
        if (timeB === null) return -1;
        return timeA - timeB;
    });

    for (let i = 0; i < sortedSegments.length; i++) {
        const seg = sortedSegments[i];
        const speaker = (seg.speaker || '').toLowerCase();

        if (speaker === 'system') {
            continue;
        }

        const startTime = parseTimestamp(seg.timestamp);
        if (startTime === null) {
            continue;
        }

        let segmentDuration = 0;
        let nextStartTime = null;
        for (let j = i + 1; j < sortedSegments.length; j++) {
            const nextTime = parseTimestamp(sortedSegments[j].timestamp);
            if (nextTime !== null && nextTime > startTime) {
                nextStartTime = nextTime;
                break;
            }
        }

        if (nextStartTime !== null) {
            segmentDuration = nextStartTime - startTime;
        } else {
            const wordCount = (seg.text || '').split(/\s+/).length;
            segmentDuration = Math.max(2, Math.round(wordCount / 2.5));
        }

        if (speaker === 'manager') {
            managerTime += segmentDuration;
        } else if (speaker === 'client') {
            customerTime += segmentDuration;
        }

        // Track the maximum end time across all segments
        const endTime = startTime + segmentDuration;
        if (endTime > maxEndTime) {
            maxEndTime = endTime;
        }
    }

    // Use the maximum end time as the call duration
    callDuration = maxEndTime;

    return { managerTime, customerTime, callDuration };
}

// Helper function to calculate talk ratio and duration from segments without timestamps
function calculateTalkRatioWithoutTimestamps(segments) {
    let managerTime = 0;
    let customerTime = 0;
    const wordsPerSecond = 2.5;

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const speaker = (seg.speaker || '').toLowerCase();
        if (speaker === 'system') {
            continue;
        }

        const wordCount = (seg.text || '').split(/\s+/).length;
        const segmentDuration = Math.max(1, Math.round(wordCount / wordsPerSecond));

        if (speaker === 'manager') {
            managerTime += segmentDuration;
        } else if (speaker === 'client') {
            customerTime += segmentDuration;
        }
    }

    const totalTalkTime = managerTime + customerTime;
    const callDuration = Math.round(totalTalkTime / 0.6);

    return { managerTime, customerTime, callDuration };
}

// Helper function to calculate talk ratio and duration from transcription segments
function calculateTalkRatioAndDuration(transcriptionSegments) {
    try {
        const segments = JSON.parse(transcriptionSegments);

        if (segments.length === 0) {
            return { talkRatio: null, duration: null };
        }

        const hasTimestamps = segments.some(seg => seg.timestamp && parseTimestamp(seg.timestamp) !== null);

        let managerTime, customerTime, callDuration;

        if (hasTimestamps) {
            const result = calculateTalkRatioWithTimestamps(segments);
            managerTime = result.managerTime;
            customerTime = result.customerTime;
            callDuration = result.callDuration;
        } else {
            const result = calculateTalkRatioWithoutTimestamps(segments);
            managerTime = result.managerTime;
            customerTime = result.customerTime;
            callDuration = result.callDuration;
        }

        const totalTime = managerTime + customerTime;

        const talkRatio = totalTime > 0 ? {
            manager: Math.round((managerTime / totalTime) * 100),
            customer: Math.round((customerTime / totalTime) * 100)
        } : null;

        return { talkRatio, duration: callDuration > 0 ? callDuration : null };
    } catch (e) {
        console.error('❌ Error calculating talk ratio:', e);
        console.error('Stack:', e.stack);
        return { talkRatio: null, duration: null };
    }
}

// Helper function to calculate averages
function calculateAverages(categoryScores, criteriaScores, talkRatios, durations) {
    const avgCategoryScores = {};
    for (const [cat, scores] of Object.entries(categoryScores)) {
        if (scores.length > 0) {
            avgCategoryScores[cat] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        }
    }

    const avgCriteriaScores = {};
    for (const [cat, criteria] of Object.entries(criteriaScores)) {
        avgCriteriaScores[cat] = {};
        for (const [criterion, scores] of Object.entries(criteria)) {
            if (scores.length > 0) {
                avgCriteriaScores[cat][criterion] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
            }
        }
    }

    let avgTalkRatio = { manager: 50, customer: 50 };
    if (talkRatios.length > 0) {
        const totalManagerRatio = talkRatios.reduce((sum, r) => {
            return sum + r.manager;
        }, 0);
        const avgOp = Math.round(totalManagerRatio / talkRatios.length);
        avgTalkRatio = { manager: avgOp, customer: 100 - avgOp };
    }

    const avgDuration = durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;

    return { avgCategoryScores, avgCriteriaScores, avgTalkRatio, avgDuration };
}

// Helper function to process analyses for a manager
function processManagerAnalyses(analyses, categoryKeys, criterionToCategory) {
    const { categoryScores, categoryCounts, criteriaScores, categoryMistakes } =
        initializeAggregationStructures(categoryKeys);

    const clientComplaints = {};
    const durations = [];
    const talkRatios = [];
    let totalScore = 0;

    for (const analysis of analyses) {
        const { critScores, mistakes, complaints } = parseAnalysisData(analysis, categoryKeys);
        totalScore += analysis.overall_score || 0;

        // Since each analysis belongs to one category, calculate category score from criteria scores
        // and aggregate by the analysis category
        if (analysis.category && categoryKeys.has(analysis.category)) {
            // Calculate average of all criteria scores for this analysis
            const scoreValues = Object.values(critScores).filter(v => typeof v === 'number');
            if (scoreValues.length > 0) {
                const avgScore = Math.round(
                    scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length
                );
                if (!categoryScores[analysis.category]) {
                    categoryScores[analysis.category] = [];
                }
                categoryScores[analysis.category].push(avgScore);
                categoryCounts[analysis.category] = (categoryCounts[analysis.category] || 0) + 1;
            }
        }

        aggregateCriteriaScores(critScores, criteriaScores, criterionToCategory, categoryKeys, analysis);
        aggregateMistakes(mistakes, categoryMistakes);
        aggregateComplaints(complaints, clientComplaints);

        if (analysis.transcription_segments) {
            const { talkRatio, duration } = calculateTalkRatioAndDuration(analysis.transcription_segments);
            if (talkRatio) {
                talkRatios.push(talkRatio);
            }
            if (duration) {
                durations.push(duration);
            }
        }
    }

    const { avgCategoryScores, avgCriteriaScores, avgTalkRatio, avgDuration } =
        calculateAverages(categoryScores, criteriaScores, talkRatios, durations);

    return {
        totalScore,
        avgCategoryScores,
        categoryCounts,
        avgCriteriaScores,
        avgTalkRatio,
        avgDuration,
        categoryMistakes,
        clientComplaints
    };
}

// GET /api/managers/stats
async function getManagerStats(req, res) {
    try {
        const db = req.companyDb;
        const { period, startDate, endDate } = req.query;

        const dateFilterObj = buildDateFilter(period, startDate, endDate);
        const { categoryKeys, criterionToCategory } = await fetchCategoriesAndMappings(db);
        const managers = await fetchManagers(db, dateFilterObj);

        if (!managers || managers.length === 0) {
            return res.json([]);
        }

        const result = [];

        for (const manager of managers) {
            const analyses = await fetchManagerAnalyses(db, manager.id, dateFilterObj);

            if (analyses.length === 0) {
                continue;
            }

            const stats = processManagerAnalyses(analyses, categoryKeys, criterionToCategory);

            result.push({
                id: manager.id,
                name: manager.name,
                total_audios: analyses.length,
                average_score: Math.round(stats.totalScore / analyses.length),
                category_scores: stats.avgCategoryScores,
                category_counts: stats.categoryCounts,
                criteria_scores: stats.avgCriteriaScores,
                talk_ratio: stats.avgTalkRatio,
                average_duration: stats.avgDuration,
                category_mistakes: stats.categoryMistakes,
                client_complaints: stats.clientComplaints
            });
        }

        res.json(result);
    } catch (error) {
        console.error('Error fetching manager stats:', error);
        res.status(500).json({ error: error.message });
    }
}

// GET /api/managers/:id/history
async function getManagerHistory(req, res) {
    try {
        const db = req.companyDb;
        const { period, startDate, endDate } = req.query;

        const { filter: dateFilter, params: dateParams } = buildDateFilter(period, startDate, endDate);
        const params = [...dateParams, req.params.id];

        const history = await db.all(`
            SELECT a.upload_date::date as upload_date, an.overall_score
            FROM audio_files a
            JOIN analyses an ON a.id = an.audio_file_id
            WHERE a.manager_id = ? AND a.status = 'completed'
            ${dateFilter}
            ORDER BY a.upload_date ASC
        `, ...params);

        // Group by date and average scores for same date
        const groupedHistory = {};
        for (const row of history) {
            const date = row.upload_date;
            if (!groupedHistory[date]) {
                groupedHistory[date] = { scores: [] };
            }
            groupedHistory[date].scores.push(row.overall_score);
        }

        const result = Object.entries(groupedHistory).map(([date, data]) => ({
            upload_date: date,
            overall_score: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
        }));

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// GET /api/stats/volume
async function getVolumeStats(req, res) {
    try {
        const db = req.companyDb;
        const { period, startDate, endDate, managerIds } = req.query;

        // Build date filter with parameters (PostgreSQL syntax)
        const { filter: dateFilter, params: dateParams = [] } = buildDateFilter(period, startDate, endDate);
        let managerFilter = '';
        const params = [...dateParams];

        // Handle 'all' period
        if (period === 'all') {
            const allDateFilter = `AND a.upload_date::date >= CURRENT_DATE - INTERVAL '90 days'`;
            // Combine with existing dateFilter (which might be empty for 'all')
            // For 'all', we replace the empty filter with the 90-day filter
            const finalDateFilter = dateFilter || allDateFilter;
            // For now, just add it if dateFilter is empty
            // Actually, let's just use the allDateFilter directly
        }

        // Build manager filter
        if (managerIds && managerIds.length > 0) {
            const ids = Array.isArray(managerIds) ? managerIds : managerIds.split(',');
            const validIds = ids.filter(id => id && id !== '' && !isNaN(parseInt(id)));
            if (validIds.length > 0) {
                const placeholders = validIds.map(() => '?').join(',');
                managerFilter = ` AND a.manager_id IN (${placeholders})`;
                params.push(...validIds.map(id => parseInt(id)));
            }
        }

        // Use the all period filter if needed
        const finalDateFilter = (period === 'all')
            ? `AND a.upload_date::date >= CURRENT_DATE - INTERVAL '90 days'`
            : dateFilter;

        // Get call volume by date and manager
        let volumeData;
        try {
            volumeData = await db.all(`
                SELECT 
                    a.upload_date::date as date,
                    o.id as manager_id,
                    o.name as manager_name,
                    COUNT(*) as count
                FROM audio_files a
                JOIN managers o ON a.manager_id = o.id
                WHERE a.status = 'completed'
                ${finalDateFilter}${managerFilter}
                GROUP BY a.upload_date::date, o.id, o.name
                ORDER BY a.upload_date::date ASC
            `, ...params);
        } catch (sqlError) {
            console.error('SQL Error in volume stats:', sqlError);
            console.error('Query params:', { period, startDate, endDate, managerIds, dateFilter, params });
            throw sqlError;
        }

        // Format response: group by date, include total and per-manager counts
        const result = {};
        for (const row of volumeData) {
            const date = row.date;
            if (!result[date]) {
                result[date] = {
                    date: date,
                    total: 0,
                    managers: {}
                };
            }
            result[date].total += row.count;
            result[date].managers[row.manager_name] = row.count;
        }

        // Convert to array format
        const formattedResult = Object.values(result).map(item => ({
            date: item.date,
            count: item.total,
            ...item.managers
        }));

        res.json(formattedResult);
    } catch (error) {
        console.error('Error fetching volume stats:', error);
        console.error('Stack:', error.stack);
        res.status(500).json({ error: error.message, details: error.stack });
    }
}

// GET /api/audio/:id/stats
async function getAudioStats(req, res) {
    try {
        const db = req.companyDb;
        const { id } = req.params;

        // Get audio file with manager info
        const file = await db.get(`
            SELECT a.*, m.name as manager_name 
            FROM audio_files a 
            LEFT JOIN managers m ON a.manager_id = m.id 
            WHERE a.id = ?
        `, id);

        if (!file) {
            return res.status(404).json({ error: 'Audio file not found' });
        }

        // Get analysis
        const analysis = await db.get('SELECT * FROM analyses WHERE audio_file_id = ?', id);

        if (!analysis) {
            return res.status(404).json({ error: 'Analysis not found for this audio file' });
        }

        // Get transcription for talk ratio calculation
        const transcription = await db.get('SELECT segments FROM transcriptions WHERE audio_file_id = ?', id);

        // Parse analysis data
        const { categoryKeys } = await fetchCategoriesAndMappings(db);
        const { critScores, mistakes, complaints } = parseAnalysisData(analysis, categoryKeys);

        // Calculate talk ratio and duration
        let talkRatio = null;
        let duration = null;
        if (transcription && transcription.segments) {
            const talkRatioData = calculateTalkRatioAndDuration(transcription.segments);
            talkRatio = talkRatioData.talkRatio;
            duration = talkRatioData.duration;
        }

        // Format response
        const stats = {
            file: {
                id: file.id,
                original_name: file.original_name,
                manager_name: file.manager_name,
                upload_date: file.upload_date,
                status: file.status
            },
            overall_score: analysis.overall_score || 0,
            criteria_scores: critScores || {},
            category_mistakes: mistakes || {},
            client_complaints: complaints || {},
            talk_ratio: talkRatio,
            duration: duration
        };

        res.json(stats);
    } catch (error) {
        console.error('Error fetching audio stats:', error);
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    getManagerStats,
    getManagerHistory,
    getVolumeStats,
    getAudioStats
};
