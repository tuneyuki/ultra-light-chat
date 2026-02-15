const STORAGE_KEY = 'ulc-prompts';

/**
 * @typedef {{ id: string, name: string, content: string }} SavedPrompt
 */

/**
 * Load all saved prompts from LocalStorage.
 * @returns {SavedPrompt[]}
 */
export function loadPrompts() {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? JSON.parse(raw) : [];
	} catch {
		return [];
	}
}

/**
 * Save a new prompt.
 * @param {SavedPrompt} prompt
 */
export function savePrompt(prompt) {
	const all = loadPrompts();
	all.push(prompt);
	localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

/**
 * Delete a prompt by ID.
 * @param {string} id
 */
export function deletePrompt(id) {
	const all = loadPrompts().filter((p) => p.id !== id);
	localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}
