/**
 * @typedef {'user' | 'assistant'} MessageRole
 */

/**
 * @typedef {Object} FileAttachment
 * @property {string} id — IndexedDB key (input) or OpenAI file_id (output)
 * @property {string} filename
 * @property {string} mimeType
 * @property {number} size
 * @property {'input' | 'output'} direction
 * @property {string} [containerId]
 * @property {string} [blobUrl]
 */

/**
 * @typedef {Object} Message
 * @property {MessageRole} role
 * @property {string} content
 * @property {string[]} [imageIds]
 * @property {FileAttachment[]} [files]
 */

/**
 * @typedef {Object} Conversation
 * @property {string} id
 * @property {string} title
 * @property {Message[]} messages
 * @property {string | null} chatId
 * @property {string | null} [containerId]
 * @property {string} model
 * @property {string} systemPrompt
 * @property {string} [reasoningEffort]
 * @property {number} updatedAt
 */

export {};
