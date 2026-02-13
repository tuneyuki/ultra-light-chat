<script>
	/** @type {{ isStreaming: boolean, supportsImage: boolean, supportsImageGen: boolean, supportsCodeInterpreter: boolean, webSearch: boolean, imageGeneration: boolean, codeInterpreter: boolean, onSend: (text: string, images: File[]) => void, onStop: () => void }} */
	let { isStreaming, supportsImage, supportsImageGen, supportsCodeInterpreter, webSearch = $bindable(), imageGeneration = $bindable(), codeInterpreter = $bindable(), onSend, onStop } = $props();

	let inputText = $state('');
	/** @type {File[]} */
	let attachedImages = $state([]);
	/** @type {string[]} */
	let previewUrls = $state([]);

	/** @type {HTMLTextAreaElement | undefined} */
	let textareaEl;
	/** @type {HTMLInputElement | undefined} */
	let fileInputEl = $state();

	function autoResize() {
		if (!textareaEl) return;
		textareaEl.style.height = 'auto';
		textareaEl.style.height = Math.min(textareaEl.scrollHeight, 200) + 'px';
		textareaEl.style.overflowY = textareaEl.scrollHeight > 200 ? 'auto' : 'hidden';
	}

	function resetTextarea() {
		if (!textareaEl) return;
		textareaEl.style.height = 'auto';
		textareaEl.style.overflowY = 'hidden';
	}

	/**
	 * @param {File[]} files
	 */
	function addImages(files) {
		for (const file of files) {
			if (!file.type.startsWith('image/')) continue;
			attachedImages.push(file);
			previewUrls.push(URL.createObjectURL(file));
		}
	}

	/**
	 * @param {number} index
	 */
	function removeImage(index) {
		URL.revokeObjectURL(previewUrls[index]);
		attachedImages.splice(index, 1);
		previewUrls.splice(index, 1);
	}

	function clearImages() {
		for (const url of previewUrls) {
			URL.revokeObjectURL(url);
		}
		attachedImages = [];
		previewUrls = [];
	}

	function sendMessage() {
		const text = inputText.trim();
		if ((!text && attachedImages.length === 0) || isStreaming) return;
		const images = [...attachedImages];
		inputText = '';
		clearImages();
		resetTextarea();
		onSend(text, images);
	}

	/**
	 * @param {KeyboardEvent} e
	 */
	function handleKeydown(e) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}

	/**
	 * @param {ClipboardEvent} e
	 */
	function handlePaste(e) {
		if (!supportsImage || !e.clipboardData) return;
		const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'));
		if (files.length > 0) {
			e.preventDefault();
			addImages(files);
		}
	}

	/**
	 * @param {Event} e
	 */
	function handleFileChange(e) {
		const input = /** @type {HTMLInputElement} */ (e.target);
		if (input.files) {
			addImages(Array.from(input.files));
		}
		input.value = '';
	}
</script>

<footer class="input-area">
	<div class="input-wrapper">
		{#if previewUrls.length > 0}
			<div class="image-previews">
				{#each previewUrls as url, i}
					<div class="preview-item">
						<img src={url} alt="Attached" />
						<button class="preview-remove" onclick={() => removeImage(i)} aria-label="Remove image">
							<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M9.5 3.2L8.8 2.5 6 5.3 3.2 2.5 2.5 3.2 5.3 6 2.5 8.8l.7.7L6 6.7l2.8 2.8.7-.7L6.7 6z"/></svg>
						</button>
					</div>
				{/each}
			</div>
		{/if}
		<div class="input-row">
			{#if supportsImage}
				<input
					bind:this={fileInputEl}
					type="file"
					accept="image/*"
					multiple
					hidden
					onchange={handleFileChange}
				/>
				<button
					class="action-btn attach-btn"
					onclick={() => fileInputEl?.click()}
					disabled={isStreaming}
					aria-label="Attach image"
				>
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 8.5l-5.5 5.5a3.5 3.5 0 01-5-5L9 3.5a2.33 2.33 0 013.3 3.3L6.8 12.3a1.17 1.17 0 01-1.6-1.6L10.7 5"/></svg>
				</button>
			{/if}
			<textarea
				bind:this={textareaEl}
				bind:value={inputText}
				oninput={autoResize}
				onkeydown={handleKeydown}
				onpaste={handlePaste}
				placeholder="Message Ultra Light Chat..."
				rows="1"
				disabled={isStreaming}
			></textarea>
			{#if isStreaming}
				<button class="action-btn stop-btn" onclick={onStop} aria-label="Stop">
					<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="3" width="10" height="10" rx="1"/></svg>
				</button>
			{:else}
				<button
					class="action-btn send-btn"
					onclick={sendMessage}
					disabled={!inputText.trim() && attachedImages.length === 0}
					aria-label="Send"
				>
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 14V2M8 2L3 7M8 2l5 5"/></svg>
				</button>
			{/if}
		</div>
	</div>
	<div class="toolbar">
		<label class="toggle-label">
			<span class="toggle-track" class:active={webSearch}>
				<span class="toggle-thumb"></span>
			</span>
			<input type="checkbox" bind:checked={webSearch} hidden />
			<svg class="toggle-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="5"/><path d="M15 15l-3.5-3.5"/></svg>
			<span>Search</span>
		</label>
		{#if supportsImageGen}
			<label class="toggle-label">
				<span class="toggle-track" class:active={imageGeneration}>
					<span class="toggle-thumb"></span>
				</span>
				<input type="checkbox" bind:checked={imageGeneration} hidden />
				<svg class="toggle-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="12" height="12" rx="2"/><circle cx="5.5" cy="6" r="1.5"/><path d="M14 11l-3-3-5 5"/></svg>
				<span>Image</span>
			</label>
		{/if}
		{#if supportsCodeInterpreter}
			<label class="toggle-label">
				<span class="toggle-track" class:active={codeInterpreter}>
					<span class="toggle-thumb"></span>
				</span>
				<input type="checkbox" bind:checked={codeInterpreter} hidden />
				<svg class="toggle-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 3 1 8 4 13"/><polyline points="12 3 15 8 12 13"/><line x1="10" y1="2" x2="6" y2="14"/></svg>
				<span>Code</span>
			</label>
		{/if}
	</div>
	<p class="disclaimer">Ultra Light Chat can make mistakes. Check important info.</p>
</footer>

<style>
	.input-area {
		flex-shrink: 0;
		padding: 16px 24px 12px;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.input-wrapper {
		max-width: 768px;
		width: 100%;
		display: flex;
		flex-direction: column;
		background: var(--bg-input);
		border: 1px solid var(--border-secondary);
		border-radius: 16px;
		padding: 10px 12px 10px 12px;
		transition: border-color 0.15s;
	}

	.input-wrapper:focus-within {
		border-color: var(--accent);
	}

	.input-row {
		display: flex;
		align-items: flex-end;
		gap: 8px;
		padding-left: 6px;
	}

	.image-previews {
		display: flex;
		gap: 8px;
		padding: 0 6px 8px;
		overflow-x: auto;
	}

	.preview-item {
		position: relative;
		flex-shrink: 0;
	}

	.preview-item img {
		width: 56px;
		height: 56px;
		object-fit: cover;
		border-radius: 8px;
		border: 1px solid var(--border-primary);
	}

	.preview-remove {
		position: absolute;
		top: -6px;
		right: -6px;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: 1px solid var(--border-primary);
		background: var(--bg-secondary);
		color: var(--text-secondary);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		padding: 0;
	}

	.preview-remove:hover {
		background: var(--bg-hover);
		color: var(--text-primary);
	}

	textarea {
		flex: 1;
		border: none;
		background: transparent;
		color: var(--text-primary);
		font: inherit;
		font-size: 1rem;
		resize: none;
		outline: none;
		overflow-y: hidden;
		line-height: 1.5;
	}

	textarea::placeholder {
		color: var(--text-muted);
	}

	textarea:disabled {
		opacity: 0.5;
	}

	.action-btn {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: background 0.15s;
	}

	.attach-btn {
		background: transparent;
		color: var(--text-muted);
	}

	.attach-btn:hover:not(:disabled) {
		color: var(--text-primary);
		background: var(--bg-hover);
	}

	.attach-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.send-btn {
		background: var(--btn-primary-bg);
		color: var(--btn-primary-color);
	}

	.send-btn:hover:not(:disabled) {
		background: var(--btn-primary-hover);
	}

	.send-btn:disabled {
		background: var(--btn-disabled-bg);
		color: var(--btn-disabled-color);
		cursor: default;
	}

	.stop-btn {
		background: var(--btn-primary-bg);
		color: var(--btn-primary-color);
	}

	.stop-btn:hover {
		background: var(--btn-primary-hover);
	}

	.toolbar {
		max-width: 768px;
		width: 100%;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 6px 6px 0;
	}

	.toggle-label {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 0.75rem;
		color: var(--text-muted);
		cursor: pointer;
		user-select: none;
	}

	.toggle-label:hover {
		color: var(--text-secondary);
	}

	.toggle-icon {
		flex-shrink: 0;
	}

	.toggle-track {
		position: relative;
		width: 28px;
		height: 16px;
		border-radius: 8px;
		background: var(--btn-disabled-bg);
		transition: background 0.2s;
		flex-shrink: 0;
	}

	.toggle-track.active {
		background: var(--accent);
	}

	.toggle-thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: white;
		transition: transform 0.2s;
	}

	.toggle-track.active .toggle-thumb {
		transform: translateX(12px);
	}

	.disclaimer {
		font-size: 0.75rem;
		color: var(--text-muted);
		margin-top: 8px;
		text-align: center;
	}
</style>
