const mm = require('music-metadata');
const fs = require('fs').promises;

/**
 * Get audio file duration in hours
 * @param {string} filePath - Path to audio file
 * @returns {Promise<number>} Duration in hours
 */
async function getAudioDurationHours(filePath) {
    try {
        const metadata = await mm.parseFile(filePath);
        const durationSeconds = metadata.format.duration || 0;
        return durationSeconds / 3600; // Convert seconds to hours
    } catch (error) {
        console.error('Error getting audio duration:', error);
        // Fallback: return 0 if we can't determine duration
        // This allows the analysis to proceed but won't count towards hours limit
        return 0;
    }
}

/**
 * Get audio file duration in seconds
 * @param {string} filePath - Path to audio file
 * @returns {Promise<number>} Duration in seconds
 */
async function getAudioDurationSeconds(filePath) {
    try {
        const metadata = await mm.parseFile(filePath);
        return metadata.format.duration || 0;
    } catch (error) {
        console.error('Error getting audio duration:', error);
        return 0;
    }
}

module.exports = {
    getAudioDurationHours,
    getAudioDurationSeconds
};
