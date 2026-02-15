/**
 * @typedef {Object} ModelDef
 * @property {string} id
 * @property {string} label
 * @property {boolean} supportsImage
 * @property {boolean} supportsImageGen
 * @property {boolean} supportsCodeInterpreter
 */

export const DEFAULT_MODEL = 'gpt-5-mini';

/** @type {ModelDef[]} */
export const MODELS = [
	{ id: 'gpt-5.2', label: 'GPT-5.2', supportsImage: true, supportsImageGen: true, supportsCodeInterpreter: true },
	{ id: 'gpt-5.1', label: 'GPT-5.1', supportsImage: true, supportsImageGen: true, supportsCodeInterpreter: true },
	{ id: 'gpt-5', label: 'GPT-5', supportsImage: true, supportsImageGen: true, supportsCodeInterpreter: true },
	{ id: 'gpt-5-mini', label: 'GPT-5 mini', supportsImage: true, supportsImageGen: true, supportsCodeInterpreter: true },
	{ id: 'gpt-5-nano', label: 'GPT-5 nano', supportsImage: true, supportsImageGen: true, supportsCodeInterpreter: true },
];
