const { verifyToken } = require('../utils/jwt');
const { getMainDb } = require('../database/mainDatabase');

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
async function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        try {
            const decoded = verifyToken(token);

            // Get user from database
            const db = getMainDb();
            const user = await db.get(
                `SELECT u.id, u.username, u.role, u.company_id, c.name as company_name, c.database_name
                 FROM users u
                 LEFT JOIN companies c ON u.company_id = c.id
                 WHERE u.id = ?`,
                decoded.userId
            );

            if (!user) {
                return res.status(401).json({ error: 'User not found' });
            }

            // Attach user to request
            req.user = user;
            next();
        } catch (error) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
    } catch (error) {
        return res.status(500).json({ error: 'Authentication error' });
    }
}

/**
 * Authorization middleware - check if user has required role
 * @param {string|string[]} allowedRoles - Role(s) allowed to access
 */
function authorize(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
    };
}

/**
 * Middleware to attach company database to request
 * Must be used after authenticate middleware
 * Only company users can access company-specific routes
 */
async function attachCompanyDb(req, res, next) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Super admin cannot access company-specific routes
        if (req.user.role === 'super_admin') {
            return res.status(403).json({ error: 'Super admin cannot access company-specific resources' });
        }

        // Company users need company database
        if (req.user.role !== 'company') {
            return res.status(403).json({
                error: 'Access denied. This resource is only available for company users.',
                userRole: req.user.role
            });
        }

        if (!req.user.database_name) {
            return res.status(403).json({
                error: 'Company database not configured. Please contact administrator.',
                companyId: req.user.company_id,
                companyName: req.user.company_name
            });
        }

        const { getCompanyDatabase, createCompanyDatabase } = require('../database/companyDatabase');

        // Try to get the database, create it if it doesn't exist
        try {
            req.companyDb = await getCompanyDatabase(req.user.database_name);
        } catch (error) {
            // If database file doesn't exist but company has database_name, try to create it
            if (error.message && error.message.includes('Company database not found')) {
                console.log(`Auto-creating missing company database: ${req.user.database_name}`);
                await createCompanyDatabase(req.user.database_name);
                req.companyDb = await getCompanyDatabase(req.user.database_name);
            } else {
                throw error;
            }
        }

        next();
    } catch (error) {
        // Check if it's a database not found error
        if (error.message && error.message.includes('Company database not found')) {
            return res.status(403).json({
                error: 'Company database file not found. Please contact administrator.',
                databaseName: req.user?.database_name
            });
        }
        return res.status(500).json({ error: 'Database connection error: ' + error.message });
    }
}

module.exports = {
    authenticate,
    authorize,
    attachCompanyDb
};
