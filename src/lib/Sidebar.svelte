<script>
	import { onMount } from "svelte";

	/** @type {{ conversations: import('./types.js').Conversation[], activeId: string, onSelect: (id: string) => void, onNew: () => void, onDelete: (id: string) => void, onDeleteAll: () => void, onOpenSettings: () => void }} */
	let {
		conversations = [],
		activeId = "",
		onSelect,
		onNew,
		onDelete,
		onDeleteAll,
		onOpenSettings,
	} = $props();

	let open = $state(false);
	let collapsed = $state(false);
	let showDeleteAllConfirm = $state(false);

	onMount(() => {
		collapsed = localStorage.getItem("ulc-sidebar-collapsed") === "true";
	});

	function toggleCollapse() {
		collapsed = !collapsed;
		localStorage.setItem("ulc-sidebar-collapsed", String(collapsed));
	}

	/** @type {import('./types.js').Conversation[]} */
	let sorted = $derived(
		[...conversations].sort((a, b) => b.updatedAt - a.updatedAt),
	);

	function toggleSidebar() {
		open = !open;
	}

	/**
	 * @param {string} id
	 */
	function handleSelect(id) {
		onSelect(id);
		open = false;
	}

	/**
	 * @param {Event} e
	 * @param {string} id
	 */
	function handleDelete(e, id) {
		e.stopPropagation();
		onDelete(id);
	}
</script>

<!-- Mobile toggle -->
<button class="hamburger" onclick={toggleSidebar} aria-label="Toggle sidebar">
	<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
		<rect x="2" y="4" width="16" height="2" rx="1" />
		<rect x="2" y="9" width="16" height="2" rx="1" />
		<rect x="2" y="14" width="16" height="2" rx="1" />
	</svg>
</button>

<!-- Desktop expand button (shown when collapsed) -->
{#if collapsed}
	<button
		class="expand-btn"
		onclick={toggleCollapse}
		aria-label="Expand sidebar"
		title="サイドバーを展開"
	>
		<svg
			width="18"
			height="18"
			viewBox="0 0 18 18"
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<rect x="1" y="2" width="16" height="14" rx="2" />
			<line x1="6" y1="2" x2="6" y2="16" />
			<polyline points="9,7 12,9 9,11" />
		</svg>
	</button>
{/if}

<!-- Overlay for mobile -->
{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="overlay"
		onclick={() => (open = false)}
		onkeydown={() => {}}
	></div>
{/if}

<aside class="sidebar" class:open class:collapsed>
	<div class="sidebar-top-row">
		<button class="new-chat-btn" onclick={onNew}>
			<svg
				width="16"
				height="16"
				viewBox="0 0 16 16"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
			>
				<line x1="8" y1="2" x2="8" y2="14" /><line
					x1="2"
					y1="8"
					x2="14"
					y2="8"
				/>
			</svg>
			New Chat
		</button>
		<button
			class="collapse-btn"
			onclick={toggleCollapse}
			aria-label="Collapse sidebar"
			title="サイドバーを折りたたむ"
		>
			<svg
				width="18"
				height="18"
				viewBox="0 0 18 18"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<rect x="1" y="2" width="16" height="14" rx="2" />
				<line x1="6" y1="2" x2="6" y2="16" />
				<polyline points="12,7 9,9 12,11" />
			</svg>
		</button>
	</div>

	<hr class="sidebar-divider" />

	<nav class="conversation-list">
		{#each sorted as conv (conv.id)}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="conv-item"
				class:active={conv.id === activeId}
				onclick={() => handleSelect(conv.id)}
				onkeydown={(e) => {
					if (e.key === "Enter") handleSelect(conv.id);
				}}
				role="button"
				tabindex="0"
			>
				<span class="conv-title">{conv.title}</span>
				<button
					class="delete-btn"
					onclick={(e) => handleDelete(e, conv.id)}
					aria-label="Delete conversation"
				>
					<svg
						width="14"
						height="14"
						viewBox="0 0 14 14"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
					>
						<line x1="3" y1="3" x2="11" y2="11" /><line
							x1="11"
							y1="3"
							x2="3"
							y2="11"
						/>
					</svg>
				</button>
			</div>
		{/each}
	</nav>

	<hr class="sidebar-divider" />

	{#if conversations.length > 0}
		<button
			class="delete-all-btn"
			onclick={() => (showDeleteAllConfirm = true)}
		>
			<svg
				width="16"
				height="16"
				viewBox="0 0 16 16"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				><path
					d="M2 4h12M5.3 4V2.7a1.3 1.3 0 011.4-1.4h2.6a1.3 1.3 0 011.4 1.4V4M12.7 4v9.3a1.3 1.3 0 01-1.4 1.4H4.7a1.3 1.3 0 01-1.4-1.4V4"
				/></svg
			>
			履歴を全削除
		</button>
	{/if}

	<button class="settings-btn" onclick={onOpenSettings}>
		<svg
			width="18"
			height="18"
			viewBox="0 0 18 18"
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<circle cx="9" cy="9" r="2.5" />
			<path
				d="M14.7 11.1a1.2 1.2 0 0 0 .2 1.3l.1.1a1.5 1.5 0 1 1-2.1 2.1l-.1-.1a1.2 1.2 0 0 0-1.3-.2 1.2 1.2 0 0 0-.7 1.1v.1a1.5 1.5 0 1 1-3 0v-.1a1.2 1.2 0 0 0-.8-1.1 1.2 1.2 0 0 0-1.3.2l-.1.1a1.5 1.5 0 1 1-2.1-2.1l.1-.1a1.2 1.2 0 0 0 .2-1.3 1.2 1.2 0 0 0-1.1-.7h-.1a1.5 1.5 0 1 1 0-3h.1a1.2 1.2 0 0 0 1.1-.8 1.2 1.2 0 0 0-.2-1.3l-.1-.1a1.5 1.5 0 1 1 2.1-2.1l.1.1a1.2 1.2 0 0 0 1.3.2h.1a1.2 1.2 0 0 0 .7-1.1v-.1a1.5 1.5 0 1 1 3 0v.1a1.2 1.2 0 0 0 .7 1.1 1.2 1.2 0 0 0 1.3-.2l.1-.1a1.5 1.5 0 1 1 2.1 2.1l-.1.1a1.2 1.2 0 0 0-.2 1.3v.1a1.2 1.2 0 0 0 1.1.7h.1a1.5 1.5 0 0 1 0 3h-.1a1.2 1.2 0 0 0-1.1.7z"
			/>
		</svg>
		Settings
	</button>
</aside>

{#if showDeleteAllConfirm}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="confirm-overlay"
		onclick={() => (showDeleteAllConfirm = false)}
		onkeydown={() => {}}
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="confirm-modal"
			onclick={(e) => e.stopPropagation()}
			onkeydown={() => {}}
		>
			<p class="confirm-title">履歴を全削除しますか？</p>
			<p class="confirm-desc">
				すべてのチャット履歴が削除されます。この操作は元に戻せません。
			</p>
			<div class="confirm-actions">
				<button
					class="confirm-btn confirm-cancel"
					onclick={() => (showDeleteAllConfirm = false)}
					>キャンセル</button
				>
				<button
					class="confirm-btn confirm-delete"
					onclick={() => {
						showDeleteAllConfirm = false;
						onDeleteAll();
					}}>全削除</button
				>
			</div>
		</div>
	</div>
{/if}

<style>
	.sidebar {
		width: 260px;
		height: 100vh;
		height: 100dvh;
		background: var(--bg-sidebar);
		display: flex;
		flex-direction: column;
		padding: 12px;
		gap: 8px;
		flex-shrink: 0;
		overflow-y: auto;
		box-shadow: var(--sidebar-shadow);
		border-right: 1px solid var(--sidebar-border);
		z-index: 1;
		transition:
			width 0.2s ease,
			padding 0.2s ease,
			opacity 0.2s ease;
	}

	.sidebar.collapsed {
		width: 0;
		padding: 0;
		overflow: hidden;
		border-right: none;
	}

	.sidebar-top-row {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}

	.new-chat-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
		min-width: 0;
		padding: 10px 12px;
		border: 1px solid var(--sidebar-border);
		border-radius: 8px;
		background: transparent;
		color: var(--sidebar-text);
		font-size: 0.875rem;
		cursor: pointer;
		transition: background 0.15s;
	}

	.new-chat-btn:hover {
		background: var(--sidebar-hover);
	}

	.collapse-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border: 1px solid var(--sidebar-border);
		border-radius: 8px;
		background: transparent;
		color: var(--sidebar-text-muted);
		cursor: pointer;
		flex-shrink: 0;
		transition:
			background 0.15s,
			color 0.15s;
	}

	.collapse-btn:hover {
		background: var(--sidebar-hover);
		color: var(--sidebar-text);
	}

	.expand-btn {
		display: none;
		position: fixed;
		top: 12px;
		left: 12px;
		z-index: 2;
		width: 36px;
		height: 36px;
		border: 1px solid var(--border-primary);
		border-radius: 8px;
		background: var(--bg-secondary);
		color: var(--text-muted);
		cursor: pointer;
		align-items: center;
		justify-content: center;
		transition:
			background 0.15s,
			color 0.15s;
	}

	.expand-btn:hover {
		background: var(--bg-hover);
		color: var(--text-primary);
	}

	.conversation-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		overflow-y: auto;
		flex: 1;
	}

	.conv-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 10px 12px;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--sidebar-text-muted);
		font-size: 0.875rem;
		cursor: pointer;
		text-align: left;
		transition: background 0.15s;
	}

	.conv-item:hover {
		background: var(--sidebar-hover);
	}

	.conv-item.active {
		background: var(--sidebar-active);
		color: var(--sidebar-text);
	}

	.conv-title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
		min-width: 0;
	}

	.delete-btn {
		display: none;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: var(--sidebar-text-muted);
		cursor: pointer;
		flex-shrink: 0;
		padding: 0;
	}

	.conv-item:hover .delete-btn {
		display: flex;
	}

	.delete-btn:hover {
		background: var(--sidebar-hover);
		color: var(--sidebar-text);
	}

	.settings-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 10px 12px;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--sidebar-text-muted);
		font-size: 0.875rem;
		cursor: pointer;
		transition:
			background 0.15s,
			color 0.15s;
		flex-shrink: 0;
	}

	.settings-btn:hover {
		background: var(--sidebar-hover);
		color: var(--sidebar-text);
	}

	.sidebar-divider {
		border: none;
		border-top: 1px solid var(--sidebar-border);
		margin: 4px 0;
	}

	.delete-all-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 10px 12px;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--sidebar-text-muted);
		font-size: 0.875rem;
		cursor: pointer;
		transition:
			background 0.15s,
			color 0.15s;
		flex-shrink: 0;
	}

	.delete-all-btn:hover {
		background: var(--sidebar-hover);
		color: #e55;
	}

	.confirm-overlay {
		position: fixed;
		inset: 0;
		background: var(--overlay-bg);
		z-index: 200;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.confirm-modal {
		background: var(--bg-primary);
		border: 1px solid var(--border-primary);
		border-radius: 12px;
		padding: 24px;
		max-width: 360px;
		width: 90%;
	}

	.confirm-title {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0 0 8px;
	}

	.confirm-desc {
		font-size: 0.85rem;
		color: var(--text-muted);
		margin: 0 0 20px;
		line-height: 1.5;
	}

	.confirm-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}

	.confirm-btn {
		padding: 8px 16px;
		border-radius: 8px;
		border: none;
		font-size: 0.85rem;
		cursor: pointer;
		transition: background 0.15s;
	}

	.confirm-cancel {
		background: var(--bg-secondary);
		color: var(--text-primary);
	}

	.confirm-cancel:hover {
		background: var(--bg-hover);
	}

	.confirm-delete {
		background: #e55;
		color: white;
	}

	.confirm-delete:hover {
		background: #d33;
	}

	/* Hamburger button (mobile only) */
	.hamburger {
		display: none;
		position: fixed;
		top: 12px;
		left: 12px;
		z-index: 100;
		width: 36px;
		height: 36px;
		border: none;
		border-radius: 8px;
		background: var(--bg-secondary);
		color: var(--text-primary);
		cursor: pointer;
		align-items: center;
		justify-content: center;
	}

	.hamburger:hover {
		background: var(--bg-active);
	}

	.overlay {
		display: none;
	}

	/* Desktop: show expand button and collapse button */
	@media (min-width: 769px) {
		.expand-btn {
			display: flex;
		}
	}

	/* Mobile responsive */
	@media (max-width: 768px) {
		.hamburger {
			display: flex;
		}

		.sidebar {
			position: fixed;
			top: 0;
			left: 0;
			z-index: 50;
			transform: translateX(-100%);
			transition: transform 0.2s ease;
			width: 260px !important;
			padding: 12px !important;
			overflow-y: auto !important;
			border-right: 1px solid var(--sidebar-border) !important;
		}

		.sidebar.open {
			transform: translateX(0);
		}

		.collapse-btn {
			display: none;
		}

		.expand-btn {
			display: none !important;
		}

		.overlay {
			display: block;
			position: fixed;
			inset: 0;
			background: var(--overlay-bg);
			z-index: 40;
		}
	}
</style>
