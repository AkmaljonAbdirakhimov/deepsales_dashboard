const { getMainDb } = require('../database/mainDatabase');
const { comparePassword, hashPassword } = require('../utils/password');
const { generateToken } = require('../utils/jwt');

/**
 * Authenticate user with username and password
 * @param {string} username - Username
 * @param {string} password - Plain text password
 * @returns {Promise<Object>} User object with token
 */
async function login(username, password) {
    const db = getMainDb();

    // Get user with company info
    const user = await db.get(
        `SELECT u.id, u.username, u.password_hash, u.role, u.company_id, 
                c.name as company_name, c.database_name
         FROM users u
         LEFT JOIN companies c ON u.company_id = c.id
         WHERE u.username = ?`,
        username
    );

    if (!user) {
        throw new Error('Invalid credentials');
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.password_hash);
    if (!isValidPassword) {
        throw new Error('Invalid credentials');
    }

    // Generate token
    const token = generateToken({
        userId: user.id,
        username: user.username,
        role: user.role,
        companyId: user.company_id
    });

    // Return user data (without password)
    return {
        user: {
            id: user.id,
            username: user.username,
            role: user.role,
            companyId: user.company_id,
            companyName: user.company_name,
            databaseName: user.database_name
        },
        token
    };
}

/**
 * Get current user info
 * @param {number} userId - User ID
 * @returns {Promise<Object>} User object
 */
async function getCurrentUser(userId) {
    const db = getMainDb();

    const user = await db.get(
        `SELECT u.id, u.username, u.role, u.company_id, 
                c.name as company_name, c.database_name
         FROM users u
         LEFT JOIN companies c ON u.company_id = c.id
         WHERE u.id = ?`,
        userId
    );

    if (!user) {
        throw new Error('User not found');
    }

    return {
        id: user.id,
        username: user.username,
        role: user.role,
        companyId: user.company_id,
        companyName: user.company_name,
        databaseName: user.database_name
    };
}

/**
 * Change user password
 * @param {number} userId - User ID
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password
 * @returns {Promise<void>}
 */
async function changePassword(userId, currentPassword, newPassword) {
    const db = getMainDb();

    // Get user with password hash
    const user = await db.get(
        'SELECT id, password_hash FROM users WHERE id = ?',
        userId
    );

    if (!user) {
        throw new Error('User not found');
    }

    // Verify current password
    const isValidPassword = await comparePassword(currentPassword, user.password_hash);
    if (!isValidPassword) {
        throw new Error('Current password is incorrect');
    }

    // Validate new password
    if (!newPassword || newPassword.length < 6) {
        throw new Error('New password must be at least 6 characters long');
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await db.run(
        'UPDATE users SET password_hash = ? WHERE id = ?',
        newPasswordHash,
        userId
    );
}

module.exports = {
    login,
    getCurrentUser,
    changePassword
};
