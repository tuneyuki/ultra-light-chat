const STORAGE_KEY = 'ulc-conversations';
const MAX_SIZE = 4_500_000; // 4.5MB in bytes

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
 * Automatically deletes oldest conversations when storage exceeds 4.5MB.
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

	let json = JSON.stringify(all);
	while (new Blob([json]).size > MAX_SIZE && all.length > 1) {
		let oldestIdx = -1;
		let oldestTime = Infinity;
		for (let i = 0; i < all.length; i++) {
			if (all[i].id === conv.id) continue;
			const t = all[i].updatedAt ?? 0;
			if (t < oldestTime) {
				oldestTime = t;
				oldestIdx = i;
			}
		}
		if (oldestIdx === -1) break;
		all.splice(oldestIdx, 1);
		json = JSON.stringify(all);
	}

	try {
		localStorage.setItem(STORAGE_KEY, json);
	} catch {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify([conv]));
		} catch {
			// give up
		}
	}
}

/**
 * Delete a conversation by ID.
 * @param {string} id
 */
export function deleteConversation(id) {
	const all = loadConversations().filter((c) => c.id !== id);
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
	} catch {
		// ignore
	}
}

/**
 * Delete all conversations from LocalStorage.
 */
export function deleteAllConversations() {
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		// ignore
	}
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
