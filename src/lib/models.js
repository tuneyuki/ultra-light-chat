/**
 * @typedef {Object} ModelDef
 * @property {string} id
 * @property {string} label
 * @property {'openai' | 'gemini'} provider
 * @property {boolean} supportsImage
 * @property {boolean} supportsImageGen
 * @property {boolean} supportsCodeInterpreter
 * @property {boolean} supportsWebSearch
 * @property {string[] | null} reasoningEfforts
 */

export const DEFAULT_MODEL = 'gpt-5-mini';

/** @type {ModelDef[]} */
export const MODELS = [
	{ id: 'gpt-5.2', label: 'GPT-5.2', provider: 'openai', supportsImage: true, supportsImageGen: true, supportsCodeInterpreter: true, supportsWebSearch: true, reasoningEfforts: ['none', 'low', 'medium', 'high'] },
	{ id: 'gpt-5.1', label: 'GPT-5.1', provider: 'openai', supportsImage: true, supportsImageGen: true, supportsCodeInterpreter: true, supportsWebSearch: true, reasoningEfforts: ['low', 'medium', 'high'] },
	{ id: 'gpt-5-mini', label: 'GPT-5 mini', provider: 'openai', supportsImage: true, supportsImageGen: true, supportsCodeInterpreter: true, supportsWebSearch: true, reasoningEfforts: ['low', 'medium', 'high'] },
	{ id: 'gpt-5-nano', label: 'GPT-5 nano', provider: 'openai', supportsImage: true, supportsImageGen: true, supportsCodeInterpreter: true, supportsWebSearch: true, reasoningEfforts: ['low', 'medium', 'high'] },
	{ id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview', provider: 'gemini', supportsImage: true, supportsImageGen: false, supportsCodeInterpreter: true, supportsWebSearch: true, reasoningEfforts: ['low', 'medium', 'high'] },
	{ id: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview', provider: 'gemini', supportsImage: true, supportsImageGen: false, supportsCodeInterpreter: false, supportsWebSearch: true, reasoningEfforts: ['low', 'high'] },
	{ id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview', provider: 'gemini', supportsImage: true, supportsImageGen: false, supportsCodeInterpreter: true, supportsWebSearch: true, reasoningEfforts: ['minimal', 'low', 'medium', 'high'] },
	{ id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'gemini', supportsImage: true, supportsImageGen: false, supportsCodeInterpreter: false, supportsWebSearch: true, reasoningEfforts: null },
	{ id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'gemini', supportsImage: true, supportsImageGen: false, supportsCodeInterpreter: false, supportsWebSearch: true, reasoningEfforts: null },
];

/**
 * Get the provider for a given model ID.
 * @param {string} modelId
 * @returns {'openai' | 'gemini'}
 */
export function getProvider(modelId) {
	return MODELS.find((m) => m.id === modelId)?.provider ?? 'openai';
}
