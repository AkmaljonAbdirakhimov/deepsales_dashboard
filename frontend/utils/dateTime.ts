/**
 * Format a date string to a readable format
 * @param dateString - ISO date string
 * @param locale - Locale string (default: 'en-US')
 * @param options - Intl.DateTimeFormatOptions (default: { year: 'numeric', month: 'short', day: 'numeric' })
 * @returns Formatted date string (e.g., "Jan 15, 2024")
 */
export function formatDate(
    dateString: string,
    locale: string = 'en-US',
    options?: Intl.DateTimeFormatOptions
): string {
    const defaultOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    };
    return new Date(dateString).toLocaleDateString(locale, options || defaultOptions);
}

/**
 * Format duration in seconds to a human-readable string
 * @param seconds - Duration in seconds
 * @returns Formatted duration string (e.g., "2h 30m", "45m", "30s")
 */
export function formatDuration(seconds: number): string {
    if (seconds < 60) {
        return `${seconds}s`;
    }
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        if (minutes > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${hours}h`;
    }
    if (minutes > 0) {
        return `${minutes}m ${secs > 0 ? `${secs}s` : ''}`;
    }
    return `${secs}s`;
}

/**
 * Parse a timestamp string to seconds
 * Supports formats: "MM:SS" or "HH:MM:SS"
 * @param timestamp - Timestamp string (e.g., "1:30" or "0:01:30")
 * @returns Duration in seconds, or null if invalid
 */
export function parseTimestamp(timestamp: string): number | null {
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
