const path = require('path');
const fs = require('fs');

/**
 * Get the upload folder path for a specific company
 * @param {string} databaseName - Company database name
 * @returns {string} Path to company-specific upload folder
 */
function getCompanyUploadPath(databaseName) {
    if (!databaseName) {
        throw new Error('Database name is required');
    }

    // Use database name to create folder (sanitized)
    const sanitizedFolderName = databaseName.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(__dirname, '../uploads', sanitizedFolderName);
}

/**
 * Ensure company upload directory exists
 * @param {string} databaseName - Company database name
 * @returns {string} Path to company-specific upload folder
 */
function ensureCompanyUploadDir(databaseName) {
    const uploadPath = getCompanyUploadPath(databaseName);

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
    }

    return uploadPath;
}

/**
 * Get full file path for a company's audio file
 * @param {string} databaseName - Company database name
 * @param {string} filename - File name
 * @returns {string} Full path to the file
 */
function getCompanyFilePath(databaseName, filename) {
    const uploadPath = getCompanyUploadPath(databaseName);
    return path.join(uploadPath, filename);
}

/**
 * Get relative path for serving files (for static middleware)
 * @param {string} databaseName - Company database name
 * @param {string} filename - File name
 * @returns {string} Relative path from uploads root
 */
function getCompanyFileRelativePath(databaseName, filename) {
    const sanitizedFolderName = databaseName.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(sanitizedFolderName, filename).replace(/\\/g, '/'); // Use forward slashes for URLs
}

module.exports = {
    getCompanyUploadPath,
    ensureCompanyUploadDir,
    getCompanyFilePath,
    getCompanyFileRelativePath
};
