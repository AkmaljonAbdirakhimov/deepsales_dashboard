const companyService = require('../services/companyService');

/**
 * Create a new company
 */
async function createCompany(req, res) {
    try {
        const { name, adminUsername, adminPassword, plan_id, extra_managers, extra_hours } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Company name is required' });
        }

        const company = await companyService.createCompany({
            name,
            adminUsername,
            adminPassword,
            plan_id: plan_id || null,
            extra_managers: extra_managers || 0,
            extra_hours: extra_hours || 0
        });

        res.status(201).json(company);
    } catch (error) {
        if (error.message.includes('UNIQUE constraint')) {
            return res.status(409).json({ error: 'Company name already exists' });
        }
        res.status(500).json({ error: error.message });
    }
}

/**
 * Get all companies
 */
async function getAllCompanies(req, res) {
    try {
        const includeUsage = req.query.includeUsage === 'true';
        const companies = await companyService.getAllCompanies(includeUsage);
        res.json(companies);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

/**
 * Get company by ID
 */
async function getCompanyById(req, res) {
    try {
        const companyId = parseInt(req.params.id);
        const company = await companyService.getCompanyById(companyId);
        res.json(company);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
}

/**
 * Update company
 */
async function updateCompany(req, res) {
    try {
        const companyId = parseInt(req.params.id);
        const company = await companyService.updateCompany(companyId, req.body);
        res.json(company);
    } catch (error) {
        if (error.message === 'Company not found') {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
}

/**
 * Delete company
 */
async function deleteCompany(req, res) {
    try {
        const companyId = parseInt(req.params.id);
        await companyService.deleteCompany(companyId);
        res.json({ message: 'Company deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

/**
 * Get company statistics
 */
async function getCompanyStats(req, res) {
    try {
        const companyId = parseInt(req.params.id);
        const queryParams = {
            period: req.query.period || 'all',
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };
        const stats = await companyService.getCompanyStats(companyId, queryParams);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

/**
 * Get company usage
 */
async function getCompanyUsage(req, res) {
    try {
        const companyId = parseInt(req.params.id);
        const usage = await companyService.getCompanyUsage(companyId);
        res.json(usage);
    } catch (error) {
        if (error.message === 'Company not found') {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    createCompany,
    getAllCompanies,
    getCompanyById,
    updateCompany,
    deleteCompany,
    getCompanyStats,
    getCompanyUsage
};
