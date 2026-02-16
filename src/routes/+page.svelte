<script>
	import { streamChat } from "$lib/api.js";
	import { saveImage } from "$lib/imageStore.js";
	import { MODELS, getProvider } from "$lib/models.js";
	import { generateId } from "$lib/utils.js";
	import { createChatState } from "$lib/chatState.svelte.js";
	import { fileToDataUrl, dataUrlToBlob } from "$lib/imageUtils.js";
	import Sidebar from "$lib/Sidebar.svelte";
	import SettingsModal from "$lib/SettingsModal.svelte";
	import HelpModal from "$lib/HelpModal.svelte";
	import EmptyState from "$lib/EmptyState.svelte";
	import ChatMessage from "$lib/ChatMessage.svelte";
	import ChatInput from "$lib/ChatInput.svelte";
	import { tick, onMount } from "svelte";

	const state = createChatState();

	/** @type {HTMLElement | undefined} */
	let messagesEnd;

	onMount(() => {
		state.init();

		document.addEventListener("click", (e) => {
			const btn = /** @type {HTMLElement} */ (e.target).closest(
				".copy-btn",
			);
			if (!btn) return;
			const code = btn.getAttribute("data-code") ?? "";
			navigator.clipboard.writeText(code).then(() => {
				btn.textContent = "Copied!";
				setTimeout(() => {
					btn.textContent = "Copy";
				}, 2000);
			});
		});
	});

	async function scrollToBottom() {
		await tick();
		messagesEnd?.scrollIntoView({ behavior: "smooth" });
	}

	/**
	 * @param {string} text
	 * @param {File[]} images
	 * @param {File[]} files
	 */
	async function handleSend(text, images, files) {
		if (!state.activeConversationId) {
			state.activeConversationId = generateId();
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
				mimeType: file.type || "application/octet-stream",
				size: file.size,
				direction: "input",
			});
			saveImage(id, file);
		}

		/** @type {import('$lib/types.js').Message} */
		const userMsg = { role: "user", content: text };
		if (imageIds.length > 0) {
			userMsg.imageIds = imageIds;
		}
		if (fileAttachments.length > 0) {
			userMsg.files = fileAttachments;
		}

		state.messages.push(userMsg);
		state.messages.push({ role: "assistant", content: "" });
		state.isStreaming = true;

		// Resolve image URLs for the newly added user message
		if (base64Images.length > 0) {
			const idx = state.messages.length - 2;
			state.messageImageUrls = {
				...state.messageImageUrls,
				[idx]: base64Images,
			};
		}

		scrollToBottom();
		state.persistCurrentConversation();

		const abortController = new AbortController();
		state.setAbortController(abortController);

		try {
			await streamChat(
				text,
				state.chatId,
				(delta) => {
					if (state.streamingCode) {
						state.messages[state.messages.length - 1].content +=
							"```\n" + state.streamingCode + "\n```\n\n";
						state.streamingCode = "";
					}
					state.streamingStatus = "";
					state.messages[state.messages.length - 1].content += delta;
					scrollToBottom();
				},
				(id) => {
					if (id) state.chatId = id;
				},
				abortController.signal,
				{
					model: state.currentModel,
					systemPrompt: state.currentSystemPrompt,
					reasoningEffort: state.supportsReasoning
						? state.reasoningEffort
						: undefined,
					images: base64Images.length > 0 ? base64Images : undefined,
					files: base64Files.length > 0 ? base64Files : undefined,
					webSearch: state.webSearch || undefined,
					imageGeneration: state.imageGeneration || undefined,
					codeInterpreter: state.codeInterpreter || undefined,
					messages:
						getProvider(state.currentModel) === "gemini"
							? state.messages
									.slice(0, -1)
									.map((m) => ({
										role: m.role,
										content: m.content,
									}))
							: undefined,
					onStatus: (status) => {
						state.streamingStatus = status;
						scrollToBottom();
					},
					onCodeDelta: (delta) => {
						state.streamingCode += delta;
						scrollToBottom();
					},
					onImage: async (dataUrl, partial) => {
						const assistantIdx = state.messages.length - 1;
						if (partial) {
							state.messageImageUrls = {
								...state.messageImageUrls,
								[assistantIdx]: [dataUrl],
							};
						} else {
							const id = generateId();
							const { blob } = dataUrlToBlob(dataUrl);
							await saveImage(id, blob);
							const msg = state.messages[assistantIdx];
							if (!msg.imageIds) msg.imageIds = [];
							msg.imageIds.push(id);
							state.messageImageUrls = {
								...state.messageImageUrls,
								[assistantIdx]: [dataUrl],
							};
							state.persistCurrentConversation();
						}
						scrollToBottom();
					},
					onOutputFile: (file) => {
						const assistantMsg =
							state.messages[state.messages.length - 1];
						if (!assistantMsg.files) assistantMsg.files = [];
						if (
							assistantMsg.files.some(
								(f) => f.id === file.file_id,
							)
						)
							return;
						assistantMsg.files.push({
							id: file.file_id,
							filename: file.filename,
							mimeType: file.mime_type,
							size: 0,
							direction: "output",
							containerId: file.container_id || undefined,
						});
						state.persistCurrentConversation();
					},
					onGeminiFile: (file) => {
						const assistantMsg =
							state.messages[state.messages.length - 1];
						if (!assistantMsg.files) assistantMsg.files = [];
						if (
							assistantMsg.files.some(
								(f) => f.filename === file.filename,
							)
						)
							return;
						const id = "gemini-blob-" + generateId();
						assistantMsg.files.push({
							id,
							filename: file.filename,
							mimeType: file.mime_type,
							size: 0,
							direction: "output",
							blobUrl: file.blob_url,
						});
						state.persistCurrentConversation();
					},
				},
			);
		} catch (err) {
			if (/** @type {Error} */ (err).name !== "AbortError") {
				state.messages[state.messages.length - 1].content +=
					"\n\n[Error: failed to get response]";
			}
		} finally {
			state.isStreaming = false;
			state.streamingStatus = "";
			state.streamingCode = "";
			state.clearAbortController();
			scrollToBottom();
			state.persistCurrentConversation();
		}
	}
</script>

{#if state.showSettings}
	<SettingsModal
		theme={state.currentTheme}
		onThemeChange={state.applyTheme}
		onClose={() => (state.showSettings = false)}
	/>
{/if}

{#if state.showHelp}
	<HelpModal onClose={() => (state.showHelp = false)} />
{/if}

<div class="app-layout">
	<Sidebar
		conversations={state.conversations}
		activeId={state.activeConversationId ?? ""}
		onSelect={state.handleSelectConversation}
		onNew={state.handleNewChat}
		onDelete={state.handleDeleteConversation}
		onDeleteAll={state.handleDeleteAllConversations}
		onOpenSettings={() => (state.showSettings = true)}
	/>

	<div class="chat-container">
		<header class="chat-header">
			<span class="model-label">{state.currentModel}</span>
			<button
				class="help-btn"
				onclick={() => (state.showHelp = true)}
				aria-label="Help"
				title="使い方"
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
					><circle cx="8" cy="8" r="6.5" /><path
						d="M6 6.5a2 2 0 013.9.5c0 1.3-2 1.5-2 2.5"
					/><circle
						cx="8"
						cy="12"
						r="0.5"
						fill="currentColor"
						stroke="none"
					/></svg
				>
			</button>
		</header>
		<main class="messages">
			{#if state.messages.length === 0}
				<EmptyState
					models={MODELS}
					bind:currentModel={state.currentModel}
					bind:currentSystemPrompt={state.currentSystemPrompt}
					bind:reasoningEffort={state.reasoningEffort}
					prompts={state.prompts}
					onSavePrompt={state.handleSavePrompt}
					onDeletePrompt={state.handleDeletePrompt}
				/>
			{/if}

			{#each state.messages as msg, i}
				<ChatMessage
					message={msg}
					isStreaming={state.isStreaming}
					isLast={i === state.messages.length - 1}
					imageUrls={state.messageImageUrls[i]}
					streamingStatus={i === state.messages.length - 1
						? state.streamingStatus
						: ""}
					streamingCode={i === state.messages.length - 1
						? state.streamingCode
						: ""}
				/>
			{/each}
			<div bind:this={messagesEnd}></div>
		</main>

		<ChatInput
			isStreaming={state.isStreaming}
			supportsImage={state.supportsImage}
			supportsImageGen={state.supportsImageGen}
			supportsCodeInterpreter={state.supportsCodeInterpreter}
			supportsWebSearch={state.supportsWebSearch}
			bind:webSearch={state.webSearch}
			bind:imageGeneration={state.imageGeneration}
			bind:codeInterpreter={state.codeInterpreter}
			onSend={handleSend}
			onStop={state.handleStop}
		/>
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
		transition:
			background 0.15s,
			color 0.15s;
	}

	.help-btn:hover {
		background: var(--bg-hover);
		color: var(--text-primary);
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
