<script>
	import { MCP_CATALOG, saveMcpConfig, removeMcpConfig } from '$lib/mcpStore.js';
	import { onMount } from 'svelte';

	/** @type {{ configs: import('$lib/mcpStore.js').McpServerConfig[], onUpdate: () => void, onClose: () => void }} */
	let { configs, onUpdate, onClose } = $props();

	/** @type {string | null} */
	let pendingOAuthState = $state(null);
	let oauthError = $state('');

	onMount(() => {
		/** @param {MessageEvent} e */
		function handleMessage(e) {
			if (e.origin !== window.location.origin) return;
			const data = e.data;
			if (data?.type !== 'notion-oauth-callback') return;

			if (data.state !== pendingOAuthState) {
				oauthError = '認証に失敗しました（state mismatch）';
				pendingOAuthState = null;
				return;
			}

			pendingOAuthState = null;

			if (data.error) {
				oauthError = `接続に失敗しました: ${data.error}`;
				return;
			}

			if (data.token) {
				saveMcpConfig({
					id: 'notion',
					token: data.token,
					refreshToken: data.refreshToken || undefined,
					clientId: data.clientId || undefined,
					clientSecret: data.clientSecret || undefined,
					tokenEndpoint: data.tokenEndpoint || undefined,
					expiresAt: data.expiresIn ? Date.now() + data.expiresIn * 1000 : undefined
				});
				oauthError = '';
				onUpdate();
			}
		}

		window.addEventListener('message', handleMessage);
		return () => window.removeEventListener('message', handleMessage);
	});

	/**
	 * @param {import('$lib/mcpStore.js').McpServerDef} server
	 */
	function startOAuth(server) {
		oauthError = '';
		const state = crypto.randomUUID();
		pendingOAuthState = state;
		const url = `${server.authUrl}?state=${encodeURIComponent(state)}`;
		window.open(url, 'notion-oauth', 'width=600,height=700,popup=yes');
	}

	/**
	 * @param {string} id
	 */
	function isConnected(id) {
		return configs.some((c) => c.id === id && c.token);
	}

	/**
	 * @param {string} id
	 * @returns {string}
	 */
	function getExpiryInfo(id) {
		const config = configs.find((c) => c.id === id);
		if (!config?.expiresAt) return '';
		const remaining = config.expiresAt - Date.now();
		if (remaining <= 0) return '(トークン期限切れ - 次回リクエスト時に自動更新)';
		const minutes = Math.floor(remaining / 60000);
		return `(残り${minutes}分)`;
	}

	/**
	 * @param {string} id
	 */
	function handleDisconnect(id) {
		removeMcpConfig(id);
		oauthError = '';
		onUpdate();
	}

	/**
	 * @param {KeyboardEvent} e
	 */
	function handleKeydown(e) {
		if (e.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-overlay" onclick={onClose} onkeydown={() => {}}>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
		<div class="modal-header">
			<h2>MCP Servers</h2>
			<button class="close-btn" onclick={onClose} aria-label="Close">
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
					<line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/>
				</svg>
			</button>
		</div>

		{#if oauthError}
			<div class="error-msg">{oauthError}</div>
		{/if}

		<div class="server-list">
			{#each MCP_CATALOG as server (server.id)}
				{@const connected = isConnected(server.id)}
				<div class="server-card" class:connected>
					<div class="server-info">
						<div class="server-name">
							<span class="server-label">{server.label}</span>
							{#if connected}
								<span class="status-badge">接続中</span>
							{/if}
						</div>
						<span class="server-desc">{server.description}</span>
						{#if connected}
							<span class="workspace-name">{getExpiryInfo(server.id)}</span>
						{/if}
					</div>

					<div class="server-actions">
						{#if connected}
							<button class="disconnect-btn" onclick={() => handleDisconnect(server.id)}>
								切断
							</button>
						{:else}
							<button
								class="connect-btn"
								onclick={() => startOAuth(server)}
								disabled={pendingOAuthState !== null}
							>
								{#if pendingOAuthState}
									認証中...
								{:else}
									{server.label}と接続
								{/if}
							</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: var(--overlay-bg);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 200;
	}

	.modal {
		background: var(--bg-secondary);
		border: 1px solid var(--border-primary);
		border-radius: 12px;
		padding: 24px;
		width: 90%;
		max-width: 440px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	h2 {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}

	.close-btn:hover {
		background: var(--bg-hover);
		color: var(--text-primary);
	}

	.error-msg {
		font-size: 0.85rem;
		color: #e55;
		padding: 8px 12px;
		border: 1px solid #e5555540;
		border-radius: 8px;
		background: #e5555510;
	}

	.server-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.server-card {
		border: 1px solid var(--border-primary);
		border-radius: 10px;
		padding: 14px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		transition: border-color 0.15s;
	}

	.server-card.connected {
		border-color: var(--accent);
	}

	.server-info {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.server-name {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.server-label {
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.status-badge {
		font-size: 0.7rem;
		padding: 2px 8px;
		border-radius: 10px;
		background: var(--accent);
		color: white;
		font-weight: 500;
	}

	.server-desc {
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.workspace-name {
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.server-actions {
		display: flex;
		justify-content: flex-end;
	}

	.connect-btn {
		padding: 8px 20px;
		border: none;
		border-radius: 6px;
		background: var(--accent);
		color: white;
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		white-space: nowrap;
		transition: opacity 0.15s;
	}

	.connect-btn:hover:not(:disabled) {
		opacity: 0.85;
	}

	.connect-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.disconnect-btn {
		padding: 6px 14px;
		border: 1px solid var(--border-primary);
		border-radius: 6px;
		background: transparent;
		color: var(--text-muted);
		font-size: 0.8rem;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}

	.disconnect-btn:hover {
		background: var(--bg-hover);
		color: #e55;
	}
</style>
