import { env } from '$env/dynamic/private';

const OPENAI_API_URL = 'https://api.openai.com/v1/responses';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	const apiKey = env.OPENAI_API_KEY;
	if (!apiKey) {
		return new Response(JSON.stringify({ error: 'OPENAI_API_KEY is not configured' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const { input, chat_id, model, system_prompt, web_search, image_generation, code_interpreter } = await request.json();

	/** @type {Record<string, unknown>} */
	const body = {
		model: model || env.OPENAI_MODEL || 'gpt-4.1-mini',
		input,
		stream: true
	};

	if (system_prompt) {
		body.instructions = system_prompt;
	}

	if (chat_id) {
		body.previous_response_id = chat_id;
	}

	/** @type {Array<Record<string, unknown>>} */
	const tools = [];
	if (web_search) tools.push({ type: 'web_search_preview' });
	if (image_generation) tools.push({ type: 'image_generation' });
	if (code_interpreter) tools.push({ type: 'code_interpreter', container: { type: 'auto' } });
	if (tools.length > 0) body.tools = tools;

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

						// When response is complete, extract generated images and send chat_id
						if (data.type === 'response.completed' && data.response?.id) {
							if (data.response.output) {
								for (const item of data.response.output) {
									if (item.type === 'image_generation_call' && item.result) {
										const imgEvent = `data: ${JSON.stringify({ type: 'image_complete', data: item.result })}\n\n`;
										controller.enqueue(encoder.encode(imgEvent));
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
