const { getMainDb } = require('../database/mainDatabase');
const { getCompanyDatabase } = require('../database/companyDatabase');
const { calculateDurationFromSegments } = require('../services/companyService');

/**
 * Check if company can add a new manager
 * @param {number} companyId - Company ID
 * @returns {Promise<{allowed: boolean, current: number, max: number, message?: string}>}
 */
async function checkManagerLimit(companyId) {
    const db = getMainDb();

    const company = await db.get(
        `SELECT c.plan_id, c.extra_managers, p.max_managers
         FROM companies c
         LEFT JOIN pricing_plans p ON c.plan_id = p.id
         WHERE c.id = ?`,
        companyId
    );

    if (!company || !company.plan_id) {
        // No plan assigned, allow
        return { allowed: true, current: 0, max: Infinity };
    }

    const companyDb = await getCompanyDatabase(
        (await db.get('SELECT database_name FROM companies WHERE id = ?', companyId)).database_name
    );

    const managerCountResult = await companyDb.get('SELECT COUNT(DISTINCT id) as count FROM managers');
    const currentManagers = managerCountResult?.count || 0;
    const maxManagers = (company.max_managers || 0) + (company.extra_managers || 0);

    if (currentManagers >= maxManagers) {
        return {
            allowed: false,
            current: currentManagers,
            max: maxManagers,
            message: `Manager limit reached. Current: ${currentManagers}, Max: ${maxManagers}`
        };
    }

    return { allowed: true, current: currentManagers, max: maxManagers };
}

/**
 * Check if company can analyze more hours
 * @param {number} companyId - Company ID
 * @param {number} estimatedHours - Estimated hours to add (optional)
 * @returns {Promise<{allowed: boolean, current: number, max: number, message?: string}>}
 */
async function checkHoursLimit(companyId, estimatedHours = 0) {
    const db = getMainDb();

    const company = await db.get(
        `SELECT c.plan_id, c.extra_managers, c.extra_hours, p.max_managers, p.hours_per_manager
         FROM companies c
         LEFT JOIN pricing_plans p ON c.plan_id = p.id
         WHERE c.id = ?`,
        companyId
    );

    if (!company || !company.plan_id) {
        // No plan assigned, allow
        return { allowed: true, current: 0, max: Infinity };
    }

    const companyDb = await getCompanyDatabase(
        (await db.get('SELECT database_name FROM companies WHERE id = ?', companyId)).database_name
    );

    // Get current hours
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
        totalHours = totalSeconds / 3600;
    } catch (error) {
        console.error('Error calculating total hours:', error);
    }

    const maxHours = (parseFloat(company.max_managers || 0) + parseFloat(company.extra_managers || 0)) * parseFloat(company.hours_per_manager || 0) + parseFloat(company.extra_hours || 0);

    if (totalHours + estimatedHours > maxHours) {
        return {
            allowed: false,
            current: totalHours,
            max: maxHours,
            message: `Hours limit would be exceeded. Current: ${totalHours.toFixed(1)}h, Max: ${maxHours.toFixed(1)}h, Adding: ${estimatedHours.toFixed(1)}h`
        };
    }

    return { allowed: true, current: totalHours, max: maxHours };
}

module.exports = {
    checkManagerLimit,
    checkHoursLimit
};
