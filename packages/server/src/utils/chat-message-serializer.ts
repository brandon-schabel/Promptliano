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

const normalizeMermaidCodeBlocks = (input: unknown): string => {
  const value = typeof input === 'string' ? input : ''
  if (!value) return value

  const ensureFenceBreaks = value.replace(/```mermaid(?![\r\n])/gi, '```mermaid\n')

  return ensureFenceBreaks.replace(/```mermaid([\s\S]*?)```/gi, (match, rawBlock) => {
    if (typeof rawBlock !== 'string') return match

    const normalizedBlock = (() => {
      let block = rawBlock.replace(/\r\n/g, '\n')

      const directivePattern = /(^|\n)(\s*(?:(?:flowchart|graph)\s+[a-z0-9_-]+|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|mindmap|quadrantChart|timeline|gitGraph))([ \t]+)(?!;)([^\n]+)/i
      const directiveMatch = block.match(directivePattern)
      if (directiveMatch) {
        const [fullMatch, prefix, directive, separator, remainder] = directiveMatch
        const remainderIndentMatch = remainder.match(/^[\t ]*/)
        const remainderIndent = remainderIndentMatch ? remainderIndentMatch[0] : ''
        const remainderContent = remainder.slice(remainderIndent.length)
        if (remainderContent.trim().length > 0) {
          const prefixString = typeof prefix === 'string' ? prefix : ''
          const effectiveIndent = remainderIndent.length > 0 ? remainderIndent : separator
          const replacement = `${prefixString}${directive}\n${effectiveIndent}${remainderContent}`
          block = block.replace(fullMatch, replacement)
        }
      }

      if (!block.startsWith('\n')) {
        block = `\n${block}`
      }

      block = block.replace(/\s*$/, '')
      return `${block}\n`
    })()

    const leadingFence = '```mermaid'
    const closingFence = '```'
    return `${leadingFence}${normalizedBlock}${closingFence}`
  })
}

const normalizeTextParts = (parts: any[]): any[] =>
  parts.map((part) => {
    if (part?.type === 'text' && typeof part.text === 'string') {
      const normalized = normalizeMermaidCodeBlocks(part.text)
      if (normalized !== part.text) {
        return {
          ...part,
          text: normalized
        }
      }
    }
    return part
  })

const normalizeMermaidMetadata = (
  metadata: Record<string, unknown> | null | undefined,
  normalizedParts: any[]
): Record<string, unknown> | undefined => {
  if (!metadata) return undefined

  const raw = metadata as Record<string, unknown>
  const updated: Record<string, unknown> = { ...raw }

  const rawParts = raw['parts']
  if (Array.isArray(rawParts)) {
    updated['parts'] = normalizedParts
  }

  const uiMessageRaw = raw['uiMessage']
  if (uiMessageRaw && typeof uiMessageRaw === 'object') {
    const uiMessage = { ...(uiMessageRaw as Record<string, unknown>) }
    const uiMessageParts = uiMessage['parts']
    if (Array.isArray(uiMessageParts)) {
      uiMessage['parts'] = normalizeTextParts(uiMessageParts as any[])
    }
    const uiMessageContent = uiMessage['content']
    if (typeof uiMessageContent === 'string') {
      uiMessage['content'] = normalizeMermaidCodeBlocks(uiMessageContent)
    }
    updated['uiMessage'] = uiMessage
  }

  return updated
}

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
    const baseParts = metadataParts ?? fallbackParts(message.content)
    const parts = normalizeTextParts(baseParts)

    let textContent = typeof message.content === 'string' ? message.content : ''
    if ((!textContent || textContent.trim().length === 0) && metadata.uiMessage) {
      const uiMessage = metadata.uiMessage as Record<string, unknown>
      const uiText = typeof uiMessage.content === 'string' ? uiMessage.content : ''
      if (uiText.length > 0) {
        textContent = uiText
      }
    }

    const baseContent =
      textContent && textContent.trim().length > 0 ? textContent : extractTextFromParts(parts, '')
    const content = normalizeMermaidCodeBlocks(baseContent)
    const normalizedMetadata = normalizeMermaidMetadata(metadata, parts)

    return {
      id: metadata.sourceId ? String(metadata.sourceId) : `msg_${message.id}`,
      role: message.role,
      content,
      parts,
      createdAt: message.createdAt ? new Date(message.createdAt).getTime() : undefined,
      metadata: normalizedMetadata ?? metadata
    }
  }

  const parsed = parseContent(message.content)
  const baseParts = parsed ? parsed.parts : fallbackParts(message.content)
  const parts = normalizeTextParts(baseParts)
  const baseText = parsed?.text ?? extractTextFromParts(parts, message.content)
  const text = normalizeMermaidCodeBlocks(baseText)
  const normalizedMetadata = normalizeMermaidMetadata(message.metadata ?? undefined, parts)

  return {
    id: message.metadata?.sourceId ? String(message.metadata.sourceId) : `msg_${message.id}`,
    role: message.role,
    content: text,
    parts,
    createdAt: message.createdAt ? new Date(message.createdAt).getTime() : undefined,
    metadata: normalizedMetadata ?? message.metadata ?? undefined
  }
}
