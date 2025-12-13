const path = require('path');
const geminiService = require('../services/geminiService');
const { getMimeType } = require('./fileController');
const { getCompanyFilePath } = require('../utils/filePaths');
const { checkHoursLimit } = require('../utils/usageLimits');
const { getAudioDurationHours } = require('../utils/audioDuration');

// Track files that are being processed and should be cancelled
const processingFiles = new Set();
const cancelledFiles = new Set();

function isCancelled(fileId) {
    return cancelledFiles.has(fileId);
}

function markAsProcessing(fileId) {
    processingFiles.add(fileId);
    cancelledFiles.delete(fileId); // Remove from cancelled if it was there
}

function markAsCompleted(fileId) {
    processingFiles.delete(fileId);
    cancelledFiles.delete(fileId);
}

function cancelProcessing(fileId) {
    cancelledFiles.add(fileId);
}

// POST /api/analyze
async function analyzeFiles(req, res) {
    try {
        const { fileIds } = req.body; // Array of audio_file IDs
        const db = req.companyDb;

        if (!fileIds || !Array.isArray(fileIds)) {
            return res.status(400).json({ error: 'Invalid fileIds' });
        }

        // Check hours limit before starting analysis
        const companyId = req.user.company_id;
        if (companyId) {
            // Get actual duration of all files before analysis
            const databaseName = req.user.database_name;
            let totalHours = 0;

            for (const id of fileIds) {
                const fileRecord = await db.get('SELECT filename FROM audio_files WHERE id = ?', id);
                if (fileRecord) {
                    const filePath = getCompanyFilePath(databaseName, fileRecord.filename);
                    const durationHours = await getAudioDurationHours(filePath);
                    totalHours += durationHours;
                }
            }

            const hoursLimitCheck = await checkHoursLimit(companyId, totalHours);
            if (!hoursLimitCheck.allowed) {
                return res.status(403).json({
                    error: hoursLimitCheck.message || 'Hours limit would be exceeded',
                    limitInfo: {
                        current: hoursLimitCheck.current,
                        max: hoursLimitCheck.max,
                        total: totalHours
                    }
                });
            }
        }

        // Process in background (async) - but for this demo we might await or fire-and-forget
        // User requirements say "Press Analyze to process". We can trigger it and return status.
        // For simplicity, we'll process sequentially here but usually a job queue is better.
        // We will trigger processing and return "Processing started".

        // Capture database name before async operation
        const databaseName = req.user.database_name;

        // Using setImmediate to process in background so response isn't blocked
        setImmediate(async () => {
            for (const id of fileIds) {
                try {
                    // Check if cancelled before starting
                    if (isCancelled(id)) {
                        console.log(`Skipping cancelled file ${id}`);
                        cancelledFiles.delete(id);
                        continue;
                    }

                    const fileRecord = await db.get(
                        `SELECT a.*, m.name as manager_name 
                         FROM audio_files a 
                         JOIN managers m ON a.manager_id = m.id 
                         WHERE a.id = ?`,
                        id
                    );

                    if (!fileRecord) continue;

                    // Check if cancelled after fetching file record
                    if (isCancelled(id)) {
                        console.log(`Cancelling file ${id} before processing`);
                        await db.run('UPDATE audio_files SET status = ? WHERE id = ?', 'pending', id);
                        cancelledFiles.delete(id);
                        continue;
                    }

                    // Clean up old transcription and analysis if they exist (for retry)
                    await db.run('DELETE FROM transcriptions WHERE audio_file_id = ?', id);
                    await db.run('DELETE FROM analyses WHERE audio_file_id = ?', id);

                    markAsProcessing(id);
                    await db.run('UPDATE audio_files SET status = ? WHERE id = ?', 'processing', id);

                    // Check if cancelled before uploading
                    if (isCancelled(id)) {
                        console.log(`Cancelling file ${id} before upload`);
                        await db.run('UPDATE audio_files SET status = ? WHERE id = ?', 'pending', id);
                        markAsCompleted(id);
                        continue;
                    }

                    // Use company-specific file path
                    const filePath = getCompanyFilePath(databaseName, fileRecord.filename);
                    const mimeType = getMimeType(fileRecord.filename);

                    // 1. Upload to Gemini
                    const geminiFile = await geminiService.uploadToGemini(filePath, mimeType);

                    // Check if cancelled after upload
                    if (isCancelled(id)) {
                        console.log(`Cancelling file ${id} after upload`);
                        await db.run('UPDATE audio_files SET status = ? WHERE id = ?', 'pending', id);
                        markAsCompleted(id);
                        continue;
                    }

                    // 2. Wait for processing (with cancellation check)
                    let activeFile;
                    try {
                        activeFile = await geminiService.waitForFileActive(geminiFile, () => isCancelled(id));
                    } catch (err) {
                        if (err.message === 'File processing cancelled by user') {
                            console.log(`Cancelling file ${id} during file processing wait`);
                            await db.run('UPDATE audio_files SET status = ? WHERE id = ?', 'pending', id);
                            markAsCompleted(id);
                            continue;
                        }
                        throw err;
                    }

                    // Check if cancelled after waiting for file
                    if (isCancelled(id)) {
                        console.log(`Cancelling file ${id} after file processing`);
                        await db.run('UPDATE audio_files SET status = ? WHERE id = ?', 'pending', id);
                        markAsCompleted(id);
                        continue;
                    }

                    // 3. Transcribe and Analyze in one call (with cancellation check)
                    let result;
                    try {
                        result = await geminiService.transcribeAndAnalyzeAudio(activeFile.uri, mimeType, db, () => isCancelled(id));
                    } catch (err) {
                        if (err.message === 'Analysis cancelled by user') {
                            console.log(`Cancelling file ${id} during analysis`);
                            await db.run('UPDATE audio_files SET status = ? WHERE id = ?', 'pending', id);
                            markAsCompleted(id);
                            continue;
                        }
                        throw err;
                    }

                    // Check if cancelled after analysis
                    if (isCancelled(id)) {
                        console.log(`Cancelling file ${id} after analysis`);
                        await db.run('UPDATE audio_files SET status = ? WHERE id = ?', 'pending', id);
                        markAsCompleted(id);
                        continue;
                    }

                    // Save transcription
                    await db.run(
                        'INSERT INTO transcriptions (audio_file_id, full_text, segments) VALUES (?, ?, ?)',
                        id,
                        result.transcription.full_text,
                        JSON.stringify(result.transcription.segments)
                    );

                    // Save analysis with new fields
                    await db.run(
                        'INSERT INTO analyses (audio_file_id, category, overall_score, criteria_scores, objections, mistakes, mood, feedback, explanation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        id,
                        result.analysis.category || null,
                        result.analysis.overall_score,
                        JSON.stringify(result.analysis.criteria_scores || {}),
                        JSON.stringify(result.analysis.objections || []),
                        JSON.stringify(result.analysis.mistakes || []),
                        JSON.stringify(result.analysis.mood || {}),
                        result.analysis.feedback || result.analysis.explanation || '',
                        result.analysis.explanation || result.analysis.feedback || '' // Keep explanation for backward compatibility
                    );

                    await db.run('UPDATE audio_files SET status = ? WHERE id = ?', 'completed', id);
                    markAsCompleted(id);
                    console.log(`Completed analysis for file ${id}`);

                } catch (err) {
                    // Check if this is a cancellation error
                    if (err.message && err.message.includes('cancelled by user')) {
                        console.log(`File ${id} was cancelled during processing`);
                        await db.run('UPDATE audio_files SET status = ? WHERE id = ?', 'pending', id);
                        markAsCompleted(id);
                    } else {
                        console.error(`Error analyzing file ${id}:`, err);
                        await db.run('UPDATE audio_files SET status = ? WHERE id = ?', 'error', id);
                        markAsCompleted(id);
                    }
                }
            }
        });

        res.json({ message: 'Analysis started', fileIds });

    } catch (error) {
        console.error('Analyze error:', error);
        res.status(500).json({ error: error.message });
    }
}

// POST /api/analyze/stop
async function stopAnalysis(req, res) {
    try {
        const { fileIds } = req.body; // Array of audio_file IDs
        const db = req.companyDb;

        if (!fileIds || !Array.isArray(fileIds)) {
            return res.status(400).json({ error: 'Invalid fileIds' });
        }

        const stoppedFiles = [];

        for (const id of fileIds) {
            // Check if file is actually being processed
            const fileRecord = await db.get('SELECT status FROM audio_files WHERE id = ?', id);

            if (!fileRecord) {
                continue;
            }

            // Only stop files that are processing or pending
            if (fileRecord.status === 'processing' || fileRecord.status === 'pending') {
                cancelProcessing(id);
                await db.run('UPDATE audio_files SET status = ? WHERE id = ?', 'pending', id);
                stoppedFiles.push(id);
            }
        }

        res.json({
            message: stoppedFiles.length > 0
                ? `Stopped analysis for ${stoppedFiles.length} file(s)`
                : 'No files were being processed',
            fileIds: stoppedFiles
        });

    } catch (error) {
        console.error('Stop analysis error:', error);
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    analyzeFiles,
    stopAnalysis
};
