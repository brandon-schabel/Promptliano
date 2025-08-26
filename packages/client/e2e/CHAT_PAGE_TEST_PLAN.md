# Chat Page Comprehensive Test Plan

## Overview
The Chat Page is the core AI interaction interface for Promptliano, featuring real-time messaging with multiple AI providers, chat history management, model configuration, and provider switching. This test plan covers all chat functionality including provider integration, message handling, and system responsiveness.

## Test Scope & Requirements

### Major Components
1. **Chat Header** - History drawer, chat name display, model settings
2. **Message Area** - Message display, empty state handling, AI responses
3. **User Input** - Message composition, provider/model selection, sending
4. **Chat History** - Conversation persistence, navigation, search
5. **Provider Integration** - Model switching, provider configuration, error handling
6. **Chat Settings** - Temperature, max tokens, frequency penalty adjustments

### Technical Integration Points
- **AI Provider APIs**: OpenAI, Anthropic, local providers (Ollama, LM Studio)
- **Real-time Messaging**: WebSocket or streaming connections for AI responses
- **Chat Persistence**: Database storage and retrieval of conversation history
- **Provider Management**: API key validation, model availability, error handling
- **Performance**: Streaming responses, large conversation handling

## Test Data Requirements

### Shared Test Data Setup
```typescript
// Location: e2e/fixtures/chat-page-data.ts
export const ChatPageTestData = {
  // Test chat conversations
  testChats: [
    {
      id: 1,
      name: 'Code Review Session',
      messages: [
        { role: 'user', content: 'Please review this authentication function', timestamp: Date.now() - 3600000 },
        { role: 'assistant', content: 'I\'ll analyze your authentication function for security and best practices...', timestamp: Date.now() - 3500000 }
      ],
      provider: 'anthropic',
      model: 'claude-3-sonnet-20240229'
    },
    {
      id: 2, 
      name: 'Bug Analysis Discussion',
      messages: [
        { role: 'user', content: 'I\'m encountering a strange bug in the login flow', timestamp: Date.now() - 7200000 },
        { role: 'assistant', content: 'Let me help you debug this login issue. Can you share the error message?', timestamp: Date.now() - 7100000 }
      ],
      provider: 'openai',
      model: 'gpt-4'
    },
    {
      id: 3,
      name: 'Empty Chat',
      messages: [],
      provider: 'anthropic', 
      model: 'claude-3-sonnet-20240229'
    }
  ],

  // Test providers and models
  testProviders: [
    {
      id: 'anthropic',
      name: 'Anthropic',
      models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
      available: true
    },
    {
      id: 'openai',
      name: 'OpenAI', 
      models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      available: true
    },
    {
      id: 'ollama',
      name: 'Ollama (Local)',
      models: ['llama3', 'codellama', 'mistral'],
      available: false // May not be available in test environment
    },
    {
      id: 'lmstudio',
      name: 'LM Studio (Local)', 
      models: ['local-model'],
      available: false // May not be available in test environment
    }
  ],

  // Test model settings
  defaultSettings: {
    temperature: 0.7,
    maxTokens: 4000,
    topP: 1.0,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0
  },

  // Test messages for different scenarios
  testMessages: {
    simple: 'Hello, can you help me with a coding question?',
    complex: `I'm working on a React application and need help implementing user authentication. 
Here's my current setup:
- Using React 19 with TypeScript
- Backend API with JWT tokens
- Need to handle login, logout, and protected routes

Can you provide guidance on best practices?`,
    codeSnippet: `Please review this function:

\`\`\`typescript
function authenticate(username: string, password: string) {
  if (!username || !password) {
    throw new Error('Invalid credentials');
  }
  return jwt.sign({ username }, 'secret', { expiresIn: '1h' });
}
\`\`\``,
    longMessage: 'This is a very long message '.repeat(100) + 'that tests message handling with extensive content.'
  }
}
```

## Page Object Model Extensions

### ChatPage Class Implementation
```typescript
// Location: e2e/pages/chat-page.ts
export class ChatPage extends BasePage {
  // Chat Header Elements
  get chatHeader() {
    return this.page.getByTestId('chat-header')
  }

  get historyDrawerButton() {
    return this.page.getByTestId('chat-history-drawer-button')
  }

  get chatName() {
    return this.page.getByTestId('chat-name')
  }

  get chatSettingsButton() {
    return this.page.getByTestId('chat-settings-button')
  }

  // Message Area Elements
  get messagesContainer() {
    return this.page.getByTestId('messages-container')
  }

  get messages() {
    return this.page.getByTestId('message')
  }

  get emptyState() {
    return this.page.getByTestId('empty-chat-state')
  }

  get emptyStateText() {
    return this.page.getByText('No messages yet')
  }

  get emptyStateSubtext() {
    return this.page.getByText('start the conversation by typing your message below')
  }

  // User Input Elements
  get userInputArea() {
    return this.page.getByTestId('user-input-area')
  }

  get messageInput() {
    return this.page.getByTestId('message-input')
  }

  get sendButton() {
    return this.page.getByTestId('send-button')
  }

  get providerSelector() {
    return this.page.getByTestId('provider-selector')
  }

  get modelSelector() {
    return this.page.getByTestId('model-selector')
  }

  get providerDisplay() {
    return this.page.getByTestId('provider-display')
  }

  get modelDisplay() {
    return this.page.getByTestId('model-display')
  }

  // Chat History Elements
  get historyDrawer() {
    return this.page.getByTestId('chat-history-drawer')
  }

  get historyList() {
    return this.page.getByTestId('chat-history-list')
  }

  get historyItems() {
    return this.page.getByTestId('chat-history-item')
  }

  historyItemByName(name: string) {
    return this.page.getByTestId('chat-history-item').filter({ hasText: name })
  }

  // Chat Settings Elements
  get settingsModal() {
    return this.page.getByTestId('chat-settings-modal')
  }

  get temperatureSlider() {
    return this.page.getByTestId('temperature-slider')
  }

  get maxTokensInput() {
    return this.page.getByTestId('max-tokens-input')
  }

  get topPSlider() {
    return this.page.getByTestId('top-p-slider')
  }

  get frequencyPenaltySlider() {
    return this.page.getByTestId('frequency-penalty-slider')
  }

  get presencePenaltySlider() {
    return this.page.getByTestId('presence-penalty-slider')
  }

  // Helper Methods
  async sendMessage(message: string) {
    await this.messageInput.fill(message)
    await this.sendButton.click()
    
    // Wait for message to appear in conversation
    await expect(this.messages.last()).toContainText(message)
    
    // Wait for input to be cleared
    await expect(this.messageInput).toHaveValue('')
  }

  async selectProvider(providerId: string) {
    await this.providerSelector.click()
    await this.page.getByTestId(`provider-option-${providerId}`).click()
    
    // Wait for provider to be selected
    await expect(this.providerDisplay).toContainText(providerId)
  }

  async selectModel(modelName: string) {
    await this.modelSelector.click()
    await this.page.getByTestId(`model-option-${modelName}`).click()
    
    // Wait for model to be selected
    await expect(this.modelDisplay).toContainText(modelName)
  }

  async openChatHistory() {
    await this.historyDrawerButton.click()
    await expect(this.historyDrawer).toBeVisible()
  }

  async openChatSettings() {
    await this.chatSettingsButton.click()
    await expect(this.settingsModal).toBeVisible()
  }

  async waitForAIResponse(timeout = 30000) {
    // Wait for streaming or response to complete
    await expect(this.page.getByTestId('typing-indicator')).toBeVisible({ timeout: 5000 })
    await expect(this.page.getByTestId('typing-indicator')).toBeHidden({ timeout })
  }

  getUserMessage(messageText: string) {
    return this.messages.filter({ hasText: messageText }).filter({ has: this.page.getByTestId('user-message') })
  }

  getAssistantMessage(index: number = 0) {
    return this.messages.filter({ has: this.page.getByTestId('assistant-message') }).nth(index)
  }
}
```

## Test Scenarios

### 1. Chat Interface Basic Functionality

#### 1.1 Header and Navigation Tests
```typescript
test.describe('Chat Header and Navigation', () => {
  test('should display chat history drawer button in header', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat')

    // Verify header exists
    await expect(chatPage.chatHeader).toBeVisible()

    // Verify history drawer button is in top left
    await expect(chatPage.historyDrawerButton).toBeVisible()
    
    // Check button positioning (should be in top-left area)
    const buttonBox = await chatPage.historyDrawerButton.boundingBox()
    expect(buttonBox?.x).toBeLessThan(200) // Should be in left portion
    expect(buttonBox?.y).toBeLessThan(100) // Should be near top
  })

  test('should display chat name in header', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat/1') // Load specific chat

    // Verify chat name is displayed
    await expect(chatPage.chatName).toBeVisible()
    await expect(chatPage.chatName).toContainText('Code Review Session')
  })

  test('should have chat settings button in top right', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat')

    // Verify settings button exists and is positioned in top right
    await expect(chatPage.chatSettingsButton).toBeVisible()
    
    const buttonBox = await chatPage.chatSettingsButton.boundingBox()
    const pageWidth = await page.viewportSize().then(v => v?.width || 1280)
    expect(buttonBox?.x).toBeGreaterThan(pageWidth - 200) // Should be in right portion
  })
})
```

#### 1.2 Empty State Tests
```typescript
test.describe('Empty Chat State', () => {
  test('should display empty state for new chat', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat/new')

    // Verify empty state is displayed
    await expect(chatPage.emptyState).toBeVisible()
    await expect(chatPage.emptyStateText).toBeVisible()
    await expect(chatPage.emptyStateSubtext).toBeVisible()

    // Verify exact text content
    await expect(chatPage.emptyStateText).toHaveText('No messages yet')
    await expect(chatPage.emptyStateSubtext).toHaveText('start the conversation by typing your message below')

    // Verify no messages are displayed
    await expect(chatPage.messages).toHaveCount(0)
  })

  test('should hide empty state when messages exist', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat/1') // Chat with existing messages

    // Empty state should not be visible
    await expect(chatPage.emptyState).not.toBeVisible()

    // Messages should be visible instead
    await expect(chatPage.messages).toHaveCount.atLeast(1)
  })
})
```

#### 1.3 User Input Area Tests  
```typescript
test.describe('User Input Area', () => {
  test('should display provider and model in input area', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat')

    // Verify user input area exists
    await expect(chatPage.userInputArea).toBeVisible()

    // Verify provider and model are displayed
    await expect(chatPage.providerDisplay).toBeVisible()
    await expect(chatPage.modelDisplay).toBeVisible()

    // Should show default provider and model
    await expect(chatPage.providerDisplay).toContainText(/anthropic|openai/i)
    await expect(chatPage.modelDisplay).toContainText(/claude|gpt/i)
  })

  test('should handle message input and sending', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat')

    const testMessage = ChatPageTestData.testMessages.simple

    // Type message
    await chatPage.messageInput.fill(testMessage)
    await expect(chatPage.messageInput).toHaveValue(testMessage)

    // Send message
    await chatPage.sendButton.click()

    // Verify message appears in conversation
    await expect(chatPage.getUserMessage(testMessage)).toBeVisible()

    // Verify input is cleared after sending
    await expect(chatPage.messageInput).toHaveValue('')
  })

  test('should send message with Enter key', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat')

    const testMessage = ChatPageTestData.testMessages.simple

    // Type message and press Enter
    await chatPage.messageInput.fill(testMessage)
    await chatPage.messageInput.press('Enter')

    // Verify message was sent
    await expect(chatPage.getUserMessage(testMessage)).toBeVisible()
    await expect(chatPage.messageInput).toHaveValue('')
  })

  test('should reset input after message is sent', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat')

    const testMessage = 'Test message for input reset'

    // Send message
    await chatPage.sendMessage(testMessage)

    // Verify input is completely cleared and ready for next message
    await expect(chatPage.messageInput).toHaveValue('')
    await expect(chatPage.messageInput).toBeFocused() // Should maintain focus for continuous typing
  })
})
```

### 2. Provider and Model Management

#### 2.1 Provider Selection Tests
```typescript
test.describe('Provider Selection', () => {
  test.beforeEach(async ({ page }) => {
    // Setup available providers for testing
    await TestDataManager.setupProviders(page, ChatPageTestData.testProviders)
  })

  test('should display available providers', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat')

    // Click provider selector
    await chatPage.providerSelector.click()

    // Verify available providers are shown
    for (const provider of ChatPageTestData.testProviders) {
      if (provider.available) {
        await expect(page.getByTestId(`provider-option-${provider.id}`)).toBeVisible()
        await expect(page.getByText(provider.name)).toBeVisible()
      }
    }
  })

  test('should change provider and update model options', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat')

    // Select OpenAI provider
    await chatPage.selectProvider('openai')

    // Verify provider changed
    await expect(chatPage.providerDisplay).toContainText('OpenAI')

    // Click model selector to see updated models
    await chatPage.modelSelector.click()

    // Verify OpenAI models are available
    await expect(page.getByTestId('model-option-gpt-4')).toBeVisible()
    await expect(page.getByTestId('model-option-gpt-4-turbo')).toBeVisible()

    // Switch to Anthropic
    await chatPage.selectProvider('anthropic')

    // Verify Anthropic models are now available
    await chatPage.modelSelector.click()
    await expect(page.getByTestId('model-option-claude-3-sonnet-20240229')).toBeVisible()
  })

  test('should handle provider switching during conversation', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat')

    // Send a message with default provider
    await chatPage.sendMessage('Hello from Anthropic')
    
    // Wait for response (mocked or real)
    await chatPage.waitForAIResponse()

    // Switch provider
    await chatPage.selectProvider('openai')
    await chatPage.selectModel('gpt-4')

    // Send another message
    await chatPage.sendMessage('Hello from OpenAI')

    // Verify both messages exist in conversation
    await expect(chatPage.getUserMessage('Hello from Anthropic')).toBeVisible()
    await expect(chatPage.getUserMessage('Hello from OpenAI')).toBeVisible()

    // Verify provider info is preserved per message (if displayed)
    const anthropicMessage = chatPage.getUserMessage('Hello from Anthropic')
    const openaiMessage = chatPage.getUserMessage('Hello from OpenAI')

    // Messages should indicate which provider was used (if UI shows this)
    // This would depend on your specific implementation
  })
})
```

#### 2.2 Model Selection Tests
```typescript
test.describe('Model Selection', () => {
  test('should display available models for selected provider', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat')

    // Ensure Anthropic is selected
    await chatPage.selectProvider('anthropic')

    // Click model selector
    await chatPage.modelSelector.click()

    // Verify Anthropic models are displayed
    const anthropicProvider = ChatPageTestData.testProviders.find(p => p.id === 'anthropic')
    for (const model of anthropicProvider?.models || []) {
      await expect(page.getByTestId(`model-option-${model}`)).toBeVisible()
    }
  })

  test('should update model display when model is changed', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat')

    // Select specific model
    await chatPage.selectModel('claude-3-opus-20240229')

    // Verify model display updated
    await expect(chatPage.modelDisplay).toContainText('claude-3-opus-20240229')
  })

  test('should preserve model selection across page reloads', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat')

    // Select specific provider and model
    await chatPage.selectProvider('openai')
    await chatPage.selectModel('gpt-4-turbo')

    // Reload page
    await page.reload()
    await chatPage.waitForPageLoad()

    // Verify selections are preserved
    await expect(chatPage.providerDisplay).toContainText('OpenAI')
    await expect(chatPage.modelDisplay).toContainText('gpt-4-turbo')
  })
})
```

### 3. Chat Settings and Configuration

#### 3.1 Model Settings Tests
```typescript
test.describe('Model Settings Configuration', () => {
  test('should open chat settings modal', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat')

    // Open settings
    await chatPage.openChatSettings()

    // Verify modal is displayed with all settings
    await expect(chatPage.settingsModal).toBeVisible()
    await expect(page.getByText('Model Settings')).toBeVisible()

    // Verify all setting controls are present
    await expect(chatPage.temperatureSlider).toBeVisible()
    await expect(chatPage.maxTokensInput).toBeVisible() 
    await expect(chatPage.topPSlider).toBeVisible()
    await expect(chatPage.frequencyPenaltySlider).toBeVisible()
    await expect(chatPage.presencePenaltySlider).toBeVisible()
  })

  test('should adjust temperature setting', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat')
    await chatPage.openChatSettings()

    // Get current temperature value
    const currentTemp = await chatPage.temperatureSlider.inputValue()
    const newTemp = '0.9'

    // Adjust temperature
    await chatPage.temperatureSlider.fill(newTemp)

    // Verify value changed
    await expect(chatPage.temperatureSlider).toHaveValue(newTemp)

    // Save settings (if there's a save button)
    const saveButton = page.getByRole('button', { name: 'Save' })
    if (await saveButton.isVisible()) {
      await saveButton.click()
    }

    // Close modal
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(chatPage.settingsModal).not.toBeVisible()
  })

  test('should adjust max tokens setting', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat')
    await chatPage.openChatSettings()

    // Set max tokens
    await chatPage.maxTokensInput.fill('2000')
    
    // Verify value updated
    await expect(chatPage.maxTokensInput).toHaveValue('2000')

    // Test validation - should not allow invalid values
    await chatPage.maxTokensInput.fill('999999')
    
    // Should either prevent input or show validation error
    const errorMessage = page.getByText(/max tokens.*limit|invalid.*tokens/i)
    const inputValue = await chatPage.maxTokensInput.inputValue()
    
    // Either validation prevented the input or error is shown
    expect(parseInt(inputValue) <= 100000 || await errorMessage.isVisible()).toBe(true)
  })

  test('should adjust penalty settings with sliders', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat')
    await chatPage.openChatSettings()

    // Test Top P slider
    await chatPage.topPSlider.fill('0.8')
    await expect(chatPage.topPSlider).toHaveValue('0.8')

    // Test Frequency Penalty slider  
    await chatPage.frequencyPenaltySlider.fill('0.5')
    await expect(chatPage.frequencyPenaltySlider).toHaveValue('0.5')

    // Test Presence Penalty slider
    await chatPage.presencePenaltySlider.fill('0.3')
    await expect(chatPage.presencePenaltySlider).toHaveValue('0.3')

    // Verify sliders stay within valid ranges (0-2 for penalties, 0-1 for top-p)
    await chatPage.frequencyPenaltySlider.fill('3.0')
    const freqValue = await chatPage.frequencyPenaltySlider.inputValue()
    expect(parseFloat(freqValue)).toBeLessThanOrEqual(2.0)

    await chatPage.topPSlider.fill('1.5')
    const topPValue = await chatPage.topPSlider.inputValue()
    expect(parseFloat(topPValue)).toBeLessThanOrEqual(1.0)
  })

  test('should persist settings across chat sessions', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat')

    // Set custom settings
    await chatPage.openChatSettings()
    await chatPage.temperatureSlider.fill('0.2')
    await chatPage.maxTokensInput.fill('1500')
    
    const saveButton = page.getByRole('button', { name: 'Save' })
    if (await saveButton.isVisible()) {
      await saveButton.click()
    }
    await page.getByRole('button', { name: 'Close' }).click()

    // Navigate to different chat
    await page.goto('/chat/new')

    // Open settings again
    await chatPage.openChatSettings()

    // Verify settings persisted
    await expect(chatPage.temperatureSlider).toHaveValue('0.2')
    await expect(chatPage.maxTokensInput).toHaveValue('1500')
  })
})
```

### 4. Chat History Management

#### 4.1 History Drawer Tests
```typescript
test.describe('Chat History Management', () => {
  test.beforeEach(async ({ page }) => {
    // Setup test chat history
    await TestDataManager.setupChatHistory(page, ChatPageTestData.testChats)
  })

  test('should open and close chat history drawer', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat')

    // Open history drawer
    await chatPage.openChatHistory()

    // Verify drawer is visible
    await expect(chatPage.historyDrawer).toBeVisible()
    await expect(chatPage.historyList).toBeVisible()

    // Close drawer (click outside or close button)
    await page.mouse.click(100, 300) // Click outside drawer
    await expect(chatPage.historyDrawer).not.toBeVisible()
  })

  test('should display chat history items', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat')
    await chatPage.openChatHistory()

    // Verify all test chats are displayed
    await expect(chatPage.historyItems).toHaveCount(ChatPageTestData.testChats.length)

    // Verify chat names are displayed
    for (const chat of ChatPageTestData.testChats) {
      await expect(chatPage.historyItemByName(chat.name)).toBeVisible()
    }

    // Verify recent chats appear at top (assuming chronological order)
    const firstItem = chatPage.historyItems.first()
    await expect(firstItem).toContainText('Code Review Session') // Most recent
  })

  test('should navigate to selected chat from history', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat')
    await chatPage.openChatHistory()

    // Click on specific chat
    await chatPage.historyItemByName('Bug Analysis Discussion').click()

    // Should navigate to that chat
    await expect(page).toHaveURL(/.*\/chat\/2/)
    await expect(chatPage.chatName).toContainText('Bug Analysis Discussion')

    // History drawer should close
    await expect(chatPage.historyDrawer).not.toBeVisible()

    // Messages should be loaded
    await expect(chatPage.messages).toHaveCount.atLeast(2)
  })

  test('should search chat history', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat')
    await chatPage.openChatHistory()

    // Find search input in history drawer
    const searchInput = page.getByTestId('history-search')
    await searchInput.fill('Bug')

    // Should filter results
    await expect(chatPage.historyItemByName('Bug Analysis Discussion')).toBeVisible()
    await expect(chatPage.historyItemByName('Code Review Session')).not.toBeVisible()

    // Clear search
    await searchInput.clear()

    // All items should be visible again
    await expect(chatPage.historyItems).toHaveCount(ChatPageTestData.testChats.length)
  })
})
```

### 5. Message Handling and AI Integration

#### 5.1 Message Flow Tests
```typescript
test.describe('Message Handling and AI Responses', () => {
  test.beforeEach(async ({ page }) => {
    // Setup AI provider mocks for consistent testing
    await TestDataManager.setupAIProviderMocks(page)
  })

  test('should handle AI response streaming', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat')

    // Send message
    await chatPage.sendMessage(ChatPageTestData.testMessages.simple)

    // Should show typing indicator during response
    await expect(page.getByTestId('typing-indicator')).toBeVisible()

    // Wait for AI response to complete
    await chatPage.waitForAIResponse()

    // Typing indicator should disappear
    await expect(page.getByTestId('typing-indicator')).not.toBeVisible()

    // Assistant response should appear
    const aiResponse = chatPage.getAssistantMessage()
    await expect(aiResponse).toBeVisible()
    await expect(aiResponse).toContainText(/help|assist|can|I/i) // Typical AI response patterns
  })

  test('should handle multiple provider responses', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat')

    // Test with Anthropic
    await chatPage.selectProvider('anthropic')
    await chatPage.sendMessage('Hello from Anthropic test')
    await chatPage.waitForAIResponse()

    const anthropicResponse = chatPage.getAssistantMessage(0)
    await expect(anthropicResponse).toBeVisible()

    // Switch to OpenAI
    await chatPage.selectProvider('openai')
    await chatPage.sendMessage('Hello from OpenAI test')  
    await chatPage.waitForAIResponse()

    const openaiResponse = chatPage.getAssistantMessage(1)
    await expect(openaiResponse).toBeVisible()

    // Both responses should be present
    await expect(chatPage.messages).toHaveCount(4) // 2 user + 2 assistant messages
  })

  test('should handle long messages gracefully', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat')

    // Send very long message
    await chatPage.sendMessage(ChatPageTestData.testMessages.longMessage)

    // Message should be sent and displayed
    const longUserMessage = chatPage.getUserMessage(ChatPageTestData.testMessages.longMessage)
    await expect(longUserMessage).toBeVisible()

    // Should handle response normally (may be truncated or summarized by AI)
    await chatPage.waitForAIResponse()
    const response = chatPage.getAssistantMessage()
    await expect(response).toBeVisible()
  })

  test('should handle code snippets in messages', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat')

    // Send message with code
    await chatPage.sendMessage(ChatPageTestData.testMessages.codeSnippet)

    // Verify code formatting is preserved
    const codeMessage = chatPage.getUserMessage(ChatPageTestData.testMessages.codeSnippet)
    await expect(codeMessage).toBeVisible()
    
    // Check for code block formatting
    await expect(codeMessage.locator('pre, code')).toBeVisible()
    await expect(codeMessage).toContainText('typescript')
    await expect(codeMessage).toContainText('function authenticate')

    // AI should respond appropriately to code
    await chatPage.waitForAIResponse()
    const aiResponse = chatPage.getAssistantMessage()
    await expect(aiResponse).toContainText(/code|function|review|security/i)
  })
})
```

#### 5.2 Error Handling Tests
```typescript
test.describe('Chat Error Handling', () => {
  test('should handle AI service unavailable', async ({ page }) => {
    const chatPage = new ChatPage(page)
    
    // Mock AI service failure
    await page.route('**/api/chat/**', route => {
      route.fulfill({ status: 503, body: JSON.stringify({ error: 'Service unavailable' }) })
    })

    await chatPage.goto('/chat')
    await chatPage.sendMessage('Test message during service outage')

    // Should show error message
    await expect(page.getByText(/service.*unavailable|error.*occurred/i)).toBeVisible()

    // User message should still be visible
    await expect(chatPage.getUserMessage('Test message during service outage')).toBeVisible()

    // Should allow retry
    const retryButton = page.getByRole('button', { name: /retry|try again/i })
    if (await retryButton.isVisible()) {
      await retryButton.click()
    }
  })

  test('should handle network errors gracefully', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat')

    // Simulate network failure during message send
    await page.setOffline(true)
    
    await chatPage.messageInput.fill('Message during network failure')
    await chatPage.sendButton.click()

    // Should show network error
    await expect(page.getByText(/network.*error|connection.*failed/i)).toBeVisible()

    // Restore network
    await page.setOffline(false)

    // Message should retry or allow manual retry
    const retryButton = page.getByRole('button', { name: /retry|send/i })
    if (await retryButton.isVisible()) {
      await retryButton.click()
      await chatPage.waitForAIResponse()
    }
  })

  test('should handle malformed AI responses', async ({ page }) => {
    const chatPage = new ChatPage(page)
    
    // Mock malformed response
    await page.route('**/api/chat/**', route => {
      route.fulfill({
        status: 200,
        body: 'Invalid JSON response'
      })
    })

    await chatPage.goto('/chat')
    await chatPage.sendMessage('Test malformed response')

    // Should handle error gracefully
    await expect(page.getByText(/error.*response|unexpected.*error/i)).toBeVisible()
    
    // User message should still be displayed
    await expect(chatPage.getUserMessage('Test malformed response')).toBeVisible()
  })

  test('should handle provider timeout gracefully', async ({ page }) => {
    const chatPage = new ChatPage(page)
    
    // Mock slow/timeout response
    await page.route('**/api/chat/**', route => {
      // Don't fulfill the route to simulate timeout
      setTimeout(() => {
        route.fulfill({ status: 408, body: JSON.stringify({ error: 'Request timeout' }) })
      }, 35000) // Longer than typical timeout
    })

    await chatPage.goto('/chat')
    await chatPage.sendMessage('Test timeout handling')

    // Should eventually show timeout error
    await expect(page.getByText(/timeout|taking.*long/i)).toBeVisible({ timeout: 40000 })
  })
})
```

### 6. Performance and Accessibility

#### 6.1 Performance Tests
```typescript
test.describe('Chat Performance', () => {
  test('should handle large chat histories efficiently', async ({ page }) => {
    const chatPage = new ChatPage(page)
    
    // Setup large chat history
    await TestDataManager.setupLargeChatHistory(page, 100) // 100 previous messages

    const startTime = Date.now()
    await chatPage.goto('/chat/large-history')
    
    // Should load within reasonable time
    await chatPage.waitForPageLoad()
    const loadTime = Date.now() - startTime
    expect(loadTime).toBeLessThan(5000) // 5 seconds max

    // Should be able to scroll through history smoothly
    await chatPage.messagesContainer.hover()
    await page.mouse.wheel(0, -1000) // Scroll up
    
    // Check that older messages are loaded/visible
    await expect(chatPage.messages.first()).toBeVisible()
  })

  test('should stream AI responses efficiently', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat')

    // Send message and measure response time
    const startTime = Date.now()
    await chatPage.sendMessage('Generate a detailed code review')

    // First response chunk should appear quickly
    await expect(page.getByTestId('typing-indicator')).toBeVisible({ timeout: 3000 })
    const firstChunkTime = Date.now() - startTime

    expect(firstChunkTime).toBeLessThan(3000) // First chunk within 3 seconds

    // Full response should complete in reasonable time
    await chatPage.waitForAIResponse(30000)
    const totalTime = Date.now() - startTime
    expect(totalTime).toBeLessThan(30000) // Complete response within 30 seconds
  })

  test('should maintain UI responsiveness during AI responses', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat')

    // Send message
    await chatPage.sendMessage('Long response test')

    // While AI is responding, UI should remain responsive
    await expect(page.getByTestId('typing-indicator')).toBeVisible()

    // Should be able to interact with other UI elements
    await chatPage.historyDrawerButton.click()
    await expect(chatPage.historyDrawer).toBeVisible()

    await chatPage.chatSettingsButton.click()
    await expect(chatPage.settingsModal).toBeVisible()

    // Close modals
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
  })
})
```

#### 6.2 Accessibility Tests  
```typescript
test.describe('Chat Accessibility', () => {
  test('should support keyboard navigation', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat')

    // Tab to message input
    await page.keyboard.press('Tab')
    await expect(chatPage.messageInput).toBeFocused()

    // Type and send with keyboard
    await page.keyboard.type('Keyboard navigation test')
    await page.keyboard.press('Enter')

    // Should send message
    await expect(chatPage.getUserMessage('Keyboard navigation test')).toBeVisible()

    // Tab to other controls
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    
    // Should be able to access provider selector
    await page.keyboard.press('Enter') // Open provider menu
    
    // Arrow keys should navigate options
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter') // Select option
  })

  test('should have proper ARIA labels', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat')

    // Check important elements have ARIA labels
    await expect(chatPage.messageInput).toHaveAttribute('aria-label', /message.*input|type.*message/i)
    await expect(chatPage.sendButton).toHaveAttribute('aria-label', /send.*message/i)
    await expect(chatPage.historyDrawerButton).toHaveAttribute('aria-label', /chat.*history|open.*history/i)
    await expect(chatPage.chatSettingsButton).toHaveAttribute('aria-label', /settings|chat.*settings/i)

    // Messages should have proper roles
    const userMessage = chatPage.messages.first()
    if (await userMessage.isVisible()) {
      await expect(userMessage).toHaveAttribute('role', 'article')
      await expect(userMessage).toHaveAttribute('aria-label', /message.*from|user.*message/i)
    }
  })

  test('should announce AI responses to screen readers', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto('/chat')

    // Send message
    await chatPage.sendMessage('Screen reader test')

    // AI response should be announced
    await chatPage.waitForAIResponse()
    const aiResponse = chatPage.getAssistantMessage()
    
    // Should have aria-live region or proper announcement
    await expect(aiResponse).toHaveAttribute('aria-live', 'polite')
    // Or check for aria-label that would be announced
    const hasAnnouncementText = await aiResponse.getAttribute('aria-label')
    expect(hasAnnouncementText).toMatch(/assistant.*response|ai.*reply/i)
  })
})
```

## Best Practices and Recommendations

### 1. Test Data Management
- **Provider Mocking**: Mock AI providers for consistent, fast testing
- **Response Simulation**: Create realistic AI response patterns for different scenarios
- **History Persistence**: Test chat history across browser sessions and reloads

### 2. Async Operations Handling  
- **Streaming Responses**: Properly wait for incremental AI response updates
- **Network Resilience**: Test behavior under various network conditions
- **Timeout Handling**: Verify graceful degradation when AI services are slow

### 3. Performance Optimization
- **Large Chat History**: Test with realistic conversation lengths
- **Concurrent Requests**: Verify UI remains responsive during AI processing
- **Memory Management**: Monitor for memory leaks during long chat sessions

### 4. Cross-Provider Testing
- **Provider Switching**: Ensure seamless transitions between AI providers
- **Model Compatibility**: Test different models within the same provider
- **Error Consistency**: Standardize error handling across all providers

### 5. Real-World Scenarios
- **Code Review Workflows**: Test with actual code snippets and technical discussions
- **Long Conversations**: Verify performance with extended back-and-forth exchanges
- **Mixed Content**: Test with various message types (text, code, lists, etc.)

## Execution Strategy

### 1. Test Isolation
- Each test uses a fresh chat session to avoid interference
- Provider mocks are reset between tests to ensure consistent state
- Chat history is isolated per test to prevent data pollution

### 2. Parallel Execution
- **Basic UI Tests** can run in parallel (header, empty state, input area)
- **Provider Tests** should be grouped to avoid race conditions
- **Performance Tests** may need sequential execution for accurate measurements

### 3. Environment Considerations
- **Local Providers**: Tests gracefully handle when Ollama/LM Studio are unavailable
- **API Keys**: Use mock providers in CI/CD to avoid real API costs
- **Network Conditions**: Include offline/slow network testing scenarios

This comprehensive test plan ensures the Chat Page functionality is thoroughly validated across all major features, with particular attention to AI provider integration, real-time messaging, and user experience under various conditions.