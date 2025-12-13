const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const { authenticate, authorize } = require('../middleware/auth');

// All company routes require super admin role
router.use(authenticate);
router.use(authorize('super_admin'));

router.post('/', companyController.createCompany);
router.get('/', companyController.getAllCompanies);
router.get('/:id', companyController.getCompanyById);
router.put('/:id', companyController.updateCompany);
router.delete('/:id', companyController.deleteCompany);
router.get('/:id/stats', companyController.getCompanyStats);
router.get('/:id/usage', companyController.getCompanyUsage);

module.exports = router;
