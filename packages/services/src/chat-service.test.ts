import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { createChatService } from './chat-service'
import { randomString } from '@promptliano/shared/src/utils/test-utils'
import { normalizeToUnixMs } from '@promptliano/shared'
import type { Chat, ChatMessage } from '@promptliano/database'

// Use realistic unix timestamps for test IDs
const BASE_TIMESTAMP = 1700000000000 // Nov 2023 as base
let mockIdCounter = BASE_TIMESTAMP + 100000 // Start with a high offset for chat/message IDs

const generateTestId = () => {
  mockIdCounter += 1000 // Increment by 1000 for next ID
  return mockIdCounter
}

describe('Chat Service (Mocked Storage)', () => {
  let mockRepository: any
  let chatService: ReturnType<typeof createChatService>
  let mockChats: Map<number, Chat>
  let mockMessages: Map<number, ChatMessage[]>

  beforeEach(() => {
    mockIdCounter = BASE_TIMESTAMP + 100000 // Reset base ID for each test
    mockChats = new Map()
    mockMessages = new Map()

    // Mock repository
    mockRepository = {
      create: mock((data: any) => {
        const chat: Chat = {
          id: generateTestId(),
          title: data.title,
          projectId: data.projectId || null,
          createdAt: normalizeToUnixMs(Date.now()),
          updatedAt: normalizeToUnixMs(Date.now())
        }
        mockChats.set(chat.id, chat)
        mockMessages.set(chat.id, [])
        return Promise.resolve(chat)
      }),

      getById: mock((id: number) => {
        const chat = mockChats.get(id)
        return Promise.resolve(chat || null)
      }),

      getAll: mock(() => {
        return Promise.resolve(Array.from(mockChats.values()))
      }),

      update: mock((id: number, data: any) => {
        const chat = mockChats.get(id)
        if (!chat) return Promise.resolve(null)

        const updated = {
          ...chat,
          ...data,
          updatedAt: normalizeToUnixMs(Date.now())
        }
        mockChats.set(id, updated)
        return Promise.resolve(updated)
      }),

      delete: mock((id: number) => {
        const existed = mockChats.has(id)
        mockChats.delete(id)
        mockMessages.delete(id)
        return Promise.resolve(existed)
      }),

      getMessages: mock((chatId: number) => {
        return Promise.resolve(mockMessages.get(chatId) || [])
      }),

      addMessage: mock((data: any) => {
        const message: ChatMessage = {
          id: generateTestId(),
          chatId: data.chatId,
          role: data.role,
          content: data.content,
          metadata: data.metadata || null,
          createdAt: normalizeToUnixMs(Date.now())
        }

        const messages = mockMessages.get(data.chatId) || []
        messages.push(message)
        mockMessages.set(data.chatId, messages)

        // Update chat's updatedAt
        const chat = mockChats.get(data.chatId)
        if (chat) {
          chat.updatedAt = normalizeToUnixMs(Date.now())
          mockChats.set(data.chatId, chat)
        }

        return Promise.resolve(message)
      }),

      deleteMessage: mock((messageId: number) => {
        for (const [chatId, messages] of mockMessages.entries()) {
          const index = messages.findIndex((m) => m.id === messageId)
          if (index !== -1) {
            messages.splice(index, 1)
            mockMessages.set(chatId, messages)

            // Update chat's updatedAt
            const chat = mockChats.get(chatId)
            if (chat) {
              chat.updatedAt = normalizeToUnixMs(Date.now())
              mockChats.set(chatId, chat)
            }
            return Promise.resolve(true)
          }
        }
        return Promise.resolve(false)
      }),

      getByProject: mock((projectId: number) => {
        const chats = Array.from(mockChats.values()).filter((chat) => chat.projectId === projectId)
        return Promise.resolve(chats)
      })
    }

    // Create service with mocked repository
    chatService = createChatService({
      chatRepository: mockRepository
    })
  })

  test('createChat should insert a new chat record', async () => {
    const title = `Chat_${randomString()}`
    const chat = await chatService.createChat(title)

    expect(chat.id).toBeDefined()
    expect(typeof chat.id).toBe('number')
    expect(chat.title).toBe(title)
    expect(chat.createdAt).toBeDefined()
    expect(typeof chat.createdAt).toBe('number')
    expect(chat.updatedAt).toBeDefined()
    expect(typeof chat.updatedAt).toBe('number')

    // Verify by trying to get it via the service
    const allChats = await chatService.getAllChats()
    const foundChat = allChats.find((c) => c.id === chat.id)
    expect(foundChat).toBeDefined()
    expect(foundChat?.title).toBe(title)
  })

  test('createChat with copyExisting copies messages from another chat', async () => {
    const source = await chatService.createChat('SourceChat')
    const now = Date.now()

    // Insert two messages
    await chatService.saveMessage({
      chatId: source.id,
      role: 'system',
      content: 'Hello',
      id: generateTestId(),
      createdAt: normalizeToUnixMs(now - 1000)
    })
    await chatService.saveMessage({
      chatId: source.id,
      role: 'user',
      content: 'World',
      id: generateTestId(),
      createdAt: normalizeToUnixMs(now - 500)
    })

    const newChat = await chatService.createChat('CopyTarget', {
      copyExisting: true,
      currentChatId: source.id
    })

    expect(newChat.id).toBeDefined()

    // Check that new chat has the same 2 messages (content-wise)
    const newMessages = await chatService.getChatMessages(newChat.id)
    expect(newMessages.length).toBe(2)

    // Note: Message IDs will be different in the new chat. Order should be preserved.
    const originalMessages = await chatService.getChatMessages(source.id)
    expect(newMessages[0].content).toBe(originalMessages[0].content) // Hello
    expect(newMessages[0].role).toBe(originalMessages[0].role)
    expect(newMessages[1].content).toBe(originalMessages[1].content) // World
    expect(newMessages[1].role).toBe(originalMessages[1].role)

    // Also verify that message IDs are different
    expect(newMessages[0].id).not.toBe(originalMessages[0].id)
    expect(newMessages[1].id).not.toBe(originalMessages[1].id)
    expect(newMessages[0].chatId).toBe(newChat.id)
  })

  test('saveMessage inserts a new message', async () => {
    const chat = await chatService.createChat('MessageTest')
    const msgData = {
      chatId: chat.id,
      role: 'user' as const,
      content: 'Sample content',
      id: generateTestId(), // Use generated ID
      createdAt: normalizeToUnixMs(Date.now()) // Ensure Unix ms timestamp
    }
    const msg = await chatService.saveMessage(msgData)

    expect(msg.id).toBeDefined()
    expect(typeof msg.id).toBe('number')
    expect(msg.chatId).toBe(chat.id)
    expect(msg.role).toBe(msgData.role)
    expect(msg.content).toBe(msgData.content)
    expect(msg.createdAt).toBeDefined()
    expect(typeof msg.createdAt).toBe('number')

    // Verify by getting messages for the chat
    const messages = await chatService.getChatMessages(chat.id)
    expect(messages.length).toBe(1)
    expect(messages[0].id).toBe(msg.id)
    expect(messages[0].content).toBe('Sample content')
  })

  test('updateMessageContent changes content of a message', async () => {
    const chat = await chatService.createChat('UpdateMsg')
    const msg = await chatService.saveMessage({
      chatId: chat.id,
      role: 'user' as const,
      content: 'Old content',
      id: generateTestId(), // Use generated ID
      createdAt: normalizeToUnixMs(Date.now()) // Ensure Unix ms timestamp
    })

    await chatService.updateMessageContent(chat.id, msg.id, 'New content')

    const messages = await chatService.getChatMessages(chat.id)
    // Note: updateMessageContent deletes and recreates, so the message might have a different ID
    expect(messages.length).toBe(1)
    expect(messages[0].content).toBe('New content')
  })

  test('getAllChats returns all chats sorted by updated', async () => {
    const chatA = await chatService.createChat('ChatA') // Will have earliest updated
    await new Promise((resolve) => setTimeout(resolve, 10)) // Ensure timestamp difference
    const chatB = await chatService.createChat('ChatB')
    await new Promise((resolve) => setTimeout(resolve, 10))
    const chatC = await chatService.createChat('ChatC') // Will have latest updated

    // Update chatA to make its updated more recent than B but less than C for a better sort test
    await new Promise((resolve) => setTimeout(resolve, 10))
    await chatService.updateChat(chatA.id, 'ChatA Updated')

    const chats = await chatService.getAllChats()
    expect(chats.length).toBe(3)

    // Verify chats are sorted by updated DESC
    // Since we updated chatA last, it should have the most recent updatedAt
    const sortedChats = chats.sort((a, b) => b.updatedAt - a.updatedAt)
    expect(sortedChats[0].title).toBe('ChatA Updated')
  })

  test('updateChat changes the chat title and updates timestamp', async () => {
    const chat = await chatService.createChat('InitialTitle')
    const originalUpdated = chat.updatedAt
    await new Promise((resolve) => setTimeout(resolve, 10)) // Ensure time passes

    const updated = await chatService.updateChat(chat.id, 'NewTitle')
    expect(updated.title).toBe('NewTitle')
    expect(updated.id).toBe(chat.id)
    expect(updated.updatedAt).toBeGreaterThan(originalUpdated)

    const allChats = await chatService.getAllChats()
    const foundChat = allChats.find((c) => c.id === chat.id)
    expect(foundChat?.title).toBe('NewTitle')
  })

  test('deleteChat removes chat and its messages', async () => {
    const chat = await chatService.createChat('DeleteMe')
    const now = Date.now()

    await chatService.saveMessage({
      chatId: chat.id,
      role: 'user' as const,
      content: 'Hello',
      id: generateTestId(),
      createdAt: normalizeToUnixMs(now - 100)
    })
    await chatService.saveMessage({
      chatId: chat.id,
      role: 'assistant' as const,
      content: 'World',
      id: generateTestId(),
      createdAt: normalizeToUnixMs(now)
    })

    await chatService.deleteChat(chat.id)

    // Ensure chat is gone
    const allChats = await chatService.getAllChats()
    expect(allChats.find((c) => c.id === chat.id)).toBeUndefined()

    // Ensure messages are gone - getChatMessages will throw since chat doesn't exist
    await expect(chatService.getChatMessages(chat.id)).rejects.toThrow()
  })

  test('deleteMessage removes only that message', async () => {
    const chat = await chatService.createChat('MsgDelete')
    const now = Date.now()

    const m1 = await chatService.saveMessage({
      chatId: chat.id,
      role: 'user' as const,
      content: 'First',
      id: generateTestId(),
      createdAt: normalizeToUnixMs(now - 100)
    })
    const m2 = await chatService.saveMessage({
      chatId: chat.id,
      role: 'assistant' as const,
      content: 'Second',
      id: generateTestId(),
      createdAt: normalizeToUnixMs(now)
    })

    await chatService.deleteMessage(chat.id, m1.id)

    const all = await chatService.getChatMessages(chat.id)
    expect(all.length).toBe(1)
    expect(all[0].id).toBe(m2.id)
  })

  test('forkChat duplicates chat and messages except excluded IDs', async () => {
    const source = await chatService.createChat('SourceFork')
    const now = Date.now()

    const msgA = await chatService.saveMessage({
      chatId: source.id,
      role: 'user' as const,
      content: 'A',
      id: generateTestId(),
      createdAt: normalizeToUnixMs(now - 200)
    })
    const msgB = await chatService.saveMessage({
      chatId: source.id,
      role: 'assistant' as const,
      content: 'B',
      id: generateTestId(),
      createdAt: normalizeToUnixMs(now - 100)
    })
    const msgC = await chatService.saveMessage({
      chatId: source.id,
      role: 'user' as const,
      content: 'C',
      id: generateTestId(),
      createdAt: normalizeToUnixMs(now)
    })

    const newChat = await chatService.forkChat(source.id, [msgB.id]) // Exclude original msgB.id
    const newMessages = await chatService.getChatMessages(newChat.id)

    expect(newMessages.length).toBe(2) // A and C copied with new IDs
    const contents = newMessages.map((m) => m.content).sort()
    expect(contents).toEqual(['A', 'C'])

    // Verify new message IDs
    const originalMessageIds = [msgA.id, msgC.id]
    newMessages.forEach((nm) => {
      expect(originalMessageIds).not.toContain(nm.id) // New IDs
      expect(nm.chatId).toBe(newChat.id)
    })
  })

  test('forkChatFromMessage only copies messages up to a given message, excluding any if needed', async () => {
    const source = await chatService.createChat('ForkFromMsg')
    const now = Date.now()

    const msg1 = await chatService.saveMessage({
      chatId: source.id,
      role: 'user' as const,
      content: 'Msg1',
      id: generateTestId(),
      createdAt: normalizeToUnixMs(now - 200)
    })
    await new Promise((resolve) => setTimeout(resolve, 1)) // ensure order
    const msg2 = await chatService.saveMessage({
      chatId: source.id,
      role: 'assistant' as const,
      content: 'Msg2',
      id: generateTestId(),
      createdAt: normalizeToUnixMs(now - 100)
    })
    await new Promise((resolve) => setTimeout(resolve, 1))
    const msg3 = await chatService.saveMessage({
      chatId: source.id,
      role: 'user' as const,
      content: 'Msg3',
      id: generateTestId(),
      createdAt: normalizeToUnixMs(now)
    })

    // Fork from original msg2, exclude original msg1
    const newChat = await chatService.forkChatFromMessage(source.id, msg2.id, [msg1.id])
    const newMsgs = await chatService.getChatMessages(newChat.id)

    // Should include only a copy of msg2 (msg1 excluded, msg3 after fork point)
    expect(newMsgs.length).toBe(1)
    expect(newMsgs[0].content).toBe('Msg2') // Content of msg2
    expect(newMsgs[0].id).not.toBe(msg2.id) // New ID
    expect(newMsgs[0].chatId).toBe(newChat.id)
  })
})
