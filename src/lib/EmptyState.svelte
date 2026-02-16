<script>
	import { MODELS } from "$lib/models.js";
	import { generateId } from "$lib/utils.js";

	/** @type {{
	 *   models: { id: string, label: string }[],
	 *   currentModel: string,
	 *   currentSystemPrompt: string,
	 *   reasoningEffort: string,
	 *   prompts: import('$lib/promptStore.js').SavedPrompt[],
	 *   onSavePrompt: (prompt: import('$lib/promptStore.js').SavedPrompt) => void,
	 *   onDeletePrompt: (id: string) => void
	 * }} */
	let {
		models,
		currentModel = $bindable(),
		currentSystemPrompt = $bindable(),
		reasoningEffort = $bindable(),
		prompts = [],
		onSavePrompt,
		onDeletePrompt,
	} = $props();

	let reasoningEfforts = $derived(
		MODELS.find((m) => m.id === currentModel)?.reasoningEfforts ?? null,
	);

	let selectedPromptId = $state("");

	function handlePromptSelect() {
		if (!selectedPromptId) {
			currentSystemPrompt = "";
			return;
		}
		const found = prompts.find((p) => p.id === selectedPromptId);
		if (found) {
			currentSystemPrompt = found.content;
		}
	}

	function handleSave() {
		const content = currentSystemPrompt.trim();
		if (!content) return;
		const name = prompt("プロンプト名を入力:");
		if (!name) return;
		const id = generateId();
		onSavePrompt({ id, name, content });
		selectedPromptId = id;
	}

	function handleDelete() {
		if (!selectedPromptId) return;
		onDeletePrompt(selectedPromptId);
		selectedPromptId = "";
		currentSystemPrompt = "";
	}
</script>

<div class="empty-state">
	<h1>Ultra Light Chat</h1>
	<p>How can I help you today?</p>

	<div class="setup-panel">
		<div class="setup-field">
			<label class="setup-label" for="model-select">Model</label>
			<select
				id="model-select"
				class="setup-select"
				bind:value={currentModel}
			>
				{#each models as m (m.id)}
					<option value={m.id}>{m.label}</option>
				{/each}
			</select>
		</div>
		{#if reasoningEfforts}
			<div class="setup-field">
				<label class="setup-label" for="reasoning-select"
					>Reasoning Effort</label
				>
				<select
					id="reasoning-select"
					class="setup-select"
					bind:value={reasoningEffort}
				>
					{#each reasoningEfforts as level (level)}
						<option value={level}
							>{level === "minimal"
								? "minimal (=none)"
								: level}</option
						>
					{/each}
				</select>
			</div>
		{/if}
		<div class="setup-field">
			<div class="prompt-header">
				<label class="setup-label" for="system-prompt"
					>System Prompt</label
				>
				<select
					class="prompt-select"
					bind:value={selectedPromptId}
					onchange={handlePromptSelect}
				>
					<option value="">なし</option>
					{#each prompts as p (p.id)}
						<option value={p.id}>{p.name}</option>
					{/each}
				</select>
				<button
					class="prompt-btn"
					onclick={handleSave}
					title="現在のプロンプトを保存">+</button
				>
				{#if selectedPromptId}
					<button
						class="prompt-btn prompt-btn-delete"
						onclick={handleDelete}
						title="選択中のプロンプトを削除">×</button
					>
				{/if}
			</div>
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

	.prompt-header {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.prompt-select {
		flex: 1;
		min-width: 0;
		padding: 4px 8px;
		border: 1px solid var(--border-primary);
		border-radius: 6px;
		background: var(--bg-input);
		color: var(--text-primary);
		font: inherit;
		font-size: 0.8rem;
		outline: none;
		cursor: pointer;
	}

	.prompt-select:focus {
		border-color: var(--border-secondary);
	}

	.prompt-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border: 1px solid var(--border-primary);
		border-radius: 6px;
		background: var(--bg-input);
		color: var(--text-primary);
		font-size: 1rem;
		cursor: pointer;
		flex-shrink: 0;
		transition: border-color 0.15s;
	}

	.prompt-btn:hover {
		border-color: var(--border-secondary);
	}

	.prompt-btn-delete {
		color: #e55;
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
