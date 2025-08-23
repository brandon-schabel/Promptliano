/**
 * Chat Repository - Replaces ChatStorage class
 * Reduces from 200+ lines to ~30 lines
 */

import { eq, and, desc, asc } from 'drizzle-orm'
import { db } from '../db'
import { 
  chats, 
  chatMessages, 
  type Chat, 
  type ChatMessage,
  type InsertChat, 
  type InsertChatMessage,
  type ChatWithMessages,
  type MessageRole
} from '../schema'

export const chatRepository = {
  /**
   * Create a new chat
   */
  async create(data: Omit<InsertChat, 'id' | 'createdAt' | 'updatedAt'>): Promise<Chat> {
    const now = Date.now()
    const result = await db.insert(chats).values({
      ...data,
      createdAt: now,
      updatedAt: now
    }).returning()
    
    if (!result[0]) {
      throw new Error('Failed to create chat')
    }
    
    return result[0]
  },

  /**
   * Get chat by ID
   */
  async getById(id: number): Promise<Chat | null> {
    const [chat] = await db.select()
      .from(chats)
      .where(eq(chats.id, id))
      .limit(1)
    return chat ?? null
  },

  /**
   * Get chats by project ID
   */
  async getByProject(projectId: number): Promise<Chat[]> {
    return db.select()
      .from(chats)
      .where(eq(chats.projectId, projectId))
      .orderBy(desc(chats.updatedAt))
  },

  /**
   * Update chat
   */
  async update(id: number, data: Partial<Omit<InsertChat, 'id' | 'createdAt'>>): Promise<Chat> {
    const result = await db.update(chats)
      .set({
        ...data,
        updatedAt: Date.now()
      })
      .where(eq(chats.id, id))
      .returning()
    
    if (!result[0]) {
      throw new Error(`Chat with id ${id} not found`)
    }
    
    return result[0]
  },

  /**
   * Delete chat and all messages (cascade)
   */
  async delete(id: number): Promise<boolean> {
    const result = await db.delete(chats)
      .where(eq(chats.id, id))
      .run() as unknown as { changes: number }
    return result.changes > 0
  },

  /**
   * Get chat with all messages
   */
  async getWithMessages(id: number): Promise<ChatWithMessages | null> {
    return db.query.chats.findFirst({
      where: eq(chats.id, id),
      with: {
        messages: {
          orderBy: asc(chatMessages.createdAt)
        }
      }
    }) as Promise<ChatWithMessages | null>
  },

  // =============================================================================
  // MESSAGE OPERATIONS
  // =============================================================================

  /**
   * Add message to chat
   */
  async addMessage(data: Omit<InsertChatMessage, 'id' | 'createdAt'>): Promise<ChatMessage> {
    // Update chat's updatedAt timestamp
    await db.update(chats)
      .set({ updatedAt: Date.now() })
      .where(eq(chats.id, data.chatId))

    const result = await db.insert(chatMessages).values({
      ...data,
      createdAt: Date.now()
    }).returning()
    
    if (!result[0]) {
      throw new Error('Failed to create chat message')
    }
    
    return result[0]
  },

  /**
   * Get messages by chat ID
   */
  async getMessages(chatId: number): Promise<ChatMessage[]> {
    return db.select()
      .from(chatMessages)
      .where(eq(chatMessages.chatId, chatId))
      .orderBy(asc(chatMessages.createdAt))
  },

  /**
   * Delete message
   */
  async deleteMessage(id: number): Promise<boolean> {
    const result = await db.delete(chatMessages)
      .where(eq(chatMessages.id, id))
      .run() as unknown as { changes: number }
    return result.changes > 0
  }
}