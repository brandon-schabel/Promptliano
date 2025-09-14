import { countTokens } from 'gpt-tokenizer/model/gpt-4o'

import type { Message } from '~/services/copilot/create-chat-completions'

export const getTokenCount = (messages: Array<Message>) => {
  const simplifiedMessages = messages.map((message) => {
    let content = ''
    if (typeof message.content === 'string') {
      content = message.content
    } else if (Array.isArray(message.content)) {
      content = message.content
        .filter((part) => part.type === 'text')
        .map((part) => (part as { text: string }).text)
        .join('')
    }
    return { ...message, content }
  })

  let inputMessages = simplifiedMessages.filter((message) => {
    return message.role !== 'tool'
  })
  let outputMessages: typeof simplifiedMessages = []

  const lastMessage = simplifiedMessages.at(-1)

  if (lastMessage?.role === 'assistant') {
    inputMessages = simplifiedMessages.slice(0, -1)
    outputMessages = [lastMessage]
  }

  // @ts-expect-error TS can't infer from arr.filter()
  const inputTokens = countTokens(inputMessages)
  // @ts-expect-error TS can't infer from arr.filter()
  const outputTokens = countTokens(outputMessages)

  return {
    input: inputTokens,
    output: outputTokens
  }
}
