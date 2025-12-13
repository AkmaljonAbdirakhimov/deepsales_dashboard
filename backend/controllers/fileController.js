const path = require('path');
const fs = require('fs');
const { getCompanyFilePath, getCompanyFileRelativePath } = require('../utils/filePaths');

// Helper function
function getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    switch (ext) {
        case '.mp3': return 'audio/mpeg';
        case '.wav': return 'audio/wav';
        case '.m4a': return 'audio/mp4';
        case '.ogg': return 'audio/ogg';
        default: return 'audio/mpeg'; // Default fallback
    }
}

// POST /api/upload
async function uploadFiles(req, res) {
    try {
        const files = req.files;
        const managerNames = JSON.parse(req.body.managerNames || '[]');
        const managerIds = JSON.parse(req.body.managerIds || '[]');
        const db = req.companyDb;

        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const uploadedFiles = [];

        if (managerIds.length > 0 && managerIds.length !== files.length) {
            return res.status(400).json({ error: 'managerIds length must match files length' });
        }

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const managerIdFromBody = managerIds[i];
            const managerName = managerNames[i];

            let manager = null;

            if (managerIdFromBody) {
                manager = await db.get('SELECT id, name FROM managers WHERE id = ?', managerIdFromBody);
                if (!manager) {
                    return res.status(400).json({ error: `Manager with id ${managerIdFromBody} not found` });
                }
            } else if (managerName) {
                manager = await db.get('SELECT id, name FROM managers WHERE name = ?', managerName);
                if (!manager) {
                    return res.status(400).json({
                        error: `Manager "${managerName}" not found. Please create the manager before uploading files.`
                    });
                }
            } else {
                return res.status(400).json({ error: 'Manager is required for each file' });
            }

            // Save audio file record
            const result = await db.run(
                'INSERT INTO audio_files (filename, original_name, manager_id, status) VALUES (?, ?, ?, ?)',
                file.filename,
                file.originalname,
                manager.id,
                'pending'
            );

            // Add relative path for the uploaded file
            const filePath = getCompanyFileRelativePath(req.user.database_name, file.filename);

            uploadedFiles.push({
                id: result.lastID,
                filename: file.filename,
                file_path: filePath,
                manager: manager.name,
                status: 'pending'
            });
        }

        res.json({ message: 'Files uploaded successfully', files: uploadedFiles });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
}

// GET /api/files
async function getFiles(req, res) {
    try {
        const db = req.companyDb;
        const files = await db.all(`
            SELECT a.*, m.name as manager_name, t.id as transcription_id, an.id as analysis_id, an.overall_score
            FROM audio_files a
            LEFT JOIN managers m ON a.manager_id = m.id
            LEFT JOIN transcriptions t ON a.id = t.audio_file_id
            LEFT JOIN analyses an ON a.id = an.audio_file_id
            ORDER BY a.upload_date DESC
        `);

        // Add relative path for each file (including company folder)
        const filesWithPath = files.map(file => ({
            ...file,
            file_path: getCompanyFileRelativePath(req.user.database_name, file.filename)
        }));

        res.json(filesWithPath);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// DELETE /api/files/:id
async function deleteFile(req, res) {
    try {
        const db = req.companyDb;
        const { id } = req.params;

        // Get the file record first to get the filename
        const file = await db.get('SELECT * FROM audio_files WHERE id = ?', id);

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Delete related records first (transcriptions and analyses)
        await db.run('DELETE FROM transcriptions WHERE audio_file_id = ?', id);
        await db.run('DELETE FROM analyses WHERE audio_file_id = ?', id);

        // Delete the audio file record
        await db.run('DELETE FROM audio_files WHERE id = ?', id);

        // Delete the physical file from company-specific uploads directory
        // req.user.database_name is available from authenticate middleware
        const filePath = getCompanyFilePath(req.user.database_name, file.filename);
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (fileError) {
            // Log error but don't fail the request if file deletion fails
            console.error('Error deleting physical file:', fileError);
        }

        res.json({ message: 'Audio file and all related records deleted successfully' });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: error.message });
    }
}

// GET /api/results/:id
async function getResults(req, res) {
    try {
        const db = req.companyDb;
        const { id } = req.params;

        const file = await db.get(`
            SELECT a.*, m.name as manager_name 
            FROM audio_files a 
            JOIN managers m ON a.manager_id = m.id 
            WHERE a.id = ?`, id);

        if (!file) return res.status(404).json({ error: 'File not found' });

        const transcription = await db.get('SELECT * FROM transcriptions WHERE audio_file_id = ?', id);
        const analysis = await db.get('SELECT * FROM analyses WHERE audio_file_id = ?', id);

        // Add relative path to file (including company folder)
        const fileWithPath = {
            ...file,
            file_path: getCompanyFileRelativePath(req.user.database_name, file.filename)
        };

        res.json({
            file: fileWithPath,
            transcription: transcription ? {
                ...transcription,
                segments: JSON.parse(transcription.segments)
            } : null,
            analysis: analysis ? {
                ...analysis,
                criteria_scores: analysis.criteria_scores ? JSON.parse(analysis.criteria_scores) : {},
                category_mistakes: analysis.category_mistakes ? JSON.parse(analysis.category_mistakes) : {},
                client_complaints: analysis.client_complaints ? JSON.parse(analysis.client_complaints) : {}
            } : null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// GET /api/managers
async function getManagers(req, res) {
    try {
        const db = req.companyDb;
        const managers = await db.all('SELECT id, name FROM managers ORDER BY name ASC');
        res.json(managers);
    } catch (error) {
        console.error('Error fetching managers:', error);
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    uploadFiles,
    getFiles,
    deleteFile,
    getResults,
    getManagers,
    getMimeType
};
