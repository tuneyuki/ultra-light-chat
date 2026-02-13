const STORAGE_KEY = 'ulc-conversations';

/**
 * Load all conversations from LocalStorage.
 * @returns {import('./types.js').Conversation[]}
 */
export function loadConversations() {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? JSON.parse(raw) : [];
	} catch {
		return [];
	}
}

/**
 * Save (create or update) a conversation.
 * @param {import('./types.js').Conversation} conv
 */
export function saveConversation(conv) {
	const all = loadConversations();
	const idx = all.findIndex((c) => c.id === conv.id);
	if (idx >= 0) {
		all[idx] = conv;
	} else {
		all.push(conv);
	}
	localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

/**
 * Delete a conversation by ID.
 * @param {string} id
 */
export function deleteConversation(id) {
	const all = loadConversations().filter((c) => c.id !== id);
	localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

/**
 * Generate a title from the first user message (first 30 chars).
 * @param {import('./types.js').Message[]} messages
 * @returns {string}
 */
export function generateTitle(messages) {
	const first = messages.find((m) => m.role === 'user');
	if (!first) return 'New Chat';
	const text = first.content.trim();
	if (!text) return 'Image Chat';
	return text.length > 30 ? text.slice(0, 30) + '...' : text;
}
