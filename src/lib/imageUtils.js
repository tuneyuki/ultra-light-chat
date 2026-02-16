import { loadImage } from '$lib/imageStore.js';

/**
 * Convert a File to a data URL (base64).
 * @param {File} file
 * @returns {Promise<string>}
 */
export function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(/** @type {string} */(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

/**
 * Resolve imageIds for a set of messages and populate a URL map.
 * Uses an in-memory cache to avoid redundant IndexedDB reads.
 * @param {import('$lib/types.js').Message[]} msgs
 * @param {Map<string, string>} cache - imageId → objectURL cache
 * @returns {Promise<Record<number, string[]>>}
 */
export async function resolveImageUrls(msgs, cache) {
    /** @type {Record<number, string[]>} */
    const result = {};
    for (let i = 0; i < msgs.length; i++) {
        const ids = msgs[i].imageIds;
        if (!ids || ids.length === 0) continue;
        /** @type {string[]} */
        const urls = [];
        for (const id of ids) {
            let url = cache.get(id);
            if (!url) {
                url = await loadImage(id) ?? undefined;
                if (url) cache.set(id, url);
            }
            if (url) urls.push(url);
        }
        if (urls.length > 0) result[i] = urls;
    }
    return result;
}

/**
 * Convert a base64 data URL to a Blob.
 * @param {string} dataUrl - e.g. "data:image/png;base64,..."
 * @returns {{ blob: Blob, mime: string }}
 */
export function dataUrlToBlob(dataUrl) {
    const commaIdx = dataUrl.indexOf(',');
    const mime = dataUrl.slice(5, dataUrl.indexOf(';'));
    const binary = atob(dataUrl.slice(commaIdx + 1));
    const bytes = new Uint8Array(binary.length);
    for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
    const blob = new Blob([bytes], { type: mime });
    return { blob, mime };
}
