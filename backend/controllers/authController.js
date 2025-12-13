const authService = require('../services/authService');

/**
 * Login controller
 */
async function login(req, res) {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const result = await authService.login(username, password);

        res.json(result);
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
}

/**
 * Get current user info
 */
async function getCurrentUser(req, res) {
    try {
        const user = await authService.getCurrentUser(req.user.id);
        res.json({ user });
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
}

/**
 * Change password controller
 */
async function changePassword(req, res) {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current password and new password are required' });
        }

        await authService.changePassword(req.user.id, currentPassword, newPassword);
        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

module.exports = {
    login,
    getCurrentUser,
    changePassword
};
