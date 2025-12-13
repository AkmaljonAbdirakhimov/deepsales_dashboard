const pricingPlanService = require('../services/pricingPlanService');

/**
 * Create a new pricing plan
 */
async function createPricingPlan(req, res) {
    try {
        const { name, description, price, max_managers, hours_per_manager, price_per_manager, price_per_hour } = req.body;

        if (!name || !price || max_managers === undefined || hours_per_manager === undefined ||
            price_per_manager === undefined || price_per_hour === undefined) {
            return res.status(400).json({
                error: 'Name, price, max_managers, hours_per_manager, price_per_manager, and price_per_hour are required'
            });
        }

        if (price < 0 || max_managers < 1 || hours_per_manager < 0 || price_per_manager < 0 || price_per_hour < 0) {
            return res.status(400).json({
                error: 'All price and quantity values must be positive'
            });
        }

        const plan = await pricingPlanService.createPricingPlan({
            name,
            description,
            price,
            max_managers,
            hours_per_manager,
            price_per_manager,
            price_per_hour
        });

        res.status(201).json(plan);
    } catch (error) {
        if (error.message.includes('UNIQUE constraint')) {
            return res.status(409).json({ error: 'Pricing plan name already exists' });
        }
        res.status(500).json({ error: error.message });
    }
}

/**
 * Get all pricing plans
 */
async function getAllPricingPlans(req, res) {
    try {
        const plans = await pricingPlanService.getAllPricingPlans();
        res.json(plans);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

/**
 * Get pricing plan by ID
 */
async function getPricingPlanById(req, res) {
    try {
        const planId = parseInt(req.params.id);
        const plan = await pricingPlanService.getPricingPlanById(planId);
        res.json(plan);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
}

/**
 * Update pricing plan
 */
async function updatePricingPlan(req, res) {
    try {
        const planId = parseInt(req.params.id);
        const plan = await pricingPlanService.updatePricingPlan(planId, req.body);
        res.json(plan);
    } catch (error) {
        if (error.message === 'Pricing plan not found') {
            return res.status(404).json({ error: error.message });
        }
        if (error.message.includes('UNIQUE constraint')) {
            return res.status(409).json({ error: 'Pricing plan name already exists' });
        }
        res.status(500).json({ error: error.message });
    }
}

/**
 * Delete pricing plan
 */
async function deletePricingPlan(req, res) {
    try {
        const planId = parseInt(req.params.id);
        await pricingPlanService.deletePricingPlan(planId);
        res.json({ message: 'Pricing plan deleted successfully' });
    } catch (error) {
        if (error.message === 'Pricing plan not found') {
            return res.status(404).json({ error: error.message });
        }
        if (error.message.includes('assigned to')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    createPricingPlan,
    getAllPricingPlans,
    getPricingPlanById,
    updatePricingPlan,
    deletePricingPlan
};
