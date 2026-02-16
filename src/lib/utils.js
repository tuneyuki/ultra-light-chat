/**
 * Format a file size in bytes to a human-readable string.
 * @param {number} size
 * @returns {string}
 */
export function formatFileSize(size) {
    if (size <= 0) return '';
    if (size < 1024) return size + ' B';
    if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
    return (size / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Generate a unique ID string using timestamp + random characters.
 * @returns {string}
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
