const API_URL = '/api/chat';

/**
 * Send a message and stream the SSE response.
 * @param {string} input - User message text
 * @param {string | null} chatId - Existing chat/conversation ID for context continuity
 * @param {(delta: string) => void} onDelta - Called for each text chunk
 * @param {(id: string | null) => void} onChatId - Called when a chat ID is returned
 * @param {AbortSignal} [signal] - Optional abort signal
 * @param {{ model?: string, systemPrompt?: string, images?: string[], webSearch?: boolean, imageGeneration?: boolean, codeInterpreter?: boolean, onImage?: (dataUrl: string, partial: boolean) => void, onStatus?: (status: string) => void, onCodeDelta?: (delta: string) => void }} [options] - Optional model, system prompt, base64 images, web search toggle, image generation toggle, code interpreter toggle, image callback, status callback, and code delta callback
 * @returns {Promise<void>}
 */
export async function streamChat(input, chatId, onDelta, onChatId, signal, options) {
	/** @type {Record<string, unknown>} */
	const body = {};

	if (options?.images && options.images.length > 0) {
		/** @type {Array<{ type: string, text?: string, image_url?: string }>} */
		const content = [];
		if (input) {
			content.push({ type: 'input_text', text: input });
		}
		for (const dataUrl of options.images) {
			content.push({ type: 'input_image', image_url: dataUrl });
		}
		body.input = [{ role: 'user', content }];
	} else {
		body.input = input;
	}
	if (chatId) body.chat_id = chatId;
	if (options?.model) body.model = options.model;
	if (options?.systemPrompt) body.system_prompt = options.systemPrompt;
	if (options?.webSearch) body.web_search = true;
	if (options?.imageGeneration) body.image_generation = true;
	if (options?.codeInterpreter) body.code_interpreter = true;

	const res = await fetch(API_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
		signal
	});

	if (!res.ok) {
		const errBody = await res.text();
		throw new Error(`API error: ${res.status} ${res.statusText} - ${errBody}`);
	}

	const reader = res.body?.getReader();
	if (!reader) throw new Error('No response body');

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

				if (data.type === 'response.output_text.delta' && data.delta) {
					onDelta(data.delta);
					// Yield to allow UI to re-render between deltas
					await new Promise((r) => setTimeout(r, 0));
				}

				if (data.type === 'image_partial' && data.data && options?.onImage) {
					options.onImage(`data:image/png;base64,${data.data}`, true);
					await new Promise((r) => setTimeout(r, 0));
				}

				if (data.type === 'image_complete' && data.data && options?.onImage) {
					await options.onImage(`data:image/png;base64,${data.data}`, false);
				}

				if (data.type === 'status' && data.status && options?.onStatus) {
					options.onStatus(data.status);
				}

				if (data.type === 'code_delta' && data.delta && options?.onCodeDelta) {
					options.onCodeDelta(data.delta);
					await new Promise((r) => setTimeout(r, 0));
				}

				if (data.chat_id) {
					onChatId(data.chat_id);
				}
			} catch {
				// skip malformed JSON
			}
		}
	}
}
