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
 * @property {string} model
 * @property {string} systemPrompt
 * @property {number} updatedAt
 */

export {};
