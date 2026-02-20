import { env } from '$env/dynamic/private';
import { createSSEResponse, guessMimeType, reconstructFileContent } from './utils.js';

/**
 * @param {string} model
 * @param {unknown} input
 * @param {Array<{role: string, content: string}> | undefined} messages
 * @param {string | undefined} systemPrompt
 * @param {boolean | undefined} webSearch
 * @param {boolean | undefined} codeInterpreter
 * @param {string | undefined} reasoningEffort
 * @param {string | null} userId
 * @returns {Promise<Response>}
 */
export async function handleGemini(model, input, messages, systemPrompt, webSearch, codeInterpreter, reasoningEffort, userId) {
    const apiKey = env.GOOGLE_API_KEY;
    if (!apiKey) {
        return new Response(JSON.stringify({ error: 'GOOGLE_API_KEY is not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Build contents array from message history
    /** @type {Array<{role: string, parts: Array<Record<string, unknown>>}>} */
    const contents = [];

    if (messages && messages.length > 0) {
        for (const msg of messages) {
            contents.push({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            });
        }
    }

    // Build the current user turn from input (may contain images/files)
    /** @type {Array<Record<string, unknown>>} */
    const currentParts = [];
    if (typeof input === 'string') {
        if (input) currentParts.push({ text: input });
    } else if (Array.isArray(input)) {
        for (const item of input) {
            if (!item.content || !Array.isArray(item.content)) continue;
            for (const c of item.content) {
                if (c.type === 'input_text' && c.text) {
                    currentParts.push({ text: c.text });
                } else if (c.type === 'input_image' && c.image_url) {
                    // data URL format: "data:<mime>;base64,<data>"
                    const match = c.image_url.match(/^data:([^;]+);base64,(.+)$/s);
                    if (match) {
                        currentParts.push({ inline_data: { mime_type: match[1], data: match[2] } });
                    }
                } else if (c.type === 'input_file' && c.file_data) {
                    // data URL format: "data:<mime>;base64,<data>"
                    const match = c.file_data.match(/^data:([^;]+);base64,(.+)$/s);
                    if (match) {
                        currentParts.push({ inline_data: { mime_type: match[1], data: match[2] } });
                    }
                }
            }
        }
    }
    if (currentParts.length > 0) {
        contents.push({ role: 'user', parts: currentParts });
    } else if (contents.length === 0) {
        contents.push({ role: 'user', parts: [{ text: '' }] });
    }

    /** @type {Record<string, unknown>} */
    const body = {
        contents,
        generationConfig: { temperature: 1.0 }
    };

    if (systemPrompt) {
        body.system_instruction = { parts: [{ text: systemPrompt }] };
    }

    /** @type {Array<Record<string, unknown>>} */
    const geminiTools = [];
    if (webSearch) geminiTools.push({ google_search: {} });
    if (codeInterpreter) geminiTools.push({ code_execution: {} });
    if (geminiTools.length > 0) body.tools = geminiTools;

    if (reasoningEffort) {
        body.generationConfig = { .../** @type {Record<string, unknown>} */ (body.generationConfig), thinkingConfig: { thinkingLevel: reasoningEffort } };
    }

    const lastUserParts = contents.filter((c) => c.role === 'user').pop()?.parts ?? [];
    const lastUserText = lastUserParts.find((p) => 'text' in p)?.text || '[empty]';
    const inlineDataParts = lastUserParts.filter((p) => 'inline_data' in p);
    const imageCount = inlineDataParts.filter((p) => /** @type {any} */ (p).inline_data?.mime_type?.startsWith('image/')).length;
    const fileCount = inlineDataParts.length - imageCount;
    console.log(JSON.stringify({
        provider: 'gemini',
        model,
        input: lastUserText,
        images: imageCount,
        files: fileCount,
        system_prompt: systemPrompt || null,
        tools: { web_search: !!webSearch, image_generation: false, code_interpreter: !!codeInterpreter },
        reasoning_effort: reasoningEffort || null,
        has_previous_response: false,
        message_count: contents.length,
        user: userId
    }));

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

    const upstream = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!upstream.ok) {
        const text = await upstream.text();
        return new Response(text, {
            status: upstream.status,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const stream = new ReadableStream({
        async start(controller) {
            const reader = upstream.body?.getReader();
            if (!reader) {
                controller.close();
                return;
            }

            const encoder = new TextEncoder();
            const decoder = new TextDecoder();
            let buffer = '';
            /** @type {any} */
            let lastGroundingMetadata = null;
            /** @type {Array<{filename: string, mime_type: string, data: string}>} */
            const collectedFiles = [];
            /** @type {string[]} */
            const codeOutputs = [];
            /** @type {string[]} */
            const executedCodes = [];
            let fileCounter = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const jsonStr = line.slice(6).trim();
                    if (!jsonStr || jsonStr === '[DONE]') continue;

                    try {
                        const data = JSON.parse(jsonStr);
                        const parts = data.candidates?.[0]?.content?.parts;
                        if (parts && Array.isArray(parts)) {
                            for (const part of parts) {
                                if (part.executableCode?.code) {
                                    executedCodes.push(part.executableCode.code);
                                    const codeEvent = `data: ${JSON.stringify({ type: 'code_delta', delta: part.executableCode.code })}\n\n`;
                                    controller.enqueue(encoder.encode(codeEvent));
                                } else if (part.codeExecutionResult) {
                                    const output = part.codeExecutionResult.output || '';
                                    if (output) {
                                        codeOutputs.push(output);
                                        const resultEvent = `data: ${JSON.stringify({ type: 'code_output', output })}\n\n`;
                                        controller.enqueue(encoder.encode(resultEvent));
                                    }
                                } else if (part.inlineData) {
                                    const mime = part.inlineData.mimeType || 'application/octet-stream';
                                    const b64 = part.inlineData.data;
                                    const ext = mime.split('/')[1]?.split(';')[0] || 'bin';
                                    const filename = `output_${++fileCounter}.${ext}`;
                                    collectedFiles.push({ filename, mime_type: mime, data: b64 });
                                } else if (part.text) {
                                    // Keep sandbox: links as-is; track filenames for later file reconstruction
                                    const text = part.text.replace(/\(sandbox:\/[^)]+\/([^/)]+)\)/g, (/** @type {string} */ _, /** @type {string} */ name) => {
                                        // Check if already collected via inlineData
                                        const ext = name.includes('.') ? name.split('.').pop() : '';
                                        const match = ext ? collectedFiles.find((f) => f.filename.endsWith('.' + ext)) : collectedFiles[0];
                                        if (match) {
                                            match.filename = name;
                                        } else {
                                            // Reconstruct file from code execution output
                                            const fileContent = reconstructFileContent(name, executedCodes, codeOutputs);
                                            if (fileContent) {
                                                const b64 = btoa(unescape(encodeURIComponent(fileContent)));
                                                const mime = guessMimeType(name);
                                                collectedFiles.push({ filename: name, mime_type: mime, data: b64 });
                                            }
                                        }
                                        return `(sandbox:/mnt/data/${name})`;
                                    });
                                    const event = `data: ${JSON.stringify({ type: 'response.output_text.delta', delta: text })}\n\n`;
                                    controller.enqueue(encoder.encode(event));
                                }
                            }
                        }
                        const metadata = data.candidates?.[0]?.groundingMetadata;
                        if (metadata) {
                            lastGroundingMetadata = metadata;
                        }
                    } catch {
                        // skip malformed JSON
                    }
                }
            }

            // Emit collected Gemini files
            for (const file of collectedFiles) {
                const fileEvent = `data: ${JSON.stringify({ type: 'gemini_file', filename: file.filename, mime_type: file.mime_type, data: file.data })}\n\n`;
                controller.enqueue(encoder.encode(fileEvent));
            }

            // Append grounding sources as markdown after the response
            if (lastGroundingMetadata?.groundingChunks?.length > 0) {
                const chunks = lastGroundingMetadata.groundingChunks;
                const supports = lastGroundingMetadata.groundingSupports || [];

                // Build per-chunk supporting text segments
                /** @type {Map<number, string[]>} */
                const chunkSegments = new Map();
                for (const support of supports) {
                    const segText = support.segment?.text;
                    if (!segText) continue;
                    for (const idx of (support.groundingChunkIndices || [])) {
                        if (!chunkSegments.has(idx)) chunkSegments.set(idx, []);
                        chunkSegments.get(idx)?.push(segText);
                    }
                }

                /** @type {string[]} */
                const sourceLines = [];
                for (let i = 0; i < chunks.length; i++) {
                    const chunk = chunks[i];
                    if (!chunk.web?.uri || !chunk.web?.title) continue;
                    const segments = chunkSegments.get(i);
                    if (segments && segments.length > 0) {
                        const quote = segments.map((/** @type {string} */ s) => `> ${s}`).join('\n');
                        sourceLines.push(`- [${chunk.web.title}](${chunk.web.uri})\n${quote}`);
                    } else {
                        sourceLines.push(`- [${chunk.web.title}](${chunk.web.uri})`);
                    }
                }
                if (sourceLines.length > 0) {
                    const sourcesText = `\n\n---\n**Sources**\n${sourceLines.join('\n')}\n`;
                    const event = `data: ${JSON.stringify({ type: 'response.output_text.delta', delta: sourcesText })}\n\n`;
                    controller.enqueue(encoder.encode(event));
                }
            }

            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
        }
    });

    return createSSEResponse(stream);
}
