/**
 * Message Context Service
 *
 * Provides message history management for chat AI context windows.
 * Allows filtering messages by count or token limits to reduce costs and improve response times.
 *
 * @module MessageContextService
 */

import { ErrorFactory } from '@promptliano/shared'
import { createLogger } from './utils/logger'

/**
 * Message structure compatible with AI SDK
 */
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | Array<{ type: string; text?: string; [key: string]: any }>
  [key: string]: any
}

/**
 * Options for selecting messages for context
 */
export interface MessageContextOptions {
  /** Maximum number of messages to include (default: 50) */
  maxMessages?: number
  /** Maximum total tokens for context window */
  maxContextTokens?: number
  /** Whether to include system prompt (default: true) */
  includeSystemPrompt?: boolean
  /** Preserve user-assistant message pairs (default: true) */
  preserveUserAssistantPairs?: boolean
}

/**
 * Result of message context selection with metadata
 */
export interface MessageContextResult {
  messages: Message[]
  metadata: {
    totalMessages: number
    includedMessages: number
    excludedMessages: number
    totalTokens: number
    systemPromptTokens: number
    userMessagesTokens: number
    assistantMessagesTokens: number
  }
}

/**
 * Dependencies for message context service
 */
export interface MessageContextServiceDeps {
  logger?: ReturnType<typeof createLogger>
}

/**
 * Create message context service with functional factory pattern
 */
export function createMessageContextService(deps: MessageContextServiceDeps = {}) {
  const { logger = createLogger('MessageContextService') } = deps

  /**
   * Select messages for AI context based on limits
   *
   * @param allMessages - All available messages
   * @param options - Context selection options
   * @returns Selected messages with metadata
   */
  function selectMessagesForContext(
    allMessages: Message[],
    options: MessageContextOptions = {}
  ): MessageContextResult {
    const {
      maxMessages = 50,
      maxContextTokens,
      includeSystemPrompt = true,
      preserveUserAssistantPairs = true
    } = options

    if (!allMessages || allMessages.length === 0) {
      return {
        messages: [],
        metadata: {
          totalMessages: 0,
          includedMessages: 0,
          excludedMessages: 0,
          totalTokens: 0,
          systemPromptTokens: 0,
          userMessagesTokens: 0,
          assistantMessagesTokens: 0
        }
      }
    }

    const totalMessages = allMessages.length

    // Separate system prompt from conversation messages
    const systemPrompt = allMessages.find(m => m.role === 'system')
    const conversationMessages = allMessages.filter(m => m.role !== 'system')

    // Take most recent messages up to maxMessages
    let selectedMessages = conversationMessages.slice(-maxMessages)

    // Preserve user-assistant pairs if requested
    if (preserveUserAssistantPairs && selectedMessages.length > 0) {
      // Ensure we start with a user message
      while (selectedMessages.length > 1 && selectedMessages[0]?.role !== 'user') {
        selectedMessages.shift()
      }
    }

    // Add system prompt back if requested
    if (includeSystemPrompt && systemPrompt) {
      selectedMessages = [systemPrompt, ...selectedMessages]
    }

    // If maxContextTokens specified, trim further if needed
    if (maxContextTokens) {
      const totalTokens = calculateTotalTokens(selectedMessages)
      if (totalTokens > maxContextTokens) {
        selectedMessages = trimToTokenLimit(selectedMessages, maxContextTokens, systemPrompt)
      }
    }

    // Calculate final metadata
    const metadata = {
      totalMessages,
      includedMessages: selectedMessages.length,
      excludedMessages: totalMessages - selectedMessages.length,
      totalTokens: calculateTotalTokens(selectedMessages),
      systemPromptTokens: systemPrompt ? calculateTotalTokens([systemPrompt]) : 0,
      userMessagesTokens: calculateTotalTokens(selectedMessages.filter(m => m.role === 'user')),
      assistantMessagesTokens: calculateTotalTokens(selectedMessages.filter(m => m.role === 'assistant'))
    }

    logger.debug('Selected messages for context', {
      totalMessages: metadata.totalMessages,
      includedMessages: metadata.includedMessages,
      excludedMessages: metadata.excludedMessages,
      totalTokens: metadata.totalTokens
    })

    return {
      messages: selectedMessages,
      metadata
    }
  }

  /**
   * Calculate token count for each message
   *
   * @param messages - Messages to count tokens for
   * @returns Object mapping message index to token count
   */
  function calculateTokensPerMessage(messages: Message[]): Record<string, number> {
    return messages.reduce((acc, message, index) => {
      acc[`message_${index}`] = estimateMessageTokens(message)
      return acc
    }, {} as Record<string, number>)
  }

  /**
   * Estimate token count for a single message
   * Uses ~4 characters per token as estimation
   *
   * @param message - Message to estimate tokens for
   * @returns Estimated token count
   */
  function estimateMessageTokens(message: Message): number {
    let text = ''

    if (typeof message.content === 'string') {
      text = message.content
    } else if (Array.isArray(message.content)) {
      text = message.content
        .filter(part => part.type === 'text' && part.text)
        .map(part => part.text!)
        .join('')
    }

    if (!text || text.length === 0) {
      return 0
    }

    // Base estimation: ~4 chars per token
    const baseEstimate = Math.ceil(text.length / 4)

    // Adjust for code/whitespace density (similar to smart-truncation.ts)
    const whitespaceRatio = (text.match(/\s/g) || []).length / text.length
    const densityFactor = 1 + (1 - whitespaceRatio) * 0.3

    return Math.ceil(baseEstimate * densityFactor)
  }

  /**
   * Calculate total tokens for an array of messages
   * Uses estimation fallback if actual counting fails
   *
   * @param messages - Messages to count tokens for
   * @returns Total token count
   */
  function calculateTotalTokens(messages: Message[]): number {
    if (!messages || messages.length === 0) {
      return 0
    }

    try {
      // Try to use gpt-tokenizer if available (from copilot-api package)
      // This is optional - we fall back to estimation
      const { countTokens } = require('gpt-tokenizer/model/gpt-4o')

      // Simplify messages for tokenizer
      const simplifiedMessages = messages.map(message => {
        let content = ''
        if (typeof message.content === 'string') {
          content = message.content
        } else if (Array.isArray(message.content)) {
          content = message.content
            .filter(part => part.type === 'text' && part.text)
            .map(part => part.text!)
            .join('')
        }
        return { ...message, content }
      })

      return countTokens(simplifiedMessages)
    } catch (error) {
      // Fallback to estimation if gpt-tokenizer not available
      logger.debug('Using token estimation (gpt-tokenizer not available)', { error })
      return messages.reduce((total, msg) => total + estimateMessageTokens(msg), 0)
    }
  }

  /**
   * Trim messages to fit within token limit
   * Preserves system prompt and takes most recent messages
   *
   * @param messages - Messages to trim
   * @param maxTokens - Maximum token budget
   * @param systemPrompt - Optional system prompt to always include
   * @returns Trimmed messages array
   */
  function trimToTokenLimit(messages: Message[], maxTokens: number, systemPrompt?: Message): Message[] {
    const result: Message[] = []
    let currentTokens = 0

    // Always include system prompt if it exists
    if (systemPrompt) {
      const systemTokens = estimateMessageTokens(systemPrompt)
      if (systemTokens > maxTokens) {
        // System prompt alone exceeds limit - log warning and return just system prompt
        logger.warn('System prompt exceeds token limit', {
          systemTokens,
          maxTokens
        })
        return [systemPrompt]
      }
      result.push(systemPrompt)
      currentTokens += systemTokens
    }

    // Add messages from most recent backwards
    const conversationMessages = messages.filter(m => m.role !== 'system')
    for (let i = conversationMessages.length - 1; i >= 0; i--) {
      const message = conversationMessages[i]!
      const messageTokens = estimateMessageTokens(message)

      if (currentTokens + messageTokens <= maxTokens) {
        result.unshift(message)
        currentTokens += messageTokens
      } else {
        // Would exceed limit - stop adding messages
        logger.debug('Token limit reached, excluding older messages', {
          currentTokens,
          maxTokens,
          excludedMessages: i + 1
        })
        break
      }
    }

    // Re-add system prompt at start if it exists
    if (systemPrompt) {
      return [systemPrompt, ...result.filter(m => m.role !== 'system')]
    }

    return result
  }

  return {
    selectMessagesForContext,
    calculateTokensPerMessage,
    calculateTotalTokens,
    estimateMessageTokens,
    trimToTokenLimit
  }
}

/**
 * Default message context service instance
 */
export const messageContextService = createMessageContextService()