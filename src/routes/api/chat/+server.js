import { env } from '$env/dynamic/private';
import { getProvider } from './utils.js';
import { handleOpenAI } from './openai.js';
import { handleGemini } from './gemini.js';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	const { input, chat_id, model, system_prompt, web_search, image_generation, code_interpreter, messages, reasoning_effort, container_id } = await request.json();
	const userId = request.headers.get('x-ms-client-principal-name') || null;

	// model is always sent from the client; fallback is for direct API calls
	const resolvedModel = model || env.OPENAI_MODEL || 'gpt-5-mini';
	const provider = getProvider(resolvedModel);

	if (provider === 'gemini') {
		return handleGemini(resolvedModel, input, messages, system_prompt, web_search, code_interpreter, reasoning_effort, userId);
	}

	return handleOpenAI(resolvedModel, input, chat_id, system_prompt, web_search, image_generation, code_interpreter, reasoning_effort, container_id, userId);
}
