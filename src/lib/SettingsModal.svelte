<script>
	let { theme = 'dark', onThemeChange, onClose } = $props();

	/**
	 * @param {KeyboardEvent} e
	 */
	function handleKeydown(e) {
		if (e.key === 'Escape') {
			onClose();
		}
	}

	/**
	 * @param {string} value
	 */
	function selectTheme(value) {
		onThemeChange(value);
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-overlay" onclick={onClose} onkeydown={() => {}}>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
		<div class="modal-header">
			<h2>Settings</h2>
			<button class="close-btn" onclick={onClose} aria-label="Close">
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
					<line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/>
				</svg>
			</button>
		</div>

		<div class="setting-row">
			<span class="setting-label">Theme</span>
			<div class="theme-toggle">
				<button
					class="toggle-option"
					class:active={theme === 'light'}
					onclick={() => selectTheme('light')}
				>
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
						<circle cx="8" cy="8" r="3"/>
						<line x1="8" y1="1" x2="8" y2="3"/><line x1="8" y1="13" x2="8" y2="15"/>
						<line x1="1" y1="8" x2="3" y2="8"/><line x1="13" y1="8" x2="15" y2="8"/>
						<line x1="3.05" y1="3.05" x2="4.46" y2="4.46"/>
						<line x1="11.54" y1="11.54" x2="12.95" y2="12.95"/>
						<line x1="3.05" y1="12.95" x2="4.46" y2="11.54"/>
						<line x1="11.54" y1="4.46" x2="12.95" y2="3.05"/>
					</svg>
					Light
				</button>
				<button
					class="toggle-option"
					class:active={theme === 'dark'}
					onclick={() => selectTheme('dark')}
				>
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
						<path d="M14 8.5A6.5 6.5 0 0 1 7.5 2a6.5 6.5 0 1 0 6.5 6.5z"/>
					</svg>
					Dark
				</button>
			</div>
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
		max-width: 400px;
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

	.setting-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.setting-label {
		font-size: 0.9rem;
		color: var(--text-primary);
	}

	.theme-toggle {
		display: flex;
		border: 1px solid var(--border-primary);
		border-radius: 8px;
		overflow: hidden;
	}

	.toggle-option {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 16px;
		border: none;
		background: transparent;
		color: var(--text-muted);
		font-size: 0.85rem;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}

	.toggle-option:first-child {
		border-right: 1px solid var(--border-primary);
	}

	.toggle-option.active {
		background: var(--bg-hover);
		color: var(--text-primary);
		font-weight: 600;
	}

	.toggle-option:hover:not(.active) {
		background: var(--bg-tertiary);
	}
</style>
