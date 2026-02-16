<script>
	import { marked, Renderer } from "marked";
	import { formatFileSize } from "$lib/utils.js";

	/** @type {{ message: import('$lib/types.js').Message, isStreaming: boolean, isLast: boolean, imageUrls?: string[], streamingStatus?: string, streamingCode?: string }} */
	let {
		message,
		isStreaming,
		isLast,
		imageUrls = [],
		streamingStatus = "",
		streamingCode = "",
	} = $props();

	/** @type {Record<string, string>} */
	const statusLabels = {
		"response.web_search_call.searching": "検索中...",
		"response.code_interpreter_call.interpreting": "コード実行中...",
		"response.image_generation_call.generating": "画像生成中...",
	};

	let inputFiles = $derived(
		message.files?.filter((f) => f.direction === "input") ?? [],
	);
	let outputFiles = $derived(
		message.files?.filter((f) => f.direction === "output") ?? [],
	);
	let copyLabel = $state("Copy");

	async function copyContent() {
		try {
			await navigator.clipboard.writeText(message.content);
			copyLabel = "Copied!";
			setTimeout(() => {
				copyLabel = "Copy";
			}, 2000);
		} catch {
			// ignore
		}
	}

	/**
	 * @param {string} content
	 * @param {import('$lib/types.js').FileAttachment[]} files
	 */
	function renderMarkdown(content, files) {
		const renderer = new Renderer();
		renderer.code = function ({ text, lang }) {
			const escaped = text
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;");
			const langLabel = lang || "";
			return `<div class="code-block"><div class="code-header"><span class="code-lang">${langLabel}</span><button class="copy-btn" data-code="${text.replace(/"/g, "&quot;")}">Copy</button></div><pre><code>${escaped}</code></pre></div>`;
		};

		const defaultLinkRenderer = renderer.link.bind(renderer);
		renderer.link = function (token) {
			if (token.href && token.href.startsWith("sandbox:")) {
				const sandboxPath = token.href.replace("sandbox:", "");
				const filename = sandboxPath.split("/").pop() || "download";
				const file = files.find((f) => f.filename === filename);
				if (file) {
					const href = file.blobUrl
						? file.blobUrl
						: `/api/files/${file.id}?filename=${encodeURIComponent(file.filename)}${file.containerId ? "&container_id=" + encodeURIComponent(file.containerId) : ""}`;
					const text =
						renderer.parser?.parseInline(token.tokens) ?? filename;
					const dl = file.blobUrl
						? ` download="${filename.replace(/"/g, "&quot;")}"`
						: "";
					return `<a href="${href}" target="_blank" rel="noopener"${dl}>${text}</a>`;
				}
			}
			return defaultLinkRenderer(token);
		};

		return marked.parse(content, { breaks: true, renderer });
	}
</script>

<div class="message {message.role}">
	<div class="message-inner">
		<div
			class="avatar"
			class:avatar-user={message.role === "user"}
			class:avatar-assistant={message.role === "assistant"}
		>
			{#if message.role === "user"}U{:else}AI{/if}
		</div>
		<div class="message-body">
			<div class="role-name">
				{message.role === "user" ? "You" : "Assistant"}
			</div>
			{#if message.role === "user" && imageUrls && imageUrls.length > 0}
				<div class="message-images">
					{#each imageUrls as url}
						<img class="message-image" src={url} alt="Attached" />
					{/each}
				</div>
			{/if}
			{#if message.role === "user" && inputFiles.length > 0}
				<div class="file-attachments">
					{#each inputFiles as file}
						<span class="file-pill">
							<svg
								class="file-pill-icon"
								width="14"
								height="14"
								viewBox="0 0 16 16"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
								stroke-linecap="round"
								stroke-linejoin="round"
								><path
									d="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6L9 2z"
								/><polyline points="9 2 9 6 13 6" /></svg
							>
							{file.filename}
							{#if file.size > 0}
								<span class="file-pill-size"
									>{formatFileSize(file.size)}</span
								>
							{/if}
						</span>
					{/each}
				</div>
			{/if}
			{#if message.role === "assistant" && message.content === "" && !(imageUrls && imageUrls.length > 0) && isStreaming && isLast}
				{#if streamingStatus}
					<div class="status-indicator">
						<span class="status-label"
							>{statusLabels[streamingStatus] ??
								streamingStatus}</span
						>
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
			{:else if message.role === "assistant"}
				<div class="content markdown">
					{@html renderMarkdown(message.content, outputFiles)}
				</div>
			{:else}
				<div class="content">{message.content}</div>
			{/if}
			{#if message.role === "assistant" && imageUrls && imageUrls.length > 0}
				<div class="message-images generated-images">
					{#each imageUrls as url}
						<img
							class="message-image generated-image"
							src={url}
							alt="Generated"
						/>
					{/each}
				</div>
			{/if}
			{#if message.role === "assistant" && outputFiles.length > 0}
				<div class="file-attachments output-files">
					{#each outputFiles as file}
						<a
							class="file-download-pill"
							href={file.blobUrl ||
								`/api/files/${file.id}?filename=${encodeURIComponent(file.filename)}${file.containerId ? "&container_id=" + encodeURIComponent(file.containerId) : ""}`}
							download={file.blobUrl ? file.filename : undefined}
							target="_blank"
							rel="noopener"
						>
							<svg
								class="file-pill-icon"
								width="14"
								height="14"
								viewBox="0 0 16 16"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
								stroke-linecap="round"
								stroke-linejoin="round"
								><path
									d="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6L9 2z"
								/><polyline points="9 2 9 6 13 6" /></svg
							>
							{file.filename}
							<svg
								class="file-download-icon"
								width="12"
								height="12"
								viewBox="0 0 16 16"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								><path
									d="M8 2v10M8 12l-3-3M8 12l3-3M3 14h10"
								/></svg
							>
						</a>
					{/each}
				</div>
			{/if}
			{#if message.role === "assistant" && message.content}
				<button
					class="msg-copy-btn"
					onclick={copyContent}
					title="回答をコピー"
				>
					<svg
						width="14"
						height="14"
						viewBox="0 0 16 16"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
						><rect x="5" y="5" width="9" height="9" rx="1.5" /><path
							d="M5 11H3.5A1.5 1.5 0 012 9.5v-7A1.5 1.5 0 013.5 1h7A1.5 1.5 0 0112 2.5V5"
						/></svg
					>
					<span>{copyLabel}</span>
				</button>
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

	.file-attachments {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		margin-bottom: 8px;
	}

	.output-files {
		margin-top: 8px;
		margin-bottom: 0;
	}

	.file-pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		border-radius: 8px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-primary);
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.file-pill-icon {
		flex-shrink: 0;
	}

	.file-pill-size {
		color: var(--text-muted);
		font-size: 0.7rem;
	}

	.file-download-pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border-radius: 8px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-primary);
		font-size: 0.8rem;
		color: var(--text-secondary);
		text-decoration: none;
		transition:
			background 0.15s,
			border-color 0.15s;
	}

	.file-download-pill:hover {
		background: var(--bg-hover);
		border-color: var(--accent);
		color: var(--text-primary);
	}

	.file-download-icon {
		flex-shrink: 0;
	}

	.msg-copy-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		margin-top: 8px;
		padding: 4px 10px;
		border: 1px solid var(--border-primary);
		border-radius: 6px;
		background: transparent;
		color: var(--text-muted);
		font-size: 0.75rem;
		cursor: pointer;
		transition:
			background 0.15s,
			color 0.15s,
			border-color 0.15s;
	}

	.msg-copy-btn:hover {
		background: var(--bg-hover);
		color: var(--text-primary);
		border-color: var(--border-secondary);
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

	.typing-indicator span:nth-child(2) {
		animation-delay: 0.2s;
	}
	.typing-indicator span:nth-child(3) {
		animation-delay: 0.4s;
	}

	@keyframes blink {
		0%,
		80%,
		100% {
			opacity: 0.3;
		}
		40% {
			opacity: 1;
		}
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
		0%,
		100% {
			opacity: 0.3;
			transform: scale(1);
		}
		50% {
			opacity: 1;
			transform: scale(1.2);
		}
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
		font-family: ui-monospace, "Cascadia Code", "Source Code Pro",
			"Fira Code", Menlo, Consolas, monospace;
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
		transition:
			background 0.15s,
			color 0.15s;
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
		font-family: ui-monospace, "Cascadia Code", "Source Code Pro",
			"Fira Code", Menlo, Consolas, monospace;
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
