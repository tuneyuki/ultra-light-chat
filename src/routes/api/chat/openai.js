import { env } from '$env/dynamic/private';
import { createSSEResponse } from './utils.js';

const OPENAI_API_URL = 'https://api.openai.com/v1/responses';

/**
 * @param {string} model
 * @param {unknown} input
 * @param {string | undefined} chatId
 * @param {string | undefined} systemPrompt
 * @param {boolean | undefined} webSearch
 * @param {boolean | undefined} imageGeneration
 * @param {boolean | undefined} codeInterpreter
 * @param {string | undefined} reasoningEffort
 * @param {string | null} userId
 * @returns {Promise<Response>}
 */
export async function handleOpenAI(model, input, chatId, systemPrompt, webSearch, imageGeneration, codeInterpreter, reasoningEffort, userId) {
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
        return new Response(JSON.stringify({ error: 'OPENAI_API_KEY is not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    /** @type {Record<string, unknown>} */
    const body = {
        model,
        input,
        stream: true
    };

    if (systemPrompt) {
        body.instructions = systemPrompt;
    }

    if (chatId) {
        body.previous_response_id = chatId;
    }

    /** @type {Array<Record<string, unknown>>} */
    const tools = [];
    if (webSearch) tools.push({ type: 'web_search_preview' });
    if (imageGeneration) tools.push({ type: 'image_generation' });
    if (codeInterpreter) tools.push({ type: 'code_interpreter', container: { type: 'auto' } });
    if (tools.length > 0) body.tools = tools;

    if (reasoningEffort) {
        body.reasoning = { effort: reasoningEffort };
    }

    /** @type {string} */
    let logInput = '';
    /** @type {number} */
    let imageCount = 0;
    /** @type {string[]} */
    const attachedFiles = [];

    if (typeof input === 'string') {
        logInput = input;
    } else if (Array.isArray(input)) {
        for (const item of input) {
            if (!item.content || !Array.isArray(item.content)) continue;
            for (const c of item.content) {
                if (c.type === 'input_text' && c.text) logInput = c.text;
                if (c.type === 'input_image') imageCount++;
                if (c.type === 'input_file') attachedFiles.push(c.filename || 'unknown');
            }
        }
    }

    console.log(JSON.stringify({
        provider: 'openai',
        model,
        input: logInput,
        images: imageCount,
        files: attachedFiles,
        system_prompt: systemPrompt || null,
        tools: { web_search: !!webSearch, image_generation: !!imageGeneration, code_interpreter: !!codeInterpreter },
        reasoning_effort: reasoningEffort || null,
        has_previous_response: !!chatId,
        user: userId
    }));

    const upstream = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
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
            /** @type {Set<string>} */
            const sentFileIds = new Set();

            /**
             * @param {string} file_id
             * @param {string} filename
             * @param {string} mime_type
             * @param {string} container_id
             */
            function emitOutputFile(file_id, filename, mime_type, container_id) {
                if (sentFileIds.has(file_id)) return;
                sentFileIds.add(file_id);
                const event = `data: ${JSON.stringify({ type: 'output_file', file_id, filename, mime_type, container_id })}\n\n`;
                controller.enqueue(encoder.encode(event));
            }

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

                        // Forward text deltas as-is
                        if (data.type === 'response.output_text.delta') {
                            controller.enqueue(encoder.encode(line + '\n\n'));
                        }

                        // Forward tool status events
                        const statusEvents = [
                            'response.web_search_call.searching',
                            'response.code_interpreter_call.interpreting',
                            'response.image_generation_call.generating',
                        ];
                        if (statusEvents.includes(data.type)) {
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'status', status: data.type })}\n\n`));
                        }

                        // Forward Code Interpreter code deltas
                        if (data.type === 'response.code_interpreter_call_code.delta' && data.delta) {
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'code_delta', delta: data.delta })}\n\n`));
                        }

                        // Forward partial image data
                        if (data.type === 'response.image_generation_call.partial_image' && data.partial_image_b64) {
                            const imgEvent = `data: ${JSON.stringify({ type: 'image_partial', data: data.partial_image_b64 })}\n\n`;
                            controller.enqueue(encoder.encode(imgEvent));
                        }

                        // Extract output files from code_interpreter_call completed
                        if (data.type === 'response.code_interpreter_call.completed' && data.code_interpreter_call?.outputs) {
                            const cid = data.code_interpreter_call?.container_id || '';
                            for (const output of data.code_interpreter_call.outputs) {
                                if (output.type === 'files' && output.files) {
                                    for (const file of output.files) {
                                        emitOutputFile(file.file_id, file.filename || 'output', file.mime_type || 'application/octet-stream', cid);
                                    }
                                }
                            }
                        }

                        // When response is complete, extract generated images, output files, and send chat_id
                        if (data.type === 'response.completed' && data.response?.id) {
                            if (data.response.output) {
                                for (const item of data.response.output) {
                                    if (item.type === 'image_generation_call' && item.result) {
                                        const imgEvent = `data: ${JSON.stringify({ type: 'image_complete', data: item.result })}\n\n`;
                                        controller.enqueue(encoder.encode(imgEvent));
                                    }
                                    // Extract output files from code_interpreter_call in completed response
                                    if (item.type === 'code_interpreter_call' && item.outputs) {
                                        const cid = item.container_id || '';
                                        for (const output of item.outputs) {
                                            if (output.type === 'files' && output.files) {
                                                for (const file of output.files) {
                                                    emitOutputFile(file.file_id, file.filename || 'output', file.mime_type || 'application/octet-stream', cid);
                                                }
                                            }
                                        }
                                    }
                                    // Extract file citations from text content annotations
                                    if (item.type === 'message' && item.content) {
                                        for (const content of item.content) {
                                            if (content.annotations) {
                                                for (const ann of content.annotations) {
                                                    if (ann.type === 'container_file_citation' && ann.file_id) {
                                                        emitOutputFile(ann.file_id, ann.filename || 'output', ann.mime_type || 'application/octet-stream', ann.container_id || '');
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            const chatIdEvent = `data: ${JSON.stringify({ chat_id: data.response.id })}\n\n`;
                            controller.enqueue(encoder.encode(chatIdEvent));
                        }
                    } catch {
                        // skip malformed JSON
                    }
                }
            }

            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
        }
    });

    return createSSEResponse(stream);
}
