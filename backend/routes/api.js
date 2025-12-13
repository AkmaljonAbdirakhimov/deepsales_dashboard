const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();

// Import middleware
const { authenticate, authorize, attachCompanyDb } = require('../middleware/auth');

// Import controllers
const fileController = require('../controllers/fileController');
const analysisController = require('../controllers/analysisController');
const statsController = require('../controllers/statsController');
const categoryController = require('../controllers/categoryController');
const managerController = require('../controllers/managerController');

// Import file path utilities
const { ensureCompanyUploadDir } = require('../utils/filePaths');

// Configure Multer with company-specific folders
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        try {
            // req.user is available after authenticate middleware
            if (!req.user || !req.user.database_name) {
                return cb(new Error('Company database name not found'));
            }

            // Ensure company upload directory exists
            const uploadPath = ensureCompanyUploadDir(req.user.database_name);
            cb(null, uploadPath);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// All routes require authentication and company database (for company users)
// Super admin can access these routes but won't have company database
router.use(authenticate);
router.use(attachCompanyDb);

// File routes
router.post('/upload', upload.array('files'), fileController.uploadFiles);
router.get('/files', fileController.getFiles);
router.delete('/files/:id', fileController.deleteFile);
router.get('/results/:id', fileController.getResults);

// Manager routes
router.get('/managers/limits', managerController.getManagerLimits);
router.get('/managers', managerController.getManagers);
router.post('/managers', managerController.createManager);
router.put('/managers/:id', managerController.updateManager);
router.delete('/managers/:id', managerController.deleteManager);

// Analysis routes
router.post('/analyze', analysisController.analyzeFiles);
router.post('/analyze/stop', analysisController.stopAnalysis);

// Stats routes
router.get('/managers/stats', statsController.getManagerStats);
router.get('/managers/:id/history', statsController.getManagerHistory);
router.get('/stats/volume', statsController.getVolumeStats);
router.get('/audio/:id/stats', statsController.getAudioStats);

// Category routes
router.get('/categories', categoryController.getCategories);
router.post('/categories', categoryController.createCategory);
router.put('/categories/:id', categoryController.updateCategory);
router.delete('/categories/:id', categoryController.deleteCategory);

// Criteria routes
router.post('/criteria', categoryController.createCriterion);
router.put('/criteria/:id', categoryController.updateCriterion);
router.delete('/criteria/:id', categoryController.deleteCriterion);

module.exports = router;
