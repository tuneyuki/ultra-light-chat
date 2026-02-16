<script>
	import { streamChat } from '$lib/api.js';
	import { loadConversations, saveConversation, deleteConversation, deleteAllConversations, generateTitle } from '$lib/chatStore.js';
	import { saveImage, loadImage } from '$lib/imageStore.js';
	import { loadPrompts, savePrompt, deletePrompt } from '$lib/promptStore.js';
	import { MODELS, DEFAULT_MODEL, getProvider } from '$lib/models.js';
	import Sidebar from '$lib/Sidebar.svelte';
	import SettingsModal from '$lib/SettingsModal.svelte';
	import EmptyState from '$lib/EmptyState.svelte';
	import ChatMessage from '$lib/ChatMessage.svelte';
	import ChatInput from '$lib/ChatInput.svelte';
	import { tick, onMount } from 'svelte';

	/** @type {import('$lib/types.js').Message[]} */
	let messages = $state([]);
	let isStreaming = $state(false);
	let streamingStatus = $state('');
	let streamingCode = $state('');
	let chatId = $state(/** @type {string | null} */ (null));

	/** @type {import('$lib/types.js').Conversation[]} */
	let conversations = $state([]);
	let activeConversationId = $state(/** @type {string | null} */ (null));
	let currentModel = $state(DEFAULT_MODEL);
	let currentSystemPrompt = $state('');
	let reasoningEffort = $state('none');

	let webSearch = $state(false);
	let imageGeneration = $state(false);
	let codeInterpreter = $state(false);
	let currentTheme = $state('dark');
	let showSettings = $state(false);
	let showHelp = $state(false);

	/** @type {import('$lib/promptStore.js').SavedPrompt[]} */
	let prompts = $state([]);

	/** imageId → objectURL cache */
	/** @type {Map<string, string>} */
	let imageUrlCache = new Map();

	/** message index → resolved image URLs */
	/** @type {Record<number, string[]>} */
	let messageImageUrls = $state({});

	/** @type {HTMLElement | undefined} */
	let messagesEnd;
	/** @type {AbortController | null} */
	let abortController = null;

	let supportsImage = $derived(
		MODELS.find((m) => m.id === currentModel)?.supportsImage ?? false
	);

	let supportsImageGen = $derived(
		MODELS.find((m) => m.id === currentModel)?.supportsImageGen ?? false
	);

	let supportsCodeInterpreter = $derived(
		MODELS.find((m) => m.id === currentModel)?.supportsCodeInterpreter ?? false
	);

	let supportsWebSearch = $derived(
		MODELS.find((m) => m.id === currentModel)?.supportsWebSearch ?? false
	);

	let supportsReasoning = $derived(
		MODELS.find((m) => m.id === currentModel)?.reasoningEfforts ?? null
	);

	$effect(() => {
		if (!supportsImageGen) imageGeneration = false;
	});

	$effect(() => {
		if (!supportsCodeInterpreter) codeInterpreter = false;
	});

	$effect(() => {
		if (!supportsWebSearch) webSearch = false;
	});

	$effect(() => {
		if (!supportsReasoning) reasoningEffort = 'none';
		else reasoningEffort = supportsReasoning[0];
	});

	/**
	 * @param {string} theme
	 */
	function applyTheme(theme) {
		currentTheme = theme;
		if (theme === 'dark') {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
		localStorage.setItem('ulc-theme', theme);
	}

	onMount(() => {
		conversations = loadConversations();
		prompts = loadPrompts();

		const savedTheme = localStorage.getItem('ulc-theme') || 'dark';
		applyTheme(savedTheme);

		document.addEventListener('click', (e) => {
			const btn = /** @type {HTMLElement} */ (e.target).closest('.copy-btn');
			if (!btn) return;
			const code = btn.getAttribute('data-code') ?? '';
			navigator.clipboard.writeText(code).then(() => {
				btn.textContent = 'Copied!';
				setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
			});
		});
	});

	function generateId() {
		return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
	}

	function persistCurrentConversation() {
		if (!activeConversationId) return;
		const conv = /** @type {import('$lib/types.js').Conversation} */ ({
			id: activeConversationId,
			title: generateTitle(messages),
			messages: messages.map((m) => {
				/** @type {import('$lib/types.js').Message} */
				const msg = { role: m.role, content: m.content };
				if (m.imageIds && m.imageIds.length > 0) {
					msg.imageIds = m.imageIds;
				}
				if (m.files && m.files.length > 0) {
					msg.files = m.files;
				}
				return msg;
			}),
			chatId,
			model: currentModel,
			systemPrompt: currentSystemPrompt,
			reasoningEffort: reasoningEffort !== 'none' ? reasoningEffort : undefined,
			updatedAt: Date.now()
		});
		saveConversation(conv);
		conversations = loadConversations();
	}

	async function scrollToBottom() {
		await tick();
		messagesEnd?.scrollIntoView({ behavior: 'smooth' });
	}

	/**
	 * Convert a File to a data URL (base64).
	 * @param {File} file
	 * @returns {Promise<string>}
	 */
	function fileToDataUrl(file) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(/** @type {string} */ (reader.result));
			reader.onerror = () => reject(reader.error);
			reader.readAsDataURL(file);
		});
	}

	/**
	 * Resolve imageIds for a set of messages and populate messageImageUrls.
	 * @param {import('$lib/types.js').Message[]} msgs
	 */
	async function resolveImageUrls(msgs) {
		/** @type {Record<number, string[]>} */
		const result = {};
		for (let i = 0; i < msgs.length; i++) {
			const ids = msgs[i].imageIds;
			if (!ids || ids.length === 0) continue;
			/** @type {string[]} */
			const urls = [];
			for (const id of ids) {
				let url = imageUrlCache.get(id);
				if (!url) {
					url = await loadImage(id) ?? undefined;
					if (url) imageUrlCache.set(id, url);
				}
				if (url) urls.push(url);
			}
			if (urls.length > 0) result[i] = urls;
		}
		messageImageUrls = result;
	}

	/**
	 * @param {string} text
	 * @param {File[]} images
	 * @param {File[]} files
	 */
	async function handleSend(text, images, files) {
		if (!activeConversationId) {
			activeConversationId = generateId();
		}

		/** @type {string[]} */
		const imageIds = [];
		/** @type {string[]} */
		const base64Images = [];

		for (const file of images) {
			const id = generateId();
			imageIds.push(id);
			const dataUrl = await fileToDataUrl(file);
			base64Images.push(dataUrl);
			saveImage(id, file);
		}

		/** @type {Array<{filename: string, dataUrl: string}>} */
		const base64Files = [];
		/** @type {import('$lib/types.js').FileAttachment[]} */
		const fileAttachments = [];

		for (const file of files) {
			const id = generateId();
			const dataUrl = await fileToDataUrl(file);
			base64Files.push({ filename: file.name, dataUrl });
			fileAttachments.push({
				id,
				filename: file.name,
				mimeType: file.type || 'application/octet-stream',
				size: file.size,
				direction: 'input'
			});
			saveImage(id, file);
		}

		/** @type {import('$lib/types.js').Message} */
		const userMsg = { role: 'user', content: text };
		if (imageIds.length > 0) {
			userMsg.imageIds = imageIds;
		}
		if (fileAttachments.length > 0) {
			userMsg.files = fileAttachments;
		}

		messages.push(userMsg);
		messages.push({ role: 'assistant', content: '' });
		isStreaming = true;

		// Resolve image URLs for the newly added user message
		if (base64Images.length > 0) {
			const idx = messages.length - 2;
			messageImageUrls = { ...messageImageUrls, [idx]: base64Images };
		}

		scrollToBottom();
		persistCurrentConversation();

		abortController = new AbortController();

		try {
			await streamChat(
				text,
				chatId,
				(delta) => {
					if (streamingCode) {
						messages[messages.length - 1].content += '```\n' + streamingCode + '\n```\n\n';
						streamingCode = '';
					}
					streamingStatus = '';
					messages[messages.length - 1].content += delta;
					scrollToBottom();
				},
				(id) => {
					if (id) chatId = id;
				},
				abortController.signal,
				{
					model: currentModel,
					systemPrompt: currentSystemPrompt,
					reasoningEffort: supportsReasoning ? reasoningEffort : undefined,
					images: base64Images.length > 0 ? base64Images : undefined,
					files: base64Files.length > 0 ? base64Files : undefined,
					webSearch: webSearch || undefined,
					imageGeneration: imageGeneration || undefined,
					codeInterpreter: codeInterpreter || undefined,
					messages: getProvider(currentModel) === 'gemini'
						? messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }))
						: undefined,
					onStatus: (status) => {
						streamingStatus = status;
						scrollToBottom();
					},
					onCodeDelta: (delta) => {
						streamingCode += delta;
						scrollToBottom();
					},
					onImage: async (dataUrl, partial) => {
						const assistantIdx = messages.length - 1;
						if (partial) {
							messageImageUrls = { ...messageImageUrls, [assistantIdx]: [dataUrl] };
						} else {
							const id = generateId();
							const commaIdx = dataUrl.indexOf(',');
							const mime = dataUrl.slice(5, dataUrl.indexOf(';'));
							const binary = atob(dataUrl.slice(commaIdx + 1));
							const bytes = new Uint8Array(binary.length);
							for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
							const blob = new Blob([bytes], { type: mime });
							await saveImage(id, blob);
							const msg = messages[assistantIdx];
							if (!msg.imageIds) msg.imageIds = [];
							msg.imageIds.push(id);
							messageImageUrls = { ...messageImageUrls, [assistantIdx]: [dataUrl] };
							persistCurrentConversation();
						}
						scrollToBottom();
					},
					onOutputFile: (file) => {
						const assistantMsg = messages[messages.length - 1];
						if (!assistantMsg.files) assistantMsg.files = [];
						if (assistantMsg.files.some((f) => f.id === file.file_id)) return;
						assistantMsg.files.push({
							id: file.file_id,
							filename: file.filename,
							mimeType: file.mime_type,
							size: 0,
							direction: 'output',
							containerId: file.container_id || undefined
						});
						persistCurrentConversation();
					},
					onGeminiFile: (file) => {
						const assistantMsg = messages[messages.length - 1];
						if (!assistantMsg.files) assistantMsg.files = [];
						if (assistantMsg.files.some((f) => f.filename === file.filename)) return;
						const id = 'gemini-blob-' + generateId();
						assistantMsg.files.push({
							id,
							filename: file.filename,
							mimeType: file.mime_type,
							size: 0,
							direction: 'output',
							blobUrl: file.blob_url
						});
						persistCurrentConversation();
					}
				}
			);
		} catch (err) {
			if (/** @type {Error} */ (err).name !== 'AbortError') {
				messages[messages.length - 1].content += '\n\n[Error: failed to get response]';
			}
		} finally {
			isStreaming = false;
			streamingStatus = '';
			streamingCode = '';
			abortController = null;
			scrollToBottom();
			persistCurrentConversation();
		}
	}

	function handleStop() {
		abortController?.abort();
	}

	function handleNewChat() {
		activeConversationId = null;
		messages = [];
		chatId = null;
		messageImageUrls = {};
		currentSystemPrompt = '';
		webSearch = false;
		imageGeneration = false;
		codeInterpreter = false;
		reasoningEffort = supportsReasoning?.[0] ?? 'none';
	}

	/**
	 * @param {string} id
	 */
	async function handleSelectConversation(id) {
		const conv = conversations.find((c) => c.id === id);
		if (!conv) return;
		activeConversationId = conv.id;
		messages = conv.messages.map((m) => ({ ...m }));
		chatId = conv.chatId;
		currentModel = conv.model || DEFAULT_MODEL;
		currentSystemPrompt = conv.systemPrompt || '';
		reasoningEffort = conv.reasoningEffort || 'none';
		messageImageUrls = {};
		await resolveImageUrls(messages);
		scrollToBottom();
	}

	/**
	 * @param {string} id
	 */
	function handleDeleteConversation(id) {
		deleteConversation(id);
		conversations = loadConversations();
		if (activeConversationId === id) {
			handleNewChat();
		}
	}

	function handleDeleteAllConversations() {
		deleteAllConversations();
		conversations = [];
		handleNewChat();
	}

	/** @param {import('$lib/promptStore.js').SavedPrompt} p */
	function handleSavePrompt(p) {
		savePrompt(p);
		prompts = loadPrompts();
	}

	/** @param {string} id */
	function handleDeletePrompt(id) {
		deletePrompt(id);
		prompts = loadPrompts();
	}
</script>

{#if showSettings}
	<SettingsModal
		theme={currentTheme}
		onThemeChange={applyTheme}
		onClose={() => showSettings = false}
	/>
{/if}

{#if showHelp}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="help-overlay" onclick={() => showHelp = false} onkeydown={() => {}}>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="help-modal" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
			<div class="help-header">
				<h2 class="help-title">Ultra Light Chat の使い方</h2>
				<button class="help-close" onclick={() => showHelp = false} aria-label="Close">
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>
				</button>
			</div>
			<div class="help-content">
				<section>
					<h3>基本操作</h3>
					<ul>
						<li><strong>New Chat</strong> — サイドバーから新しい会話を開始</li>
						<li><strong>Model</strong> — 会話開始前にモデルを選択（OpenAI / Gemini）</li>
						<li><strong>System Prompt</strong> — AIの振る舞いを指示するプロンプトを設定</li>
						<li><strong>Reasoning Effort</strong> — 対応モデルで推論の深さを制御</li>
					</ul>
				</section>
				<section>
					<h3>ツールトグル</h3>
					<ul>
						<li><strong>Search</strong> — Web検索を使って最新情報を取得</li>
						<li><strong>Image</strong> — AIが画像を生成（OpenAIのみ）</li>
						<li><strong>Code</strong> — Pythonコードを実行して計算やファイル処理</li>
					</ul>
				</section>
				<section>
					<h3>入力</h3>
					<ul>
						<li><strong>画像添付</strong> — ドラッグ＆ドロップ、貼り付け、またはクリップアイコンから添付</li>
						<li><strong>ファイル添付</strong> — Code有効時にあらゆるファイルを添付可能</li>
						<li><strong>Enter</strong> で送信、<strong>Shift+Enter</strong> で改行</li>
					</ul>
				</section>
				<section>
					<h3>その他</h3>
					<ul>
						<li>チャット履歴はブラウザの LocalStorage に保存されます</li>
						<li>Settings からダーク/ライトテーマを切り替え可能</li>
						<li>保存したプロンプトは次回以降も利用できます</li>
					</ul>
				</section>
			</div>
		</div>
	</div>
{/if}

<div class="app-layout">
	<Sidebar
		{conversations}
		activeId={activeConversationId ?? ''}
		onSelect={handleSelectConversation}
		onNew={handleNewChat}
		onDelete={handleDeleteConversation}
		onDeleteAll={handleDeleteAllConversations}
		onOpenSettings={() => showSettings = true}
	/>

	<div class="chat-container">
		<header class="chat-header">
			<span class="model-label">{currentModel}</span>
			<button class="help-btn" onclick={() => showHelp = true} aria-label="Help" title="使い方">
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6.5"/><path d="M6 6.5a2 2 0 013.9.5c0 1.3-2 1.5-2 2.5"/><circle cx="8" cy="12" r="0.5" fill="currentColor" stroke="none"/></svg>
			</button>
		</header>
		<main class="messages">
			{#if messages.length === 0}
				<EmptyState models={MODELS} bind:currentModel bind:currentSystemPrompt bind:reasoningEffort {prompts} onSavePrompt={handleSavePrompt} onDeletePrompt={handleDeletePrompt} />
			{/if}

			{#each messages as msg, i}
				<ChatMessage message={msg} {isStreaming} isLast={i === messages.length - 1} imageUrls={messageImageUrls[i]} streamingStatus={i === messages.length - 1 ? streamingStatus : ''} streamingCode={i === messages.length - 1 ? streamingCode : ''} />
			{/each}
			<div bind:this={messagesEnd}></div>
		</main>

		<ChatInput {isStreaming} {supportsImage} {supportsImageGen} {supportsCodeInterpreter} {supportsWebSearch} bind:webSearch bind:imageGeneration bind:codeInterpreter onSend={handleSend} onStop={handleStop} />
	</div>
</div>

<style>
	.app-layout {
		display: flex;
		height: 100vh;
		height: 100dvh;
		width: 100%;
	}

	.chat-container {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
		background: var(--bg-primary);
		color: var(--text-primary);
	}

	.chat-header {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 10px 16px;
		background: var(--header-bg);
		border-bottom: 2px solid var(--header-border);
		flex-shrink: 0;
		position: relative;
	}

	.model-label {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--header-text);
	}

	.help-btn {
		position: absolute;
		right: 16px;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: 1px solid var(--border-primary);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.15s, color 0.15s;
	}

	.help-btn:hover {
		background: var(--bg-hover);
		color: var(--text-primary);
	}

	.help-overlay {
		position: fixed;
		inset: 0;
		background: var(--overlay-bg);
		z-index: 200;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.help-modal {
		background: var(--bg-primary);
		border: 1px solid var(--border-primary);
		border-radius: 12px;
		max-width: 520px;
		width: 90%;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
	}

	.help-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20px 24px 12px;
		flex-shrink: 0;
	}

	.help-title {
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
	}

	.help-close {
		width: 28px;
		height: 28px;
		border-radius: 6px;
		border: none;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.help-close:hover {
		background: var(--bg-hover);
		color: var(--text-primary);
	}

	.help-content {
		padding: 0 24px 24px;
		overflow-y: auto;
	}

	.help-content section {
		margin-bottom: 16px;
	}

	.help-content section:last-child {
		margin-bottom: 0;
	}

	.help-content h3 {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0 0 8px;
	}

	.help-content ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.help-content li {
		font-size: 0.85rem;
		color: var(--text-secondary);
		line-height: 1.7;
		padding-left: 14px;
		position: relative;
	}

	.help-content li::before {
		content: '·';
		position: absolute;
		left: 0;
		color: var(--text-muted);
		font-weight: bold;
	}

	.messages {
		flex: 1;
		overflow-y: auto;
		padding: 0;
	}

	@media (max-width: 768px) {
		.messages {
			padding-top: 48px;
		}
	}
</style>
