const { getMainDb } = require('../database/mainDatabase');

/**
 * Create a new pricing plan
 * @param {Object} planData - Pricing plan data
 * @returns {Promise<Object>} Created pricing plan
 */
async function createPricingPlan(planData) {
    const db = getMainDb();

    const result = await db.run(
        `INSERT INTO pricing_plans (name, description, price, max_managers, hours_per_manager, price_per_manager, price_per_hour)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        planData.name,
        planData.description || null,
        planData.price,
        planData.max_managers,
        planData.hours_per_manager,
        planData.price_per_manager,
        planData.price_per_hour
    );

    return getPricingPlanById(result.lastID);
}

/**
 * Get all pricing plans
 * @returns {Promise<Array>} List of pricing plans
 */
async function getAllPricingPlans() {
    const db = getMainDb();

    const plans = await db.all(
        `SELECT id, name, description, price, max_managers, hours_per_manager, price_per_manager, price_per_hour, created_at, updated_at
         FROM pricing_plans
         ORDER BY price ASC`
    );

    return plans;
}

/**
 * Get pricing plan by ID
 * @param {number} planId - Pricing plan ID
 * @returns {Promise<Object>} Pricing plan object
 */
async function getPricingPlanById(planId) {
    const db = getMainDb();

    const plan = await db.get(
        `SELECT id, name, description, price, max_managers, hours_per_manager, price_per_manager, price_per_hour, created_at, updated_at
         FROM pricing_plans
         WHERE id = ?`,
        planId
    );

    if (!plan) {
        throw new Error('Pricing plan not found');
    }

    return plan;
}

/**
 * Update pricing plan
 * @param {number} planId - Pricing plan ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated pricing plan
 */
async function updatePricingPlan(planId, updateData) {
    const db = getMainDb();

    // Check if plan exists
    const plan = await db.get('SELECT id FROM pricing_plans WHERE id = ?', planId);
    if (!plan) {
        throw new Error('Pricing plan not found');
    }

    // Build update query
    const updates = [];
    const values = [];

    if (updateData.name !== undefined) {
        updates.push('name = ?');
        values.push(updateData.name);
    }

    if (updateData.description !== undefined) {
        updates.push('description = ?');
        values.push(updateData.description);
    }

    if (updateData.price !== undefined) {
        updates.push('price = ?');
        values.push(updateData.price);
    }

    if (updateData.max_managers !== undefined) {
        updates.push('max_managers = ?');
        values.push(updateData.max_managers);
    }

    if (updateData.hours_per_manager !== undefined) {
        updates.push('hours_per_manager = ?');
        values.push(updateData.hours_per_manager);
    }

    if (updateData.price_per_manager !== undefined) {
        updates.push('price_per_manager = ?');
        values.push(updateData.price_per_manager);
    }

    if (updateData.price_per_hour !== undefined) {
        updates.push('price_per_hour = ?');
        values.push(updateData.price_per_hour);
    }

    if (updates.length === 0) {
        throw new Error('No fields to update');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(planId);

    await db.run(
        `UPDATE pricing_plans SET ${updates.join(', ')} WHERE id = ?`,
        ...values
    );

    return getPricingPlanById(planId);
}

/**
 * Delete pricing plan
 * @param {number} planId - Pricing plan ID
 */
async function deletePricingPlan(planId) {
    const db = getMainDb();

    // Check if plan exists
    const plan = await db.get('SELECT id FROM pricing_plans WHERE id = ?', planId);
    if (!plan) {
        throw new Error('Pricing plan not found');
    }

    // Check if any companies are using this plan
    const companiesUsingPlan = await db.get(
        'SELECT COUNT(*) as count FROM companies WHERE plan_id = ?',
        planId
    );

    if (companiesUsingPlan.count > 0) {
        throw new Error('Cannot delete pricing plan: it is assigned to one or more companies');
    }

    await db.run('DELETE FROM pricing_plans WHERE id = ?', planId);
}

module.exports = {
    createPricingPlan,
    getAllPricingPlans,
    getPricingPlanById,
    updatePricingPlan,
    deletePricingPlan
};
