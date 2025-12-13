/**
 * Parse a timestamp string to seconds
 * Supports formats: "MM:SS" or "HH:MM:SS"
 * @param {string} timestamp - Timestamp string (e.g., "1:30" or "0:01:30")
 * @returns {number|null} Duration in seconds, or null if invalid
 */
function parseTimestamp(timestamp) {
    if (!timestamp) return null;
    const parts = timestamp.split(':');
    if (parts.length === 2) {
        const minutes = parseInt(parts[0], 10) || 0;
        const seconds = parseInt(parts[1], 10) || 0;
        return minutes * 60 + seconds;
    } else if (parts.length === 3) {
        const hours = parseInt(parts[0], 10) || 0;
        const minutes = parseInt(parts[1], 10) || 0;
        const seconds = parseInt(parts[2], 10) || 0;
        return hours * 3600 + minutes * 60 + seconds;
    }
    return null;
}

module.exports = {
    parseTimestamp
};
