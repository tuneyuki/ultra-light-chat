const STORAGE_KEY = 'ulc-mcp-servers';

/**
 * @typedef {Object} McpServerDef
 * @property {string} id
 * @property {string} label
 * @property {string} serverUrl
 * @property {string} description
 * @property {string} authType
 * @property {string} authUrl
 */

/**
 * @typedef {Object} McpServerConfig
 * @property {string} id
 * @property {string} token
 * @property {string} [refreshToken]
 * @property {string} [clientId]
 * @property {string} [clientSecret]
 * @property {string} [tokenEndpoint]
 * @property {number} [expiresAt]
 * @property {string} [workspaceName]
 */

/** @type {McpServerDef[]} */
export const MCP_CATALOG = [
	{
		id: 'notion',
		label: 'Notion',
		serverUrl: 'https://mcp.notion.com/mcp',
		description: 'Notionページの検索・参照・作成',
		authType: 'oauth',
		authUrl: '/api/auth/notion'
	}
];

/**
 * Load saved MCP server configs from localStorage.
 * @returns {McpServerConfig[]}
 */
export function loadMcpConfigs() {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? JSON.parse(raw) : [];
	} catch {
		return [];
	}
}

/**
 * Save an MCP server config (upsert by id).
 * @param {McpServerConfig} config
 */
export function saveMcpConfig(config) {
	const all = loadMcpConfigs().filter((c) => c.id !== config.id);
	all.push(config);
	localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

/**
 * Remove an MCP server config.
 * @param {string} id
 */
export function removeMcpConfig(id) {
	const all = loadMcpConfigs().filter((c) => c.id !== id);
	localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

/**
 * Refresh MCP tokens if they are expired or about to expire (within 5 minutes).
 * Should be called before making chat requests with MCP tools.
 */
export async function refreshMcpTokensIfNeeded() {
	const configs = loadMcpConfigs();
	const threshold = Date.now() + 5 * 60 * 1000; // 5 minutes buffer

	for (const config of configs) {
		if (!config.refreshToken || !config.clientId || !config.tokenEndpoint) continue;
		if (config.expiresAt && config.expiresAt > threshold) continue;

		try {
			const res = await fetch('/api/auth/notion/refresh', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					refresh_token: config.refreshToken,
					client_id: config.clientId,
					client_secret: config.clientSecret || undefined,
					token_endpoint: config.tokenEndpoint
				})
			});

			if (!res.ok) {
				console.error('MCP token refresh failed, removing config');
				removeMcpConfig(config.id);
				continue;
			}

			const data = await res.json();
			saveMcpConfig({
				...config,
				token: data.access_token,
				refreshToken: data.refresh_token || config.refreshToken,
				expiresAt: Date.now() + (data.expires_in || 3600) * 1000
			});
		} catch (err) {
			console.error('MCP token refresh error:', err);
			removeMcpConfig(config.id);
		}
	}
}
