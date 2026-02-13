<script>
	/** @type {import('./types.js').Conversation[]} */
	let { conversations = [], activeId = '', onSelect, onNew, onDelete, onOpenSettings } = $props();

	let open = $state(false);

	/** @type {import('./types.js').Conversation[]} */
	let sorted = $derived(
		[...conversations].sort((a, b) => b.updatedAt - a.updatedAt)
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
		<rect x="2" y="4" width="16" height="2" rx="1"/>
		<rect x="2" y="9" width="16" height="2" rx="1"/>
		<rect x="2" y="14" width="16" height="2" rx="1"/>
	</svg>
</button>

<!-- Overlay for mobile -->
{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="overlay" onclick={() => open = false} onkeydown={() => {}}></div>
{/if}

<aside class="sidebar" class:open>
	<button class="new-chat-btn" onclick={onNew}>
		<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
			<line x1="8" y1="2" x2="8" y2="14"/><line x1="2" y1="8" x2="14" y2="8"/>
		</svg>
		New Chat
	</button>

	<nav class="conversation-list">
		{#each sorted as conv (conv.id)}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="conv-item"
				class:active={conv.id === activeId}
				onclick={() => handleSelect(conv.id)}
				onkeydown={(e) => { if (e.key === 'Enter') handleSelect(conv.id); }}
				role="button"
				tabindex="0"
			>
				<span class="conv-title">{conv.title}</span>
				<button
					class="delete-btn"
					onclick={(e) => handleDelete(e, conv.id)}
					aria-label="Delete conversation"
				>
					<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
						<line x1="3" y1="3" x2="11" y2="11"/><line x1="11" y1="3" x2="3" y2="11"/>
					</svg>
				</button>
			</div>
		{/each}
	</nav>

	<button class="settings-btn" onclick={onOpenSettings}>
		<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
			<circle cx="9" cy="9" r="2.5"/>
			<path d="M14.7 11.1a1.2 1.2 0 0 0 .2 1.3l.1.1a1.5 1.5 0 1 1-2.1 2.1l-.1-.1a1.2 1.2 0 0 0-1.3-.2 1.2 1.2 0 0 0-.7 1.1v.1a1.5 1.5 0 1 1-3 0v-.1a1.2 1.2 0 0 0-.8-1.1 1.2 1.2 0 0 0-1.3.2l-.1.1a1.5 1.5 0 1 1-2.1-2.1l.1-.1a1.2 1.2 0 0 0 .2-1.3 1.2 1.2 0 0 0-1.1-.7h-.1a1.5 1.5 0 1 1 0-3h.1a1.2 1.2 0 0 0 1.1-.8 1.2 1.2 0 0 0-.2-1.3l-.1-.1a1.5 1.5 0 1 1 2.1-2.1l.1.1a1.2 1.2 0 0 0 1.3.2h.1a1.2 1.2 0 0 0 .7-1.1v-.1a1.5 1.5 0 1 1 3 0v.1a1.2 1.2 0 0 0 .7 1.1 1.2 1.2 0 0 0 1.3-.2l.1-.1a1.5 1.5 0 1 1 2.1 2.1l-.1.1a1.2 1.2 0 0 0-.2 1.3v.1a1.2 1.2 0 0 0 1.1.7h.1a1.5 1.5 0 0 1 0 3h-.1a1.2 1.2 0 0 0-1.1.7z"/>
		</svg>
		Settings
	</button>
</aside>

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
		z-index: 1;
	}

	.new-chat-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
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
		transition: background 0.15s, color 0.15s;
		flex-shrink: 0;
	}

	.settings-btn:hover {
		background: var(--sidebar-hover);
		color: var(--sidebar-text);
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
		}

		.sidebar.open {
			transform: translateX(0);
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
