const { checkManagerLimit } = require('../utils/usageLimits');
const { getMainDb } = require('../database/mainDatabase');
const { calculateDurationFromSegments } = require('../services/companyService');

/**
 * Get all managers for the authenticated company with hours information
 */
async function getManagers(req, res) {
    try {
        const companyId = req.user.company_id;
        const db = getMainDb();

        // Get company plan information
        const company = await db.get(
            `SELECT c.plan_id, p.hours_per_manager
             FROM companies c
             LEFT JOIN pricing_plans p ON c.plan_id = p.id
             WHERE c.id = ?`,
            companyId
        );

        const hoursPerManager = Number(company?.hours_per_manager) || 0;

        // Get all managers
        const managers = await req.companyDb.all('SELECT id, name FROM managers ORDER BY name ASC');

        // Calculate hours for each manager
        const managersWithHours = await Promise.all(
            managers.map(async (manager) => {
                // Calculate hours used by this manager
                let hoursUsed = 0;
                try {
                    const managerTranscriptions = await req.companyDb.all(`
                        SELECT t.segments
                        FROM transcriptions t
                        JOIN audio_files a ON t.audio_file_id = a.id
                        WHERE a.manager_id = ? AND a.status = 'completed'
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
                const hoursAssigned = Number(hoursPerManager) || 0;
                const hoursRemaining = Math.max(0, hoursAssigned - hoursUsed);

                return {
                    id: manager.id,
                    name: manager.name,
                    hours_assigned: parseFloat(Number(hoursAssigned).toFixed(2)),
                    hours_used: parseFloat(Number(hoursUsed).toFixed(2)),
                    hours_remaining: parseFloat(Number(hoursRemaining).toFixed(2))
                };
            })
        );

        res.json(managersWithHours);
    } catch (error) {
        console.error('Error fetching managers:', error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Get manager limit info for the authenticated company
 */
async function getManagerLimits(req, res) {
    try {
        const companyId = req.user.company_id;
        const limitInfo = await checkManagerLimit(companyId);
        const normalizedLimit = {
            ...limitInfo,
            max: Number.isFinite(limitInfo.max) ? limitInfo.max : null,
            unlimited: !Number.isFinite(limitInfo.max)
        };
        res.json(normalizedLimit);
    } catch (error) {
        console.error('Error fetching manager limits:', error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Create a new manager (respects plan limits)
 */
async function createManager(req, res) {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Manager name is required' });
        }

        const trimmedName = name.trim();
        const companyId = req.user.company_id;

        const limitCheck = await checkManagerLimit(companyId);
        if (!limitCheck.allowed) {
            return res.status(403).json({
                error: limitCheck.message || 'Manager limit reached',
                limitInfo: limitCheck
            });
        }

        try {
            const result = await req.companyDb.run('INSERT INTO managers (name) VALUES (?)', trimmedName);
            return res.status(201).json({ id: result.lastID, name: trimmedName });
        } catch (dbError) {
            if (dbError.message && dbError.message.includes('UNIQUE')) {
                return res.status(409).json({ error: 'Manager already exists' });
            }
            throw dbError;
        }
    } catch (error) {
        console.error('Error creating manager:', error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Update an existing manager's name
 */
async function updateManager(req, res) {
    try {
        const { id } = req.params;
        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Manager name is required' });
        }

        const trimmedName = name.trim();

        const existing = await req.companyDb.get('SELECT id FROM managers WHERE id = ?', id);
        if (!existing) {
            return res.status(404).json({ error: 'Manager not found' });
        }

        try {
            await req.companyDb.run('UPDATE managers SET name = ? WHERE id = ?', trimmedName, id);
            res.json({ id: Number(id), name: trimmedName });
        } catch (dbError) {
            if (dbError.message && dbError.message.includes('UNIQUE')) {
                return res.status(409).json({ error: 'Manager already exists' });
            }
            throw dbError;
        }
    } catch (error) {
        console.error('Error updating manager:', error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Delete a manager (only if no audio files are linked)
 */
async function deleteManager(req, res) {
    try {
        const { id } = req.params;

        const manager = await req.companyDb.get('SELECT id FROM managers WHERE id = ?', id);
        if (!manager) {
            return res.status(404).json({ error: 'Manager not found' });
        }

        const usage = await req.companyDb.get('SELECT COUNT(*) as count FROM audio_files WHERE manager_id = ?', id);
        if (usage?.count > 0) {
            return res.status(400).json({
                error: 'Cannot delete manager with uploaded audio files',
                usageCount: usage.count
            });
        }

        await req.companyDb.run('DELETE FROM managers WHERE id = ?', id);
        res.json({ message: 'Manager deleted successfully' });
    } catch (error) {
        console.error('Error deleting manager:', error);
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    getManagers,
    getManagerLimits,
    createManager,
    updateManager,
    deleteManager
};

