import { loadConversations, saveConversation, deleteConversation as _deleteConversation, deleteAllConversations as _deleteAllConversations, generateTitle } from '$lib/chatStore.js';
import { loadPrompts, savePrompt as _savePrompt, deletePrompt as _deletePrompt } from '$lib/promptStore.js';
import { DEFAULT_MODEL, MODELS } from '$lib/models.js';
import { resolveImageUrls } from '$lib/imageUtils.js';

/**
 * Create and return the chat application state.
 * Should be called once from the root page component.
 */
export function createChatState() {
    /** @type {import('$lib/types.js').Message[]} */
    let messages = $state([]);
    let isStreaming = $state(false);
    let streamingStatus = $state('');
    let streamingCode = $state('');
    let chatId = $state(/** @type {string | null} */(null));

    /** @type {import('$lib/types.js').Conversation[]} */
    let conversations = $state([]);
    let activeConversationId = $state(/** @type {string | null} */(null));
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
    const imageUrlCache = new Map();

    /** message index → resolved image URLs */
    /** @type {Record<number, string[]>} */
    let messageImageUrls = $state({});

    /** @type {AbortController | null} */
    let abortController = null;

    // --- Derived model capabilities ---
    let currentModelDef = $derived(MODELS.find((m) => m.id === currentModel));
    let supportsImage = $derived(currentModelDef?.supportsImage ?? false);
    let supportsImageGen = $derived(currentModelDef?.supportsImageGen ?? false);
    let supportsCodeInterpreter = $derived(currentModelDef?.supportsCodeInterpreter ?? false);
    let supportsWebSearch = $derived(currentModelDef?.supportsWebSearch ?? false);
    let supportsReasoning = $derived(currentModelDef?.reasoningEfforts ?? null);

    // --- Effects to reset toggles when model changes ---
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

    // --- Theme ---
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

    // --- Initialization ---
    function init() {
        conversations = loadConversations();
        prompts = loadPrompts();
        const savedTheme = localStorage.getItem('ulc-theme') || 'dark';
        applyTheme(savedTheme);
    }

    // --- Conversation persistence ---
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

    // --- Conversation actions ---
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
        messageImageUrls = await resolveImageUrls(messages, imageUrlCache);
    }

    /**
     * @param {string} id
     */
    function handleDeleteConversation(id) {
        _deleteConversation(id);
        conversations = loadConversations();
        if (activeConversationId === id) {
            handleNewChat();
        }
    }

    function handleDeleteAllConversations() {
        _deleteAllConversations();
        conversations = [];
        handleNewChat();
    }

    // --- Prompt actions ---
    /** @param {import('$lib/promptStore.js').SavedPrompt} p */
    function handleSavePrompt(p) {
        _savePrompt(p);
        prompts = loadPrompts();
    }

    /** @param {string} id */
    function handleDeletePrompt(id) {
        _deletePrompt(id);
        prompts = loadPrompts();
    }

    // --- Abort controller ---
    function handleStop() {
        abortController?.abort();
    }

    /**
     * @param {AbortController} ctrl
     */
    function setAbortController(ctrl) {
        abortController = ctrl;
    }

    function clearAbortController() {
        abortController = null;
    }

    return {
        // State (reactive getters/setters)
        get messages() { return messages; },
        set messages(v) { messages = v; },
        get isStreaming() { return isStreaming; },
        set isStreaming(v) { isStreaming = v; },
        get streamingStatus() { return streamingStatus; },
        set streamingStatus(v) { streamingStatus = v; },
        get streamingCode() { return streamingCode; },
        set streamingCode(v) { streamingCode = v; },
        get chatId() { return chatId; },
        set chatId(v) { chatId = v; },
        get conversations() { return conversations; },
        get activeConversationId() { return activeConversationId; },
        set activeConversationId(v) { activeConversationId = v; },
        get currentModel() { return currentModel; },
        set currentModel(v) { currentModel = v; },
        get currentSystemPrompt() { return currentSystemPrompt; },
        set currentSystemPrompt(v) { currentSystemPrompt = v; },
        get reasoningEffort() { return reasoningEffort; },
        set reasoningEffort(v) { reasoningEffort = v; },
        get webSearch() { return webSearch; },
        set webSearch(v) { webSearch = v; },
        get imageGeneration() { return imageGeneration; },
        set imageGeneration(v) { imageGeneration = v; },
        get codeInterpreter() { return codeInterpreter; },
        set codeInterpreter(v) { codeInterpreter = v; },
        get currentTheme() { return currentTheme; },
        get showSettings() { return showSettings; },
        set showSettings(v) { showSettings = v; },
        get showHelp() { return showHelp; },
        set showHelp(v) { showHelp = v; },
        get prompts() { return prompts; },
        get messageImageUrls() { return messageImageUrls; },
        set messageImageUrls(v) { messageImageUrls = v; },
        get imageUrlCache() { return imageUrlCache; },

        // Derived (read-only)
        get supportsImage() { return supportsImage; },
        get supportsImageGen() { return supportsImageGen; },
        get supportsCodeInterpreter() { return supportsCodeInterpreter; },
        get supportsWebSearch() { return supportsWebSearch; },
        get supportsReasoning() { return supportsReasoning; },

        // Actions
        init,
        applyTheme,
        persistCurrentConversation,
        handleNewChat,
        handleSelectConversation,
        handleDeleteConversation,
        handleDeleteAllConversations,
        handleSavePrompt,
        handleDeletePrompt,
        handleStop,
        setAbortController,
        clearAbortController,
    };
}
