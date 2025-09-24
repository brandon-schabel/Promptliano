import type { UIMessage } from 'ai'
import type { ChatMessage, CreateChatMessage } from '@promptliano/database'

type ChatUiMessage = UIMessage<any, any> & {
  content?: string
  createdAt?: number
}

interface PersistedContent {
  parts: any[]
  text: string
}

const ensureSerializableToolInvocation = (invocation: any) => {
  if (!invocation || typeof invocation !== 'object') return invocation
  return {
    ...invocation,
    args: invocation.args ?? null,
    result: invocation.result ?? null
  }
}

const ensureSerializablePart = (part: any): any => {
  if (!part) return part

  if (part.type === 'tool-invocation') {
    return {
      ...part,
      toolInvocation: ensureSerializableToolInvocation(part.toolInvocation)
    }
  }

  if (part.type === 'tool') {
    return {
      ...part,
      args: part.args ?? null,
      result: part.result ?? null
    }
  }

  return part
}

const createTextPart = (content: string) => ({
  type: 'text',
  text: content
})

const normalizeParts = (message: ChatUiMessage): any[] => {
  if (Array.isArray(message.parts) && message.parts.length > 0) {
    return message.parts.map(ensureSerializablePart)
  }

  const fallback = typeof message.content === 'string' && message.content.length > 0 ? message.content : ''
  return fallback ? [createTextPart(fallback)] : []
}

const extractTextFromParts = (parts: any[], fallback = ''): string => {
  const textFragments = parts
    .filter((part) => part?.type === 'text' && typeof part.text === 'string' && part.text.length > 0)
    .map((part) => part.text.trim())

  if (textFragments.length > 0) {
    return textFragments.join('\n\n')
  }

  const toolResultFragments = parts
    .filter((part) => part?.type === 'tool-invocation' && part.toolInvocation?.state === 'result')
    .map((part) => {
      const result = part.toolInvocation?.result
      if (typeof result === 'string') return result
      if (result == null) return ''
      try {
        return JSON.stringify(result)
      } catch {
        return ''
      }
    })
    .filter((value) => value.length > 0)

  if (toolResultFragments.length > 0) {
    return toolResultFragments.join('\n\n')
  }

  return fallback
}

export const serializeUiMessage = (
  message: ChatUiMessage
): Pick<CreateChatMessage, 'role' | 'content' | 'metadata'> => {
  const parts = normalizeParts(message)
  const text = extractTextFromParts(parts, typeof message.content === 'string' ? message.content : '')

  const payload: PersistedContent = {
    parts,
    text
  }

  return {
    role: message.role,
    content: JSON.stringify(payload),
    metadata: {
      sourceId: message.id,
      storedAt: Date.now(),
      textPreview: text
    }
  }
}

const parseContent = (raw: string): PersistedContent | null => {
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.parts)) {
      const text = typeof parsed.text === 'string' ? parsed.text : ''
      return {
        parts: parsed.parts,
        text
      }
    }
    return null
  } catch {
    return null
  }
}

const fallbackParts = (content: string): any[] => [createTextPart(content)]

export const deserializeChatMessage = (message: ChatMessage): ChatUiMessage => {
  if (message.metadata && message.metadata.sourceOfTruth === 'stream') {
    const metadata = message.metadata
    const metadataParts = Array.isArray(metadata.parts)
      ? metadata.parts
      : Array.isArray((metadata.uiMessage as any)?.parts)
        ? (metadata.uiMessage as any).parts
        : null
    const parts = metadataParts ?? fallbackParts(message.content)

    let textContent = typeof message.content === 'string' ? message.content : ''
    if ((!textContent || textContent.trim().length === 0) && metadata.uiMessage) {
      const uiMessage = metadata.uiMessage as Record<string, unknown>
      const uiText = typeof uiMessage.content === 'string' ? uiMessage.content : ''
      if (uiText.length > 0) {
        textContent = uiText
      }
    }

    const content = textContent && textContent.trim().length > 0 ? textContent : extractTextFromParts(parts, '')

    return {
      id: metadata.sourceId ? String(metadata.sourceId) : `msg_${message.id}`,
      role: message.role,
      content,
      parts,
      createdAt: message.createdAt ? new Date(message.createdAt).getTime() : undefined,
      metadata
    }
  }

  const parsed = parseContent(message.content)
  const parts = parsed ? parsed.parts : fallbackParts(message.content)
  const text = parsed?.text ?? extractTextFromParts(parts, message.content)

  return {
    id: message.metadata?.sourceId ? String(message.metadata.sourceId) : `msg_${message.id}`,
    role: message.role,
    content: text,
    parts,
    createdAt: message.createdAt ? new Date(message.createdAt).getTime() : undefined,
    metadata: message.metadata ?? undefined
  }
}
