import { env } from '$env/dynamic/private';

const OPENAI_API_URL = 'https://api.openai.com/v1/responses';

/**
 * Determine provider from model ID.
 * @param {string} modelId
 * @returns {'openai' | 'gemini'}
 */
function getProvider(modelId) {
	if (modelId.startsWith('gemini-')) return 'gemini';
	return 'openai';
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	const { input, chat_id, model, system_prompt, web_search, image_generation, code_interpreter, messages, reasoning_effort } = await request.json();
	const userId = request.headers.get('x-ms-client-principal-name') || null;

	// model is always sent from the client; fallback is for direct API calls
	const resolvedModel = model || env.OPENAI_MODEL || 'gpt-5-mini';
	const provider = getProvider(resolvedModel);

	if (provider === 'gemini') {
		return handleGemini(resolvedModel, input, messages, system_prompt, web_search, reasoning_effort, userId);
	}

	return handleOpenAI(resolvedModel, input, chat_id, system_prompt, web_search, image_generation, code_interpreter, reasoning_effort, userId);
}

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
async function handleOpenAI(model, input, chatId, systemPrompt, webSearch, imageGeneration, codeInterpreter, reasoningEffort, userId) {
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
 * @param {string} model
 * @param {unknown} input
 * @param {Array<{role: string, content: string}> | undefined} messages
 * @param {string | undefined} systemPrompt
 * @param {boolean | undefined} webSearch
 * @param {string | undefined} reasoningEffort
 * @param {string | null} userId
 * @returns {Promise<Response>}
 */
async function handleGemini(model, input, messages, systemPrompt, webSearch, reasoningEffort, userId) {
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
		body.systemInstruction = { parts: [{ text: systemPrompt }] };
	}

	if (webSearch) {
		body.tools = [{ google_search: {} }];
	}

	if (reasoningEffort) {
		body.generationConfig = { .../** @type {Record<string, unknown>} */ (body.generationConfig), thinkingConfig: { thinkingLevel: reasoningEffort } };
	}

	const lastUserParts = contents.filter((c) => c.role === 'user').pop()?.parts ?? [];
	const lastUserText = lastUserParts.find((p) => 'text' in p)?.text || '[empty]';
	const imageCount = lastUserParts.filter((p) => 'inline_data' in p).length;
	console.log(JSON.stringify({
		provider: 'gemini',
		model,
		input: lastUserText,
		images: imageCount,
		files: [],
		system_prompt: systemPrompt || null,
		tools: { web_search: !!webSearch, image_generation: false, code_interpreter: false },
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
						const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
						if (text) {
							const event = `data: ${JSON.stringify({ type: 'response.output_text.delta', delta: text })}\n\n`;
							controller.enqueue(encoder.encode(event));
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
				const lines = [];
				for (let i = 0; i < chunks.length; i++) {
					const chunk = chunks[i];
					if (!chunk.web?.uri || !chunk.web?.title) continue;
					const segments = chunkSegments.get(i);
					if (segments && segments.length > 0) {
						const quote = segments.map((/** @type {string} */ s) => `> ${s}`).join('\n');
						lines.push(`- [${chunk.web.title}](${chunk.web.uri})\n${quote}`);
					} else {
						lines.push(`- [${chunk.web.title}](${chunk.web.uri})`);
					}
				}
				if (lines.length > 0) {
					const sourcesText = `\n\n---\n**Sources**\n${lines.join('\n')}\n`;
					const event = `data: ${JSON.stringify({ type: 'response.output_text.delta', delta: sourcesText })}\n\n`;
					controller.enqueue(encoder.encode(event));
				}
			}

			controller.enqueue(encoder.encode('data: [DONE]\n\n'));
			controller.close();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no'
		}
	});
}
