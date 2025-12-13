/**
 * JSON Helper Utilities
 * Handles JSON parsing for PostgreSQL JSONB fields
 * 
 * PostgreSQL's JSONB fields are automatically parsed by the pg library,
 * so they come back as objects. This helper handles cases where they might
 * still be strings or need conversion.
 */

/**
 * Safely parse a JSON field that might be:
 * - A string (JSON string)
 * - An object (from PostgreSQL JSONB, already parsed)
 * - null or undefined
 * 
 * @param {any} value - The value to parse
 * @param {any} defaultValue - Default value if parsing fails or value is null
 * @returns {any} Parsed JSON object or default value
 */
function safeJsonParse(value, defaultValue = null) {
    if (value === null || value === undefined || value === 'null') {
        return defaultValue;
    }

    // If it's already an object/array, return it (PostgreSQL JSONB, already parsed)
    if (typeof value !== 'string') {
        return value;
    }

    // If it's a string, try to parse it
    try {
        return JSON.parse(value);
    } catch (e) {
        console.warn('Error parsing JSON:', e);
        return defaultValue;
    }
}

/**
 * Safely stringify a value for database storage
 * PostgreSQL JSONB can accept objects directly, but we stringify for consistency
 * 
 * @param {any} value - The value to stringify
 * @returns {string|null} JSON string or null
 */
function safeJsonStringify(value) {
    if (value === null || value === undefined) {
        return null;
    }

    // If it's already a string, return it
    if (typeof value === 'string') {
        try {
            // Validate it's valid JSON
            JSON.parse(value);
            return value;
        } catch (e) {
            // If not valid JSON, stringify it
            return JSON.stringify(value);
        }
    }

    // If it's an object/array, stringify it
    try {
        return JSON.stringify(value);
    } catch (e) {
        console.warn('Error stringifying JSON:', e);
        return null;
    }
}

module.exports = {
    safeJsonParse,
    safeJsonStringify
};

