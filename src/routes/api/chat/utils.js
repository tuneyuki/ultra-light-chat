/**
 * Create a standard SSE Response.
 * @param {ReadableStream} stream
 * @returns {Response}
 */
export function createSSEResponse(stream) {
    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no'
        }
    });
}

/**
 * Guess MIME type from filename extension.
 * @param {string} filename
 * @returns {string}
 */
export function guessMimeType(filename) {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const types = /** @type {Record<string, string>} */ ({
        csv: 'text/csv', txt: 'text/plain', json: 'application/json',
        html: 'text/html', xml: 'application/xml', md: 'text/markdown',
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
        gif: 'image/gif', svg: 'image/svg+xml', pdf: 'application/pdf',
    });
    return types[ext] || 'application/octet-stream';
}

/**
 * Try to reconstruct file content from code execution context.
 * Searches executed code for file write patterns and uses code output as file content.
 * @param {string} filename
 * @param {string[]} executedCodes
 * @param {string[]} codeOutputs
 * @returns {string | null}
 */
export function reconstructFileContent(filename, executedCodes, codeOutputs) {
    const escapedName = filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (let i = executedCodes.length - 1; i >= 0; i--) {
        const code = executedCodes[i];
        if (code.includes(filename) || code.includes(escapedName)) {
            if (codeOutputs[i]) {
                return codeOutputs[i];
            }
        }
    }
    for (let i = executedCodes.length - 1; i >= 0; i--) {
        if (executedCodes[i].includes(filename)) {
            for (let j = i; j < codeOutputs.length; j++) {
                if (codeOutputs[j]) return codeOutputs[j];
            }
        }
    }
    return null;
}

/**
 * Determine provider from model ID.
 * @param {string} modelId
 * @returns {'openai' | 'gemini'}
 */
export function getProvider(modelId) {
    if (modelId.startsWith('gemini-')) return 'gemini';
    return 'openai';
}
