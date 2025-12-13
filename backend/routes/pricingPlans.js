const express = require('express');
const router = express.Router();
const pricingPlanController = require('../controllers/pricingPlanController');
const { authenticate, authorize } = require('../middleware/auth');

// All pricing plan routes require super admin role
router.use(authenticate);
router.use(authorize('super_admin'));

router.post('/', pricingPlanController.createPricingPlan);
router.get('/', pricingPlanController.getAllPricingPlans);
router.get('/:id', pricingPlanController.getPricingPlanById);
router.put('/:id', pricingPlanController.updatePricingPlan);
router.delete('/:id', pricingPlanController.deletePricingPlan);

module.exports = router;
