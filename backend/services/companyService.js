const { getMainDb } = require('../database/mainDatabase');
const { createCompanyDatabase, deleteCompanyDatabase, getCompanyDatabase } = require('../database/companyDatabase');
const { hashPassword } = require('../utils/password');
const { parseTimestamp } = require('../utils/timestamp');

/**
 * Create a new company with company database
 * @param {Object} companyData - Company data
 * @returns {Promise<Object>} Created company
 */
async function createCompany(companyData) {
    const db = getMainDb();

    // Generate database name (sanitized company name)
    const databaseName = `company_${companyData.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;

    // Start transaction
    const tx = await db.beginTransaction();

    try {
        // Create company record
        const companyResult = await tx.run(
            `INSERT INTO companies (name, database_name, plan_id, extra_managers, extra_hours) 
             VALUES (?, ?, ?, ?, ?)`,
            companyData.name,
            databaseName,
            companyData.plan_id || null,
            companyData.extra_managers || 0,
            companyData.extra_hours || 0
        );

        const companyId = companyResult.lastID;

        // Commit transaction before creating company database (external operation)
        await tx.commit();

        // Create company database (PostgreSQL) - outside transaction as it's a DDL operation
        await createCompanyDatabase(databaseName, companyId);

        // Start new transaction for user creation
        const tx2 = await db.beginTransaction();
        try {
            // Create company admin user if provided
            let adminUser = null;
            if (companyData.adminUsername && companyData.adminPassword) {
                const passwordHash = await hashPassword(companyData.adminPassword);
                const userResult = await tx2.run(
                    `INSERT INTO users (username, password_hash, role, company_id) 
                     VALUES (?, ?, ?, ?)`,
                    companyData.adminUsername,
                    passwordHash,
                    'company',
                    companyId
                );
                adminUser = {
                    id: userResult.lastID,
                    username: companyData.adminUsername,
                    role: 'company'
                };
            }
            await tx2.commit();

            return {
                id: companyId,
                name: companyData.name,
                databaseName,
                adminUser
            };
        } catch (error) {
            await tx2.rollback();
            throw error;
        }
    } catch (error) {
        await tx.rollback();

        // Clean up database if company creation failed
        try {
            await deleteCompanyDatabase(databaseName);
        } catch (cleanupError) {
            // Ignore cleanup errors
        }

        throw error;
    }
}

/**
 * Get all companies
 * @returns {Promise<Array>} List of companies
 */
async function getAllCompanies(includeUsage = false) {
    const db = getMainDb();

    const companies = await db.all(
        `SELECT c.id, c.name, c.database_name, c.plan_id, c.extra_managers, c.extra_hours, 
                c.created_at, c.updated_at,
                COUNT(u.id) as user_count,
                p.name as plan_name, p.price as plan_price, p.max_managers, p.hours_per_manager,
                p.price_per_manager, p.price_per_hour
         FROM companies c
         LEFT JOIN users u ON c.id = u.company_id
         LEFT JOIN pricing_plans p ON c.plan_id = p.id
         GROUP BY c.id, c.name, c.database_name, c.plan_id, c.extra_managers, c.extra_hours, 
                  c.created_at, c.updated_at, p.name, p.price, p.max_managers, p.hours_per_manager,
                  p.price_per_manager, p.price_per_hour
         ORDER BY c.created_at DESC`
    );

    // Optionally include usage data for each company
    if (includeUsage) {
        for (const company of companies) {
            try {
                const usage = await getCompanyUsage(company.id);
                company.usage = usage;
            } catch (error) {
                console.error(`Error fetching usage for company ${company.id}:`, error);
                company.usage = null;
            }
        }
    }

    return companies;
}

/**
 * Get company by ID
 * @param {number} companyId - Company ID
 * @returns {Promise<Object>} Company object
 */
async function getCompanyById(companyId) {
    const db = getMainDb();

    const company = await db.get(
        `SELECT c.id, c.name, c.database_name, c.plan_id, c.extra_managers, c.extra_hours,
                c.created_at, c.updated_at,
                p.name as plan_name, p.description as plan_description, p.price as plan_price, 
                p.max_managers, p.hours_per_manager, p.price_per_manager, p.price_per_hour
         FROM companies c
         LEFT JOIN pricing_plans p ON c.plan_id = p.id
         WHERE c.id = ?`,
        companyId
    );

    if (!company) {
        throw new Error('Company not found');
    }

    // Get company users
    const users = await db.all(
        `SELECT id, username, role, created_at
         FROM users
         WHERE company_id = ?
         ORDER BY created_at DESC`,
        companyId
    );

    return {
        ...company,
        users
    };
}

/**
 * Update company
 * @param {number} companyId - Company ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated company
 */
async function updateCompany(companyId, updateData) {
    const db = getMainDb();

    // Check if company exists
    const company = await db.get('SELECT id FROM companies WHERE id = ?', companyId);
    if (!company) {
        throw new Error('Company not found');
    }

    // Build update query
    const updates = [];
    const values = [];

    if (updateData.name !== undefined) {
        updates.push('name = ?');
        values.push(updateData.name);
    }

    if (updateData.plan_id !== undefined) {
        // Validate plan_id if provided
        if (updateData.plan_id !== null) {
            const plan = await db.get('SELECT id FROM pricing_plans WHERE id = ?', updateData.plan_id);
            if (!plan) {
                throw new Error('Pricing plan not found');
            }
        }
        updates.push('plan_id = ?');
        values.push(updateData.plan_id);
    }

    if (updateData.extra_managers !== undefined) {
        updates.push('extra_managers = ?');
        values.push(updateData.extra_managers);
    }

    if (updateData.extra_hours !== undefined) {
        updates.push('extra_hours = ?');
        values.push(updateData.extra_hours);
    }

    if (updates.length === 0) {
        throw new Error('No fields to update');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(companyId);

    await db.run(
        `UPDATE companies SET ${updates.join(', ')} WHERE id = ?`,
        ...values
    );

    return getCompanyById(companyId);
}

/**
 * Delete company and its company database
 * @param {number} companyId - Company ID
 */
async function deleteCompany(companyId) {
    const db = getMainDb();

    // Get company info
    const company = await db.get(
        'SELECT database_name FROM companies WHERE id = ?',
        companyId
    );

    if (!company) {
        throw new Error('Company not found');
    }

    // Delete company database
    await deleteCompanyDatabase(company.database_name);

    // Delete company (cascade will delete users)
    await db.run('DELETE FROM companies WHERE id = ?', companyId);
}

/**
 * Helper function to build date filter (reused from statsController)
 */
function buildDateFilter(period, startDate, endDate) {
    let dateFilter = '';
    if (period === 'custom' && startDate && endDate) {
        dateFilter = `AND a.upload_date::date >= '${startDate}'::date AND a.upload_date::date <= '${endDate}'::date`;
    } else if (period === '7d') {
        dateFilter = `AND a.upload_date::date >= CURRENT_DATE - INTERVAL '7 days'`;
    } else if (period === '30d') {
        dateFilter = `AND a.upload_date::date >= CURRENT_DATE - INTERVAL '30 days'`;
    } else if (period === 'today') {
        dateFilter = `AND a.upload_date::date = CURRENT_DATE`;
    } else if (period === 'all') {
        dateFilter = '';
    }
    return dateFilter;
}


/**
 * Helper function to calculate duration from transcription segments
 */
function calculateDurationFromSegments(transcriptionSegments) {
    try {
        const segments = JSON.parse(transcriptionSegments);

        if (segments.length === 0) {
            return 0;
        }

        const hasTimestamps = segments.some(seg => seg.timestamp && parseTimestamp(seg.timestamp) !== null);

        let callDuration = 0;

        if (hasTimestamps) {
            // Calculate duration with timestamps
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

                const remainingSegments = sortedSegments.slice(i + 1);
                const hasNonSystemRemaining = remainingSegments.some(s => {
                    const sSpeaker = (s.speaker || '').toLowerCase();
                    return sSpeaker === 'manager' || sSpeaker === 'client';
                });

                if (!hasNonSystemRemaining) {
                    callDuration = startTime + segmentDuration;
                }
            }
        } else {
            // Calculate duration without timestamps
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
            callDuration = Math.round(totalTalkTime / 0.6);
        }

        return callDuration > 0 ? callDuration : 0;
    } catch (e) {
        console.error('Error calculating duration from segments:', e);
        return 0;
    }
}

/**
 * Get company statistics
 * @param {number} companyId - Company ID
 * @param {Object} queryParams - Query parameters (period, startDate, endDate)
 * @returns {Promise<Object>} Company statistics
 */
async function getCompanyStats(companyId, queryParams = {}) {
    const db = getMainDb();

    const company = await db.get(
        `SELECT c.id, c.name, c.database_name, c.plan_id, c.extra_managers, c.extra_hours,
                p.hours_per_manager
         FROM companies c
         LEFT JOIN pricing_plans p ON c.plan_id = p.id
         WHERE c.id = ?`,
        companyId
    );

    if (!company) {
        throw new Error('Company not found');
    }

    const companyDb = await getCompanyDatabase(company.database_name);

    // Each manager gets hours_per_manager hours assigned (extra_hours are added to total pool, not per manager)
    const hoursPerManager = Number(company.hours_per_manager) || 0;

    // Get basic counts
    const [
        audioCount,
        managerCount,
        analysisCount,
        categoryCount,
        completedAudioCount
    ] = await Promise.all([
        companyDb.get('SELECT COUNT(*) as count FROM audio_files'),
        companyDb.get('SELECT COUNT(*) as count FROM managers'),
        companyDb.get('SELECT COUNT(*) as count FROM analyses'),
        companyDb.get('SELECT COUNT(*) as count FROM conversation_categories'),
        companyDb.get("SELECT COUNT(*) as count FROM audio_files WHERE status = 'completed'")
    ]);

    // Build date filter for stats
    const { period = 'all', startDate, endDate } = queryParams;
    const dateFilter = buildDateFilter(period, startDate, endDate);

    // Get manager stats - simplified version
    let managerStats = [];
    try {
        // Get categories and mappings
        const dbCategories = await companyDb.all('SELECT name FROM conversation_categories');
        const categoryKeys = new Set(dbCategories.map(cat => cat.name));

        const criteriaMappings = await companyDb.all(`
            SELECT cc.name as criterion_name, cat.name as category_name
            FROM conversation_criteria cc
            JOIN conversation_categories cat ON cc.category_id = cat.id
        `);

        const criterionToCategory = {};
        for (const mapping of criteriaMappings) {
            criterionToCategory[mapping.criterion_name] = mapping.category_name;
        }

        // Get managers
        const managers = await companyDb.all(`
            SELECT DISTINCT m.id, m.name
            FROM managers m
            JOIN audio_files a ON m.id = a.manager_id
            JOIN analyses an ON a.id = an.audio_file_id
            WHERE a.status = 'completed'
            ${dateFilter}
        `);

        // For each manager, get basic stats
        for (const manager of managers) {
            const analyses = await companyDb.all(`
                SELECT an.*, a.upload_date
                FROM analyses an
                JOIN audio_files a ON an.audio_file_id = a.id
                WHERE a.manager_id = ? AND a.status = 'completed'
                ${dateFilter}
            `, manager.id);

            if (analyses.length === 0) continue;

            // Calculate average score
            const totalScore = analyses.reduce((sum, a) => sum + (a.overall_score || 0), 0);
            const avgScore = Math.round(totalScore / analyses.length);

            // Calculate hours used by this manager
            let hoursUsed = 0;
            try {
                const managerTranscriptions = await companyDb.all(`
                    SELECT t.segments
                    FROM transcriptions t
                    JOIN audio_files a ON t.audio_file_id = a.id
                    WHERE a.manager_id = ? AND a.status = 'completed'
                    ${dateFilter}
                `, manager.id);

                let totalSeconds = 0;
                for (const transcription of managerTranscriptions) {
                    if (transcription.segments) {
                        const duration = calculateDurationFromSegments(transcription.segments);
                        totalSeconds += duration;
                    }
                }
                hoursUsed = totalSeconds / 3600;
            } catch (error) {
                console.error(`Error calculating hours for manager ${manager.id}:`, error);
            }

            // Calculate hours assigned and remaining
            // Each manager gets hours_per_manager hours assigned
            const hoursAssigned = Number(hoursPerManager) || 0;
            const hoursRemaining = Math.max(0, hoursAssigned - hoursUsed);

            managerStats.push({
                id: manager.id,
                name: manager.name,
                total_audios: analyses.length,
                average_score: avgScore,
                hours_assigned: parseFloat(Number(hoursAssigned).toFixed(2)),
                hours_used: parseFloat(Number(hoursUsed).toFixed(2)),
                hours_remaining: parseFloat(Number(hoursRemaining).toFixed(2))
            });
        }
    } catch (error) {
        console.error('Error fetching manager stats:', error);
        managerStats = [];
    }

    // Get volume stats
    let volumeStats = [];
    try {
        const volumeData = await companyDb.all(`
            SELECT 
                a.upload_date::date as date,
                COUNT(*) as count
            FROM audio_files a
            WHERE a.status = 'completed'
            ${dateFilter}
            GROUP BY a.upload_date::date
            ORDER BY a.upload_date::date ASC
        `);

        volumeStats = volumeData.map(row => ({
            date: row.date,
            count: row.count
        }));
    } catch (error) {
        console.error('Error fetching volume stats:', error);
        volumeStats = [];
    }

    // Calculate overall average score
    let avgScore = 0;
    try {
        const avgScoreResult = await companyDb.get(`
            SELECT AVG(an.overall_score) as avg_score
            FROM analyses an
            JOIN audio_files a ON an.audio_file_id = a.id
            WHERE a.status = 'completed'
            ${dateFilter}
        `);
        avgScore = avgScoreResult?.avg_score ? Math.round(avgScoreResult.avg_score) : 0;
    } catch (error) {
        console.error('Error calculating average score:', error);
    }

    // Calculate total duration of analyzed audios
    let totalDuration = 0;
    try {
        const transcriptions = await companyDb.all(`
            SELECT t.segments
            FROM transcriptions t
            JOIN audio_files a ON t.audio_file_id = a.id
            WHERE a.status = 'completed'
            ${dateFilter}
        `);

        for (const transcription of transcriptions) {
            if (transcription.segments) {
                const duration = calculateDurationFromSegments(transcription.segments);
                totalDuration += duration;
            }
        }
    } catch (error) {
        console.error('Error calculating total duration:', error);
    }

    return {
        company: {
            id: company.id,
            name: company.name,
            database_name: company.database_name
        },
        summary: {
            totalAudioFiles: audioCount.count,
            completedAudioFiles: completedAudioCount.count,
            managers: managerCount.count,
            analyses: analysisCount.count,
            categories: categoryCount.count,
            averageScore: avgScore,
            totalDuration: totalDuration // in seconds
        },
        managerStats: managerStats,
        volumeStats: volumeStats
    };
}

/**
 * Get company usage (current managers and hours)
 * @param {number} companyId - Company ID
 * @returns {Promise<Object>} Company usage information
 */
async function getCompanyUsage(companyId) {
    const db = getMainDb();

    const company = await db.get(
        `SELECT c.id, c.name, c.database_name, c.plan_id, c.extra_managers, c.extra_hours,
                p.max_managers, p.hours_per_manager
         FROM companies c
         LEFT JOIN pricing_plans p ON c.plan_id = p.id
         WHERE c.id = ?`,
        companyId
    );

    if (!company) {
        throw new Error('Company not found');
    }

    if (!company.database_name) {
        throw new Error(`Company ${companyId} does not have a database_name configured`);
    }

    const companyDb = await getCompanyDatabase(company.database_name);

    // Get current manager count
    const managerCountResult = await companyDb.get('SELECT COUNT(DISTINCT id) as count FROM managers');
    const currentManagers = managerCountResult?.count || 0;

    // Get total hours analyzed (from completed audio files)
    let totalHours = 0;
    try {
        const transcriptions = await companyDb.all(`
            SELECT t.segments
            FROM transcriptions t
            JOIN audio_files a ON t.audio_file_id = a.id
            WHERE a.status = 'completed'
        `);

        let totalSeconds = 0;
        for (const transcription of transcriptions) {
            if (transcription.segments) {
                const duration = calculateDurationFromSegments(transcription.segments);
                totalSeconds += duration;
            }
        }
        // Convert seconds to hours
        totalHours = totalSeconds / 3600;
    } catch (error) {
        console.error('Error calculating total hours:', error);
    }

    // Calculate limits - ensure proper numeric conversion
    const maxManagers = parseFloat(company.max_managers || 0) + parseFloat(company.extra_managers || 0);
    const hoursPerManager = parseFloat(company.hours_per_manager || 0);
    const extraHours = parseFloat(company.extra_hours || 0);
    const maxHours = maxManagers * hoursPerManager + extraHours;

    // Debug: Log values to help diagnose calculation issues
    console.log(`[getCompanyUsage] Company ${companyId}: max_managers=${company.max_managers} (parsed: ${parseFloat(company.max_managers || 0)}), extra_managers=${company.extra_managers} (parsed: ${parseFloat(company.extra_managers || 0)}), hours_per_manager=${company.hours_per_manager} (parsed: ${hoursPerManager}), extra_hours=${company.extra_hours} (parsed: ${extraHours})`);
    console.log(`[getCompanyUsage] Calculated: ${maxManagers} managers * ${hoursPerManager} hours = ${maxManagers * hoursPerManager}, + ${extraHours} extra = ${maxHours} total hours`);

    return {
        currentManagers,
        currentHours: totalHours,
        maxManagers,
        maxHours,
        managersUsed: maxManagers > 0 ? (currentManagers / maxManagers) * 100 : 0,
        hoursUsed: maxHours > 0 ? (totalHours / maxHours) * 100 : 0,
        isOverManagersLimit: currentManagers > maxManagers,
        isOverHoursLimit: totalHours > maxHours
    };
}

module.exports = {
    createCompany,
    getAllCompanies,
    getCompanyById,
    updateCompany,
    deleteCompany,
    getCompanyStats,
    getCompanyUsage,
    calculateDurationFromSegments
};
