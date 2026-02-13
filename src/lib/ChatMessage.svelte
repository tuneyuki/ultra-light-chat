<script>
	import { marked } from 'marked';

	const renderer = new marked.Renderer();
	renderer.code = function ({ text, lang }) {
		const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
		const langLabel = lang || '';
		return `<div class="code-block"><div class="code-header"><span class="code-lang">${langLabel}</span><button class="copy-btn" data-code="${text.replace(/"/g, '&quot;')}">Copy</button></div><pre><code>${escaped}</code></pre></div>`;
	};
	marked.setOptions({ breaks: true, renderer });

	/** @type {{ message: import('$lib/types.js').Message, isStreaming: boolean, isLast: boolean, imageUrls?: string[], streamingStatus?: string, streamingCode?: string }} */
	let { message, isStreaming, isLast, imageUrls = [], streamingStatus = '', streamingCode = '' } = $props();

	/** @type {Record<string, string>} */
	const statusLabels = {
		'response.web_search_call.searching': '検索中...',
		'response.code_interpreter_call.interpreting': 'コード実行中...',
		'response.image_generation_call.generating': '画像生成中...',
	};
</script>

<div class="message {message.role}">
	<div class="message-inner">
		<div class="avatar" class:avatar-user={message.role === 'user'} class:avatar-assistant={message.role === 'assistant'}>
			{#if message.role === 'user'}U{:else}AI{/if}
		</div>
		<div class="message-body">
			<div class="role-name">{message.role === 'user' ? 'You' : 'Assistant'}</div>
			{#if message.role === 'user' && imageUrls && imageUrls.length > 0}
				<div class="message-images">
					{#each imageUrls as url}
						<img class="message-image" src={url} alt="Attached" />
					{/each}
				</div>
			{/if}
			{#if message.role === 'assistant' && message.content === '' && !(imageUrls && imageUrls.length > 0) && isStreaming && isLast}
				{#if streamingStatus}
					<div class="status-indicator">
						<span class="status-label">{statusLabels[streamingStatus] ?? streamingStatus}</span>
						<span class="status-dot"></span>
					</div>
					{#if streamingCode}
						<div class="status-code-block">
							<pre><code>{streamingCode}</code></pre>
						</div>
					{/if}
				{:else}
					<span class="typing-indicator">
						<span></span><span></span><span></span>
					</span>
				{/if}
			{:else if message.role === 'assistant'}
				<div class="content markdown">{@html marked.parse(message.content)}</div>
			{:else}
				<div class="content">{message.content}</div>
			{/if}
			{#if message.role === 'assistant' && imageUrls && imageUrls.length > 0}
				<div class="message-images generated-images">
					{#each imageUrls as url}
						<img class="message-image generated-image" src={url} alt="Generated" />
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.message {
		padding: 24px 0;
	}

	.message-inner {
		max-width: 768px;
		margin: 0 auto;
		padding: 0 24px;
		display: flex;
		gap: 16px;
		align-items: flex-start;
	}

	.avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.7rem;
		font-weight: 700;
		flex-shrink: 0;
		margin-top: 2px;
	}

	.avatar-user {
		background: var(--avatar-user);
		color: var(--accent-text);
	}

	.avatar-assistant {
		background: var(--avatar-assistant);
		color: var(--accent-text);
	}

	.message-body {
		flex: 1;
		min-width: 0;
	}

	.role-name {
		font-weight: 600;
		font-size: 0.9rem;
		margin-bottom: 4px;
		color: var(--text-primary);
	}

	.content {
		line-height: 1.7;
		word-break: break-word;
	}

	.message.user .content {
		white-space: pre-wrap;
	}

	.message-images {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		margin-bottom: 8px;
	}

	.message-image {
		max-width: 200px;
		max-height: 200px;
		object-fit: contain;
		border-radius: 8px;
		border: 1px solid var(--border-primary);
	}

	.generated-images {
		margin-top: 8px;
	}

	.generated-image {
		max-width: 512px;
		max-height: 512px;
	}

	/* Typing indicator */
	.typing-indicator {
		display: flex;
		gap: 4px;
		padding: 4px 0;
	}

	.typing-indicator span {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--text-muted);
		animation: blink 1.4s infinite both;
	}

	.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
	.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

	@keyframes blink {
		0%, 80%, 100% { opacity: 0.3; }
		40% { opacity: 1; }
	}

	/* Streaming status indicator */
	.status-indicator {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 0;
	}

	.status-label {
		font-size: 0.875rem;
		color: var(--text-secondary);
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--text-muted);
		animation: pulse 1.4s infinite ease-in-out;
	}

	@keyframes pulse {
		0%, 100% { opacity: 0.3; transform: scale(1); }
		50% { opacity: 1; transform: scale(1.2); }
	}

	.status-code-block {
		margin-top: 8px;
		border-radius: 8px;
		overflow: hidden;
		background: var(--bg-code);
		max-height: 300px;
		overflow-y: auto;
	}

	.status-code-block pre {
		margin: 0;
		padding: 14px 16px;
		font-size: 0.875rem;
		overflow-x: auto;
	}

	.status-code-block code {
		font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', 'Fira Code', Menlo, Consolas, monospace;
		font-size: 1em;
		white-space: pre-wrap;
		word-break: break-word;
	}

	/* Markdown rendering styles */
	:global(:root.dark) .markdown :global(a) {
		color: #7ba4f0;
	}

	.markdown :global(p) {
		margin: 0.5em 0;
	}

	.markdown :global(p:first-child) {
		margin-top: 0;
	}

	.markdown :global(p:last-child) {
		margin-bottom: 0;
	}

	.markdown :global(.code-block) {
		border-radius: 8px;
		overflow: hidden;
		margin: 0.75em 0;
		background: var(--bg-code);
	}

	.markdown :global(.code-header) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 12px;
		background: var(--bg-code-header);
		font-size: 0.75rem;
	}

	.markdown :global(.code-lang) {
		color: var(--text-muted);
	}

	.markdown :global(.copy-btn) {
		background: none;
		border: 1px solid var(--border-primary);
		border-radius: 4px;
		color: var(--text-secondary);
		font-size: 0.75rem;
		padding: 2px 10px;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}

	.markdown :global(.copy-btn:hover) {
		background: var(--bg-hover);
		color: var(--text-primary);
	}

	.markdown :global(.code-block pre) {
		background: var(--bg-code);
		padding: 14px 16px;
		overflow-x: auto;
		margin: 0;
		font-size: 0.875rem;
		border-radius: 0;
	}

	.markdown :global(code) {
		font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', 'Fira Code', Menlo, Consolas, monospace;
		font-size: 1em;
	}

	.markdown :global(:not(pre) > code) {
		background: var(--bg-code);
		padding: 2px 6px;
		border-radius: 4px;
	}

	.markdown :global(ul),
	.markdown :global(ol) {
		padding-left: 1.5em;
		margin: 0.5em 0;
	}

	.markdown :global(li) {
		margin: 0.25em 0;
	}

	.markdown :global(blockquote) {
		border-left: 3px solid var(--border-secondary);
		padding-left: 14px;
		margin: 0.75em 0;
		color: var(--text-secondary);
	}

	.markdown :global(h1),
	.markdown :global(h2),
	.markdown :global(h3) {
		margin: 0.75em 0 0.35em;
	}

	.markdown :global(table) {
		border-collapse: collapse;
		margin: 0.75em 0;
	}

	.markdown :global(th),
	.markdown :global(td) {
		border: 1px solid var(--border-primary);
		padding: 8px 12px;
	}

	.markdown :global(th) {
		background: var(--bg-secondary);
	}

	.markdown :global(hr) {
		border: none;
		border-top: 1px solid var(--border-primary);
		margin: 1em 0;
	}
</style>
