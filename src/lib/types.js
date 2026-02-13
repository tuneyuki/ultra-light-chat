/**
 * @typedef {'user' | 'assistant'} MessageRole
 */

/**
 * @typedef {Object} Message
 * @property {MessageRole} role
 * @property {string} content
 * @property {string[]} [imageIds]
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
