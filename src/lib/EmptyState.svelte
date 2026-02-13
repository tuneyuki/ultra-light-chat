<script>
	/** @type {{ models: { id: string, label: string }[], currentModel: string, currentSystemPrompt: string }} */
	let { models, currentModel = $bindable(), currentSystemPrompt = $bindable() } = $props();
</script>

<div class="empty-state">
	<h1>Ultra Light Chat</h1>
	<p>How can I help you today?</p>

	<div class="setup-panel">
		<div class="setup-field">
			<label class="setup-label" for="model-select">Model</label>
			<select id="model-select" class="setup-select" bind:value={currentModel}>
				{#each models as m (m.id)}
					<option value={m.id}>{m.label}</option>
				{/each}
			</select>
		</div>
		<div class="setup-field">
			<label class="setup-label" for="system-prompt">System Prompt</label>
			<textarea
				id="system-prompt"
				class="setup-textarea"
				bind:value={currentSystemPrompt}
				placeholder="You are a helpful assistant..."
				rows="3"
			></textarea>
		</div>
	</div>
</div>

<style>
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 8px;
	}

	.empty-state h1 {
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.empty-state p {
		color: var(--text-muted);
		font-size: 1rem;
	}

	.setup-panel {
		width: 100%;
		max-width: 480px;
		display: flex;
		flex-direction: column;
		gap: 14px;
		margin-top: 24px;
		padding: 0 16px;
	}

	.setup-field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.setup-label {
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.setup-select {
		width: 100%;
		padding: 10px 12px;
		border: 1px solid var(--border-primary);
		border-radius: 8px;
		background: var(--bg-input);
		color: var(--text-primary);
		font: inherit;
		font-size: 0.9rem;
		outline: none;
		cursor: pointer;
		transition: border-color 0.15s;
	}

	.setup-select:focus {
		border-color: var(--border-secondary);
	}

	.setup-textarea {
		width: 100%;
		padding: 10px 12px;
		border: 1px solid var(--border-primary);
		border-radius: 8px;
		background: var(--bg-input);
		color: var(--text-primary);
		font: inherit;
		font-size: 0.9rem;
		resize: vertical;
		outline: none;
		min-height: 60px;
		max-height: 160px;
		line-height: 1.5;
		transition: border-color 0.15s;
	}

	.setup-textarea::placeholder {
		color: var(--text-muted);
	}

	.setup-textarea:focus {
		border-color: var(--border-secondary);
	}
</style>
