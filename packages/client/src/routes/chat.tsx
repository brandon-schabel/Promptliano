import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import React from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { chatSearchSchema } from '@/lib/search-schemas'
import { persistListParams } from '@/lib/router/search-middleware'
import {
  MessageSquareIcon,
  PlusIcon,
  Check,
  X,
  Edit2,
  Trash2,
  Settings2Icon,
  Copy,
  GitFork,
  Trash,
  PlayCircle,
  ListTree,
  MessageSquareText,
  Brain,
  ChevronDown,
  Loader2,
  Search,
  ChevronsDown,
  ChevronsUp
} from 'lucide-react'
import { toast } from 'sonner'
import type { ChatUiMessage as AIChatMessage } from '@/hooks/generated/ai-chat-hooks'

import { useAIChat } from '@/hooks/generated'
import { useChatModelParams } from '@/hooks/chat/use-chat-model-params'
import { SlidingSidebar } from '@/components/sliding-sidebar'
import {
  useGetChats,
  useDeleteChat,
  useUpdateChat,
  useCreateChat,
  useDeleteMessage,
  useForkChatFromMessage
} from '@/hooks/generated'
import type { Chat, ChatMessage } from '@promptliano/database'
import { cn } from '@/lib/utils'
import {
  ScrollArea,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Card,
  Button,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Switch,
  Input,
  Label,
  Textarea,
  Slider,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
  Message,
  MessageContent,
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputSubmit,
  Response,
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput
} from '@promptliano/ui'
import type { PromptInputMessage } from '@promptliano/ui'
import { ChatCard } from '@/components/chat/chat-card'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import type { APIProviders, AiSdkOptions } from '@promptliano/database'
import { useDebounceCallback } from '@/hooks/utility-hooks/use-debounce'
import { PROVIDER_SELECT_OPTIONS } from '@/constants/providers-constants'
import { useLocalStorage } from '@/hooks/utility-hooks/use-local-storage'
import { useProjectTabField, useAppSettings, useActiveProjectTab } from '@/hooks/use-kv-local-storage'
import { PromptlianoCombobox } from '@/components/promptliano/promptliano-combobox'
import { ErrorBoundary } from '@/components/error-boundary/error-boundary'
import { useGetModels } from '@/hooks/generated'
import {
  ProviderModelSelector,
  ModelSettingsPopover as ReusableModelSettingsPopover,
  PresetSelector,
  type ModelPreset
} from '@/components/model-selection'
import { AIErrorDisplay } from '@/components/errors'
import { useModelConfigPresets } from '@/hooks/use-model-presets'

export function ModelSettingsPopover() {
  const {
    settings,
    setTemperature,
    setMaxTokens,
    setTopP,
    setFreqPenalty,
    setPresPenalty,
    setProvider,
    setModel,
    isTempDisabled
  } = useChatModelParams()

  const handleSettingsChange = (newSettings: Partial<AiSdkOptions>) => {
    if (newSettings.temperature !== undefined && newSettings.temperature !== null) {
      setTemperature(newSettings.temperature)
    }
    if (newSettings.maxTokens !== undefined && newSettings.maxTokens !== null) {
      setMaxTokens(newSettings.maxTokens)
    }
    if (newSettings.topP !== undefined && newSettings.topP !== null) {
      setTopP(newSettings.topP)
    }
    if (newSettings.frequencyPenalty !== undefined && newSettings.frequencyPenalty !== null) {
      setFreqPenalty(newSettings.frequencyPenalty)
    }
    if (newSettings.presencePenalty !== undefined && newSettings.presencePenalty !== null) {
      setPresPenalty(newSettings.presencePenalty)
    }
  }

  const handleProviderChange = (value: string) => {
    // When the provider changes via the settings UI, clear the model
    // so the model selector can pick a valid one for the new provider.
    setProvider(value as APIProviders)
    setModel('')
  }

  const handleModelChange = (value: string) => {
    setModel(value)
  }

  return (
    <ReusableModelSettingsPopover
      provider={(settings.provider ?? 'openrouter') as APIProviders}
      model={settings.model ?? 'gpt-4o'}
      settings={{
        temperature: settings.temperature ?? 0.7,
        maxTokens: settings.maxTokens ?? 100000,
        topP: settings.topP ?? 0.9,
        frequencyPenalty: settings.frequencyPenalty ?? 0,
        presencePenalty: settings.presencePenalty ?? 0
      }}
      onProviderChange={handleProviderChange}
      onModelChange={handleModelChange}
      onSettingsChange={handleSettingsChange}
      isTempDisabled={isTempDisabled}
    />
  )
}

// ProviderModelSector is now imported from the reusable components

function parseThinkBlock(content: string) {
  if (!content?.startsWith('<think>')) {
    return { hasThinkBlock: false, isThinking: false, thinkContent: '', mainContent: content ?? '' }
  }

  const endIndex = content.indexOf('</think>')
  if (endIndex === -1) {
    return { hasThinkBlock: true, isThinking: true, thinkContent: content.slice(7), mainContent: '' }
  }

  return {
    hasThinkBlock: true,
    isThinking: false,
    thinkContent: content.slice(7, endIndex).trim(),
    mainContent: content.slice(endIndex + 8).trimStart()
  }
}

const buildReasoningPreview = (content: string): string => {
  if (!content) return ''
  const firstLine = content.split(/\r?\n/).find((line) => line.trim().length > 0) ?? ''
  const trimmed = firstLine.trim()
  return trimmed.length > 160 ? `${trimmed.slice(0, 160).trim()}...` : trimmed
}

const extractFirstText = (input: unknown): string => {
  if (input == null) return ''
  if (typeof input === 'string') return input
  if (Array.isArray(input)) {
    for (const entry of input) {
      const candidate = extractFirstText(entry)
      if (candidate.trim().length > 0) return candidate
    }
    return ''
  }
  if (typeof input === 'object') {
    const record = input as Record<string, unknown>
    const prioritizedKeys = ['message', 'error', 'text', 'value', 'content', 'output']
    for (const key of prioritizedKeys) {
      if (record[key] === undefined) continue
      const candidate = extractFirstText(record[key])
      if (candidate.trim().length > 0) return candidate
    }
    try {
      return JSON.stringify(input)
    } catch {
      return ''
    }
  }
  return ''
}

const formatDataForDisplay = (value: unknown): string | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

const tryPrettyPrintJson = (value: string): string | null => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const isLikelyJson =
    (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))
  if (!isLikelyJson) return null
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2)
  } catch {
    return null
  }
}

const flattenWhitespace = (text: string): string => text.replace(/\s+/g, ' ').trim()

const truncateForPreview = (text: string, max = 160): string => {
  const normalized = flattenWhitespace(text)
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, max).trim()}...`
}

const DEFAULT_LMSTUDIO_URL = 'http://localhost:1234'
const CHAT_INPUT_STORAGE_KEY = 'CHAT_INPUT_VALUE'
const DEFAULT_SYSTEM_PROMPT = 'You are a helpful assistant that can answer questions and help with tasks.'
const SYSTEM_PROMPT_STORAGE_KEY = 'chat-system-prompts'

const cleanToolName = (value?: string | null): string | undefined => {
  if (!value) return undefined
  const cleaned = value.replace(/[_-]+/g, ' ').trim()
  return cleaned.length > 0 ? cleaned : undefined
}

const toToolText = (value: unknown): string => {
  const primary = extractFirstText(value)
  if (primary && primary.trim().length > 0) return primary.trim()
  if (typeof value === 'string') return value
  if (value == null) return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

const buildToolPreview = (call: Pick<ToolCallDisplay, 'argsSummary' | 'outputSummary' | 'errorText'>): string => {
  const segments: string[] = []
  if (call.argsSummary) {
    segments.push(`Args: ${truncateForPreview(call.argsSummary, 120)}`)
  }
  if (call.errorText) {
    segments.push(`Error: ${truncateForPreview(call.errorText, 160)}`)
  } else if (call.outputSummary) {
    segments.push(`Result: ${truncateForPreview(call.outputSummary, 160)}`)
  }
  return segments.join(' | ')
}

type ToolCallDisplay = {
  id: string
  toolName?: string
  argsSummary?: string | null
  outputSummary?: string | null
  rawArgs?: unknown
  rawOutput?: unknown
  errorText?: string | null
  providerExecuted?: boolean
  status?: 'pending' | 'result' | 'error'
  previewText?: string | null
  isStreaming?: boolean
  stepIndex?: number | null
  stepLabel?: string | null
  order: number
}

type StepMarker = {
  id: string
  step: number
  label?: string | null
}

type ToolCopyPayload = {
  value: string
  label: 'args' | 'result' | 'error'
  toolName?: string
}

type Message = AIChatMessage

type MessageBlock =
  | { type: 'reasoning'; id: string; data: { text: string; preview: string; streaming: boolean } }
  | { type: 'tool'; id: string; call: ToolCallDisplay }
  | { type: 'step'; id: string; step: number; label?: string | null }
  | { type: 'content'; id: string; content: string }

const ReasoningSection: React.FC<{
  text: string
  preview: string
  isStreaming: boolean
  onCopy: () => void
}> = ({ text, preview, isStreaming, onCopy }) => {
  const hasReasoning = text.trim().length > 0
  const previewLabel = preview || (isStreaming ? 'Waiting for model...' : 'No reasoning provided')

  return (
    <Reasoning
      isStreaming={isStreaming}
      defaultOpen={isStreaming}
      className='mb-3 rounded-md border border-amber-200/70 bg-amber-50/70 shadow-sm dark:border-amber-500/40 dark:bg-amber-950/40'
    >
      <div className='flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-amber-900 dark:text-amber-100'>
        <ReasoningTrigger className='group flex w-full items-center justify-between gap-2 text-left text-xs font-semibold text-amber-900 transition-colors hover:text-amber-700 dark:text-amber-100 dark:hover:text-amber-50'>
          <span className='flex items-center gap-2'>
            <Brain className='h-4 w-4' />
            {isStreaming ? (
              <span className='flex items-center gap-1'>
                <Loader2 className='h-3 w-3 animate-spin' />
                Reasoning
              </span>
            ) : (
              'Reasoning'
            )}
          </span>
          <span className='flex items-center gap-2 text-[11px] font-normal text-amber-900/80 dark:text-amber-100/80'>
            <span className='max-w-[220px] truncate'>{previewLabel}</span>
            <ChevronDown className='h-3 w-3 transition-transform group-data-[state=open]:rotate-180' />
          </span>
        </ReasoningTrigger>
      </div>
      <ReasoningContent className='border-t border-amber-200/60 px-3 py-2 font-mono text-[11px] text-amber-900 whitespace-pre-wrap break-words dark:border-amber-500/30 dark:text-amber-100 sm:text-xs'>
        {hasReasoning ? text : 'No reasoning provided.'}
      </ReasoningContent>
      <div className='flex justify-end border-t border-amber-200/60 px-3 py-2 dark:border-amber-500/30'>
        <Button
          variant='ghost'
          size='sm'
          onClick={onCopy}
          disabled={!hasReasoning}
          className='h-6 px-2 text-[11px] text-amber-900 hover:text-amber-700 disabled:opacity-50 disabled:hover:text-amber-900 dark:text-amber-100 dark:hover:text-amber-50'
        >
          <Copy className='mr-1 h-3 w-3' />
          Copy reasoning
        </Button>
      </div>
    </Reasoning>
  )
}

const ToolCallSection: React.FC<{
  call: ToolCallDisplay
  onCopy: (payload: ToolCopyPayload) => void
}> = ({ call, onCopy }) => {
  const hasError = !!call.errorText
  const toolState = hasError
    ? 'output-error'
    : call.status === 'result'
      ? 'output-available'
      : call.isStreaming
        ? 'input-streaming'
        : 'input-available'
  const toolType = call.toolName ? `tool-${call.toolName.toLowerCase().replace(/\s+/g, '-')}` : 'tool-call'
  const previewText = call.previewText || buildToolPreview(call)
  const inputValue = call.rawArgs ?? call.argsSummary ?? undefined
  const outputValue = hasError ? undefined : call.rawOutput ?? call.outputSummary ?? call.previewText ?? undefined

  const handleCopyArgs = () => {
    if (!call.argsSummary) return
    onCopy({ value: call.argsSummary, label: 'args', toolName: call.toolName })
  }

  const handleCopyResult = () => {
    if (!call.outputSummary) return
    onCopy({ value: call.outputSummary, label: 'result', toolName: call.toolName })
  }

  const handleCopyError = () => {
    if (!call.errorText) return
    onCopy({ value: call.errorText, label: 'error', toolName: call.toolName })
  }

  return (
    <Tool
      defaultOpen={call.isStreaming || hasError}
      className={cn(
        'mb-3 border shadow-sm',
        hasError
          ? 'border-destructive/40 bg-destructive/10 dark:border-destructive/50 dark:bg-destructive/20'
          : 'border-sky-200/70 bg-sky-50/70 dark:border-sky-500/40 dark:bg-sky-950/40'
      )}
    >
      <ToolHeader state={toolState} type={toolType} title={call.toolName ?? 'Tool Call'} />
      <ToolContent className='pt-0'>
        <div className='flex flex-col gap-2 px-4 pt-4 text-[11px] text-muted-foreground'>
          <div className='flex flex-wrap items-center gap-2'>
            {call.providerExecuted && (
              <Badge variant='outline' className='text-[10px] uppercase tracking-wide'>
                Provider
              </Badge>
            )}
            {previewText && <span className='text-xs text-foreground'>{previewText}</span>}
          </div>
        </div>
        {inputValue !== undefined && <ToolInput input={inputValue} />}
        <ToolOutput errorText={call.errorText ?? undefined} output={outputValue ?? null} />
        <div className='flex flex-wrap justify-end gap-2 border-t border-border/40 px-4 py-2 text-[11px]'>
          {call.argsSummary && (
            <Button variant='ghost' size='sm' onClick={handleCopyArgs} className='h-6 px-2 text-[11px]'>
              <Copy className='mr-1 h-3 w-3' />
              Copy args
            </Button>
          )}
          {call.outputSummary && !hasError && (
            <Button variant='ghost' size='sm' onClick={handleCopyResult} className='h-6 px-2 text-[11px]'>
              <Copy className='mr-1 h-3 w-3' />
              Copy result
            </Button>
          )}
          {hasError && call.errorText && (
            <Button variant='ghost' size='sm' onClick={handleCopyError} className='h-6 px-2 text-[11px]'>
              <Copy className='mr-1 h-3 w-3' />
              Copy error
            </Button>
          )}
        </div>
      </ToolContent>
    </Tool>
  )
}

const StepDivider: React.FC<{ step: number; label?: string | null }> = ({ step, label }) => (
  <div className='flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground/80 dark:text-muted-foreground/70'>
    <div className='h-px flex-1 bg-muted-foreground/30 dark:bg-muted-foreground/20' />
    <span className='shrink-0'>
      Step {step}
      {label ? ` • ${label}` : ''}
    </span>
    <div className='h-px flex-1 bg-muted-foreground/30 dark:bg-muted-foreground/20' />
  </div>
)

// Extract MessageWrapper outside to prevent recreation on every render
const MessageWrapper: React.FC<{
  children: React.ReactNode
  isUser: boolean
  excluded: boolean
  contentClassName?: string
}> = ({ children, isUser, excluded, contentClassName }) => (
  <Message from={isUser ? 'user' : 'assistant'} className={cn('w-full', excluded && 'opacity-60')}>
    <div className='flex-1 max-w-full'>
      <MessageContent
        variant='flat'
        className={cn(
          'w-full space-y-3 rounded-lg border border-border/50 bg-background/80 p-4 text-sm shadow-sm backdrop-blur',
          contentClassName
        )}
      >
        {children}
      </MessageContent>
    </div>
  </Message>
)

// Extract MessageHeader outside to prevent recreation on every render
const MessageHeader: React.FC<{
  isUser: boolean
  msgId: string | number
  excluded: boolean
  rawView: boolean
  popoverOpen: boolean
  onPopoverChange: (open: boolean) => void
  onCopy: () => void
  onFork: () => void
  onDelete: () => void
  onToggleExclude: () => void
  onToggleRaw: () => void
  onReplayStream?: () => void
  onOpenEventsLog?: () => void
}> = ({
  isUser,
  msgId,
  excluded,
  rawView,
  popoverOpen,
  onPopoverChange,
  onCopy,
  onFork,
  onDelete,
  onToggleExclude,
  onToggleRaw,
  onReplayStream,
  onOpenEventsLog
}) => (
  <div className='flex items-center justify-between mb-2'>
    <div className='font-semibold text-sm'>{isUser ? 'You' : 'Assistant'}</div>
    <Popover open={popoverOpen} onOpenChange={onPopoverChange}>
      <PopoverTrigger asChild>
        <Button variant='ghost' size='sm' className='text-xs h-6 px-1.5 opacity-70 hover:opacity-100'>
          Options
        </Button>
      </PopoverTrigger>
      <PopoverContent align='end' side='bottom' className='w-auto p-2'>
        <div className='space-y-2'>
          <div className='flex items-center gap-1'>
            <Button variant='ghost' size='icon' className='h-6 w-6' onClick={onCopy} title='Copy message'>
              <Copy className='h-3 w-3' />
            </Button>
            <Button variant='ghost' size='icon' className='h-6 w-6' onClick={onFork} title='Fork from here'>
              <GitFork className='h-3 w-3' />
            </Button>
            <Button variant='ghost' size='icon' className='h-6 w-6' onClick={onDelete} title='Delete message'>
              <Trash className='h-3 w-3' />
            </Button>
            {onReplayStream && (
              <Button
                variant='ghost'
                size='icon'
                className='h-6 w-6'
                onClick={onReplayStream}
                title='Replay stream'
              >
                <PlayCircle className='h-3 w-3' />
              </Button>
            )}
            {onOpenEventsLog && (
              <Button
                variant='ghost'
                size='icon'
                className='h-6 w-6'
                onClick={onOpenEventsLog}
                title='View stream events'
              >
                <ListTree className='h-3 w-3' />
              </Button>
            )}
          </div>
          <div className='flex items-center justify-between gap-2 border-t pt-2 text-xs text-muted-foreground'>
            <Label htmlFor={`exclude-${msgId}`} className='flex items-center gap-1 cursor-pointer'>
              <Switch
                id={`exclude-${msgId}`}
                checked={excluded}
                onCheckedChange={onToggleExclude}
                className='scale-75'
              />
              Exclude
            </Label>
            <Label htmlFor={`raw-${msgId}`} className='flex items-center gap-1 cursor-pointer'>
              <Switch id={`raw-${msgId}`} checked={rawView} onCheckedChange={onToggleRaw} className='scale-75' />
              Raw
            </Label>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  </div>
)

const ChatMessageItem = React.memo(
  (props: {
    msg: Message
    excluded: boolean
    rawView: boolean
    onCopyMessage: (content: string) => void
    onForkMessage: (messageId: number) => void
    onDeleteMessage: (messageId: number) => void
    onToggleExclude: (messageId: number) => void
    onToggleRawView: (messageId: number) => void
  }) => {
    const { msg, excluded, rawView, onCopyMessage, onForkMessage, onDeleteMessage, onToggleExclude, onToggleRawView } =
      props

    const { copyToClipboard } = useCopyClipboard()
    const [popoverOpen, setPopoverOpen] = useState(false)

    if (!msg.id) {
      console.warn('ChatMessageItem: Message missing ID', msg)
      return null
    }

    const isUser = msg.role === 'user'
    const { hasThinkBlock, isThinking, thinkContent, mainContent } = parseThinkBlock(msg.content ?? '')

    const metadataParts =
      msg && typeof (msg as any).metadata === 'object' && Array.isArray((msg as any).metadata?.parts)
        ? ((msg as any).metadata.parts as Array<Record<string, any>>)
        : null
    const parts = metadataParts
      ? metadataParts
      : Array.isArray((msg as any).parts)
        ? ((msg as any).parts as Array<Record<string, any>>)
        : []
    const reasoningParts = parts.filter((part) => part?.type === 'reasoning' && typeof part?.text === 'string')
    const reasoningTextFromParts = reasoningParts.map((part) => String(part.text)).join('\n').trim()
    const reasoningStreamingFromParts = reasoningParts.some((part) => part?.state === 'streaming')

    const reasoningSource = reasoningParts.length > 0 ? 'parts' : hasThinkBlock ? 'think' : null
    const reasoningText = reasoningSource === 'parts' ? reasoningTextFromParts : reasoningSource === 'think' ? thinkContent : ''
    const reasoningStreaming = reasoningSource === 'parts' ? reasoningStreamingFromParts : reasoningSource === 'think' ? isThinking : false
    let reasoningPreview = reasoningSource === 'parts' ? buildReasoningPreview(reasoningTextFromParts) : reasoningSource === 'think' ? buildReasoningPreview(thinkContent) : ''
    if (!reasoningPreview && reasoningStreaming) {
      reasoningPreview = 'Model is reasoning...'
    }
    const showReasoning = !isUser && reasoningSource !== null

    const { toolCalls, stepMarkers } = useMemo(() => {
      if (isUser || parts.length === 0) {
        return { toolCalls: [] as ToolCallDisplay[], stepMarkers: [] as StepMarker[] }
      }

      type ToolCallAccumulator = ToolCallDisplay & {
        argsChunks: string[]
        outputChunks: string[]
      }

      const map = new Map<string, ToolCallAccumulator>()
      const stepMarkers: StepMarker[] = []
      let currentStep = 0
      let currentStepLabel: string | null = null

      const extractStepLabel = (value: Record<string, unknown>): string | null => {
        const candidates = ['label', 'name', 'title', 'summary', 'description']
        for (const key of candidates) {
          const raw = value[key]
          if (typeof raw === 'string' && raw.trim().length > 0) {
            return raw.trim()
          }
        }
        return null
      }

      const registerStep = (label: string | null, index: number) => {
        currentStep += 1
        currentStepLabel = label ?? null
        const markerId = `${msg.id ?? 'tool'}-step-${currentStep}-${index}`
        stepMarkers.push({ id: markerId, step: currentStep, label: currentStepLabel })
      }

      const ensureEntry = (id: string, index: number, defaults: Partial<ToolCallAccumulator> = {}) => {
        const existing = map.get(id)
        if (existing) {
          if (defaults.stepIndex !== undefined && (existing.stepIndex == null)) {
            existing.stepIndex = defaults.stepIndex
          }
          if (defaults.stepLabel && !existing.stepLabel) {
            existing.stepLabel = defaults.stepLabel
          }
          if (defaults.order !== undefined) {
            existing.order = Math.min(existing.order, defaults.order)
          }
          Object.assign(existing, defaults)
          return existing
        }

        const created: ToolCallAccumulator = {
          id,
          toolName: defaults.toolName,
          argsSummary: defaults.argsSummary ?? null,
          outputSummary: defaults.outputSummary ?? null,
          rawArgs: defaults.rawArgs,
          rawOutput: defaults.rawOutput,
          errorText: defaults.errorText ?? null,
          providerExecuted: defaults.providerExecuted,
          status: defaults.status,
          previewText: defaults.previewText ?? null,
          isStreaming: defaults.isStreaming ?? false,
          stepIndex: defaults.stepIndex ?? (currentStep > 0 ? currentStep : null),
          stepLabel: defaults.stepLabel ?? currentStepLabel,
          order: defaults.order ?? index,
          argsChunks: [],
          outputChunks: []
        }
        map.set(id, created)
        return created
      }

      const recordArgs = (entry: ToolCallAccumulator, value: unknown) => {
        if (value === undefined) return
        if (entry.rawArgs === undefined) {
          entry.rawArgs = value
        }
        if (typeof value === 'string') {
          const pretty = tryPrettyPrintJson(value) ?? value
          if (!entry.argsSummary && pretty) {
            entry.argsSummary = pretty
          }
        } else {
          const formatted = formatDataForDisplay(value)
          if (!entry.argsSummary && formatted) {
            entry.argsSummary = formatted
          }
        }
      }

      const recordOutput = (entry: ToolCallAccumulator, value: unknown, summaryHint?: string) => {
        if (value === undefined) return
        if (entry.rawOutput === undefined) {
          entry.rawOutput = value
        }
        const text = toToolText(value)
        if (!entry.outputSummary && text) {
          entry.outputSummary = text
        }
        if (!entry.outputSummary && summaryHint && summaryHint.trim().length > 0) {
          entry.outputSummary = summaryHint.trim()
        }
      }

      const appendChunk = (entry: ToolCallAccumulator, field: 'args' | 'output', chunk: unknown) => {
        if (chunk === undefined || chunk === null) return
        const text = typeof chunk === 'string' ? chunk : toToolText(chunk)
        if (!text) return
        if (field === 'args') entry.argsChunks.push(text)
        else entry.outputChunks.push(text)
      }

      parts.forEach((part, index) => {
        if (!part || typeof part !== 'object') return
        const partAny = part as Record<string, unknown>
        const rawType = typeof partAny.type === 'string' ? partAny.type.toLowerCase() : ''
        const normalizedType = rawType.replace(/[-.]/g, '_')

        if (normalizedType === 'step_start') {
          registerStep(extractStepLabel(partAny), index)
          return
        }

        const invocationRaw = partAny.toolInvocation
        const invocation =
          invocationRaw && typeof invocationRaw === 'object'
            ? (invocationRaw as Record<string, unknown>)
            : undefined

        const toolNameCandidate = cleanToolName(
          (typeof partAny.toolName === 'string' && partAny.toolName) ||
            (typeof partAny.name === 'string' && partAny.name) ||
            (typeof partAny.toolId === 'string' && partAny.toolId) ||
            (typeof invocation?.toolName === 'string' && (invocation.toolName as string)) ||
            undefined
        )

        const idCandidate =
          partAny.toolCallId ??
          partAny.callId ??
          partAny.invocationId ??
          (invocation?.toolCallId as string | undefined) ??
          (invocation?.id as string | undefined) ??
          `${msg.id ?? 'tool'}-${index}`

        const toolCallId = String(idCandidate)

        const entry = ensureEntry(toolCallId, index, {
          toolName: toolNameCandidate,
          providerExecuted:
            (partAny.providerExecuted as boolean | undefined) ||
            (invocation?.providerExecuted as boolean | undefined) ||
            undefined,
          stepIndex: currentStep > 0 ? currentStep : null,
          stepLabel: currentStepLabel,
          order: index
        })

        if (toolNameCandidate && !entry.toolName) {
          entry.toolName = toolNameCandidate
        }

        if (typeof partAny.providerExecuted === 'boolean') {
          entry.providerExecuted = entry.providerExecuted || (partAny.providerExecuted as boolean)
        }

        if (rawType === 'dynamic-tool') {
          const inferredName = cleanToolName(
            typeof partAny.toolName === 'string' ? partAny.toolName : undefined
          )
          if (inferredName && !entry.toolName) {
            entry.toolName = inferredName
          }

          const state = typeof partAny.state === 'string' ? partAny.state.toLowerCase() : ''
          const streamedArgs = partAny.input
          if (streamedArgs !== undefined) {
            recordArgs(entry, streamedArgs)
            if (state.includes('stream')) {
              appendChunk(entry, 'args', streamedArgs)
            }
          }

          if (partAny.callProviderMetadata != null) {
            entry.providerExecuted = true
          }

          if (state === 'input-streaming' || state === 'input-available') {
            entry.status = entry.status ?? 'pending'
            entry.isStreaming = entry.isStreaming || state === 'input-streaming'
            return
          }

          if (state === 'output-available') {
            if (partAny.output !== undefined) {
              recordOutput(entry, partAny.output)
            }
            if (partAny.errorText) {
              entry.errorText = toToolText(partAny.errorText)
              entry.status = 'error'
              entry.isStreaming = false
              return
            }
            entry.status = 'result'
            entry.isStreaming = entry.isStreaming || (partAny.preliminary as boolean | undefined) === true
            return
          }

          if (state === 'output-error') {
            const errorSource =
              partAny.errorText ?? partAny.error ?? partAny.message ?? partAny.output ?? partAny.result
            entry.errorText = toToolText(errorSource)
            entry.status = 'error'
            entry.isStreaming = false
            return
          }

          return
        }

        if (normalizedType.startsWith('tool_input')) {
          appendChunk(entry, 'args', partAny.inputTextDelta ?? partAny.delta ?? partAny.text ?? partAny.value)
          if (partAny.input !== undefined) {
            recordArgs(entry, partAny.input)
          }
          if (partAny.args !== undefined || partAny.arguments !== undefined) {
            recordArgs(entry, partAny.args ?? partAny.arguments)
          }
          entry.status = entry.status ?? 'pending'
          entry.isStreaming = entry.isStreaming || normalizedType.includes('delta') || normalizedType.includes('start')
          return
        }

        if (rawType === 'tool-call' || rawType === 'toolcall') {
          if (partAny.input !== undefined) recordArgs(entry, partAny.input)
          if (partAny.args !== undefined || partAny.arguments !== undefined) {
            recordArgs(entry, partAny.args ?? partAny.arguments)
          }
          entry.status = entry.status ?? 'pending'
          return
        }

        if (normalizedType === 'tool' || normalizedType === 'tool_invocation') {
          if (invocation?.args !== undefined || invocation?.arguments !== undefined || invocation?.input !== undefined) {
            recordArgs(entry, invocation?.args ?? invocation?.arguments ?? invocation?.input)
          }
          if (invocation?.result !== undefined || invocation?.output !== undefined) {
            recordOutput(entry, invocation?.result ?? invocation?.output)
          }
          const state = typeof invocation?.state === 'string' ? invocation.state.toLowerCase() : ''
          if (state === 'result') {
            entry.status = 'result'
          } else {
            entry.status = entry.status ?? 'pending'
          }
          return
        }

        if (normalizedType.includes('tool_output') || normalizedType === 'tool_result') {
          const summaryHint = typeof partAny.outputText === 'string' ? partAny.outputText : undefined
          if (partAny.output !== undefined) recordOutput(entry, partAny.output, summaryHint)
          if (partAny.result !== undefined) recordOutput(entry, partAny.result)
          if (partAny.response !== undefined) recordOutput(entry, partAny.response)
          if (partAny.content !== undefined) recordOutput(entry, partAny.content)
          appendChunk(entry, 'output', partAny.outputText ?? partAny.delta ?? partAny.text)
          entry.status = entry.errorText ? 'error' : 'result'
          entry.isStreaming = entry.isStreaming || normalizedType.includes('delta')
          return
        }

        if (normalizedType.includes('error')) {
          const errorSource =
            partAny.error ??
            partAny.errorText ??
            partAny.message ??
            partAny.output ??
            partAny.result ??
            (invocation?.error as unknown)
          const errorText = toToolText(errorSource)
          if (errorText) {
            entry.errorText = errorText
          }
          entry.status = 'error'
          entry.isStreaming = false
        }
      })

      const finalized = Array.from(map.values())
        .filter((entry) => entry.argsSummary || entry.outputSummary || entry.errorText)
        .map((entry) => {
          if (!entry.argsSummary && entry.argsChunks.length > 0) {
            const combined = entry.argsChunks.join('')
            const pretty = tryPrettyPrintJson(combined) ?? combined.trim()
            if (pretty) {
              entry.argsSummary = pretty
              if (entry.rawArgs === undefined) {
                entry.rawArgs = combined
              }
            }
          }

          if (!entry.outputSummary && entry.outputChunks.length > 0) {
            const combinedOutput = entry.outputChunks.join('')
            const trimmed = combinedOutput.trim()
            if (trimmed) {
              entry.outputSummary = trimmed
              if (entry.rawOutput === undefined) {
                entry.rawOutput = combinedOutput
              }
            }
          }

          entry.previewText = entry.previewText ?? buildToolPreview(entry)
          if (!entry.status) {
            entry.status = entry.errorText ? 'error' : entry.outputSummary ? 'result' : 'pending'
          }
          entry.isStreaming = entry.isStreaming ?? false

          const { argsChunks, outputChunks, ...rest } = entry
          return {
            ...rest,
            stepIndex: rest.stepIndex ?? null,
            stepLabel: rest.stepLabel ?? null,
            order: rest.order
          }
        })

      finalized.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

      return { toolCalls: finalized, stepMarkers }
    }, [isUser, parts, msg.id])

    const messageId = useMemo(() => {
      const id = Number(msg.id)
      return isNaN(id) ? null : id
    }, [msg.id])

    const metadata =
      (msg as any)?.metadata && typeof (msg as any).metadata === 'object'
        ? ((msg as any).metadata as Record<string, any>)
        : undefined
    const replayUrl = typeof metadata?.replayUrl === 'string' ? metadata.replayUrl : undefined
    const eventsUrl = typeof metadata?.eventsUrl === 'string' ? metadata.eventsUrl : undefined

    const handleCopy = useCallback(
      () => onCopyMessage(mainContent || msg.content || ''),
      [mainContent, msg.content, onCopyMessage]
    )
    const handleFork = useCallback(() => {
      if (messageId === null) {
        console.warn('Cannot fork: Invalid message ID', msg.id)
        toast.error('Cannot fork: Invalid message ID')
        return
      }
      onForkMessage(messageId)
    }, [messageId, onForkMessage, msg.id])
    const handleDelete = useCallback(() => {
      if (messageId === null) {
        console.warn('Cannot delete: Invalid message ID', msg.id)
        toast.error('Cannot delete: Invalid message ID')
        return
      }
      onDeleteMessage(messageId)
    }, [messageId, onDeleteMessage, msg.id])
    const handleToggleExclude = useCallback(() => {
      if (messageId === null) {
        console.warn('Cannot toggle exclude: Invalid message ID', msg.id)
        return
      }
      onToggleExclude(messageId)
    }, [messageId, onToggleExclude, msg.id])
    const handleToggleRaw = useCallback(() => {
      if (messageId === null) {
        console.warn('Cannot toggle raw view: Invalid message ID', msg.id)
        return
      }
      onToggleRawView(messageId)
    }, [messageId, onToggleRawView, msg.id])
    const handleCopyReasoning = useCallback(() => {
      if (!reasoningText) return
      copyToClipboard(reasoningText, { successMessage: 'Reasoning copied!' })
    }, [copyToClipboard, reasoningText])

    const handleReplayStream = useCallback(() => {
      if (!replayUrl) return
      if (typeof window !== 'undefined') {
        window.open(replayUrl, '_blank', 'noopener,noreferrer')
      }
    }, [replayUrl])

    const handleOpenEventsLog = useCallback(() => {
      if (!eventsUrl) return
      if (typeof window !== 'undefined') {
        window.open(eventsUrl, '_blank', 'noopener,noreferrer')
      }
    }, [eventsUrl])

    const handleCopyToolValue = useCallback(
      ({ value, label, toolName }: ToolCopyPayload) => {
        if (!value) return
        const base = label === 'args' ? 'Tool arguments' : label === 'result' ? 'Tool result' : 'Tool error'
        const suffix = toolName ? ` (${toolName})` : ''
        copyToClipboard(value, { successMessage: `${base} copied${suffix}` })
      },
      [copyToClipboard]
    )

    if (rawView) {
      return (
        <MessageWrapper isUser={isUser} excluded={excluded}>
          <MessageHeader
            isUser={isUser}
            msgId={msg.id}
            excluded={excluded}
            rawView={rawView}
            popoverOpen={popoverOpen}
            onPopoverChange={setPopoverOpen}
            onCopy={handleCopy}
            onFork={handleFork}
            onDelete={handleDelete}
            onToggleExclude={handleToggleExclude}
            onToggleRaw={handleToggleRaw}
            onReplayStream={replayUrl ? handleReplayStream : undefined}
            onOpenEventsLog={eventsUrl ? handleOpenEventsLog : undefined}
          />
          <pre className='whitespace-pre-wrap font-mono p-2 bg-background/50 rounded text-xs sm:text-sm overflow-x-auto'>
            {msg.content}
          </pre>
        </MessageWrapper>
      )
    }

    const effectiveContent = (hasThinkBlock ? mainContent : msg.content) ?? ''

    const messageBlocks = useMemo<MessageBlock[]>(() => {
      const blocks: MessageBlock[] = []

      if (showReasoning) {
        blocks.push({
          type: 'reasoning',
          id: `${msg.id}-reasoning`,
          data: { text: reasoningText, preview: reasoningPreview, streaming: reasoningStreaming }
        })
      }

      if (!isUser) {
        const stepLabelMap = new Map(stepMarkers.map((marker) => [marker.step, marker.label]))
        let lastStep: number | null = null

        toolCalls.forEach((call) => {
          const stepIndex = call.stepIndex ?? null
          if (stepIndex && stepIndex > 0 && stepIndex !== lastStep) {
            const label = stepLabelMap.get(stepIndex) ?? call.stepLabel ?? null
            blocks.push({ type: 'step', id: `${msg.id}-step-${stepIndex}-${call.id}`, step: stepIndex, label })
            lastStep = stepIndex
          }

          blocks.push({ type: 'tool', id: `${msg.id}-tool-${call.id}`, call })
        })

        if (toolCalls.length === 0 && stepMarkers.length > 0) {
          stepMarkers.forEach((marker) => {
            blocks.push({ type: 'step', id: `${msg.id}-step-${marker.step}`, step: marker.step, label: marker.label })
          })
        }
      }

      blocks.push({ type: 'content', id: `${msg.id}-content`, content: effectiveContent })

      return blocks
    }, [
      effectiveContent,
      isUser,
      msg.id,
      reasoningPreview,
      reasoningStreaming,
      reasoningText,
      showReasoning,
      toolCalls,
      stepMarkers
    ])

    return (
      <MessageWrapper isUser={isUser} excluded={excluded}>
        <MessageHeader
          isUser={isUser}
          msgId={msg.id}
          excluded={excluded}
          rawView={rawView}
          popoverOpen={popoverOpen}
          onPopoverChange={setPopoverOpen}
          onCopy={handleCopy}
          onFork={handleFork}
          onDelete={handleDelete}
          onToggleExclude={handleToggleExclude}
          onToggleRaw={handleToggleRaw}
          onReplayStream={replayUrl ? handleReplayStream : undefined}
          onOpenEventsLog={eventsUrl ? handleOpenEventsLog : undefined}
        />
        <div className='space-y-3 text-sm'>
          {messageBlocks.map((block) => {
            if (block.type === 'reasoning') {
              return (
                <ReasoningSection
                  key={block.id}
                  text={block.data.text}
                  preview={block.data.preview}
                  isStreaming={block.data.streaming}
                  onCopy={handleCopyReasoning}
                />
              )
            }

            if (block.type === 'step') {
              return <StepDivider key={block.id} step={block.step} label={block.label} />
            }

            if (block.type === 'tool') {
              return <ToolCallSection key={block.id} call={block.call} onCopy={handleCopyToolValue} />
            }

            return (
              <div key={block.id} className='overflow-x-auto'>
                <Response>{block.content}</Response>
              </div>
            )
          })}
        </div>
      </MessageWrapper>
    )
  }
)
ChatMessageItem.displayName = 'ChatMessageItem'

interface ChatMessagesProps {
  chatId: number | null
  messages: Message[]
  isLoading: boolean
  excludedMessageIds?: number[]
  onToggleExclude: (messageId: number) => void
}

export function ChatMessages({
  chatId,
  messages,
  isLoading,
  excludedMessageIds = [],
  onToggleExclude
}: ChatMessagesProps) {
  const { copyToClipboard } = useCopyClipboard()
  const excludedSet = useMemo(() => new Set<number>(excludedMessageIds), [excludedMessageIds])
  const deleteMessageMutation = useDeleteMessage()
  const forkChatMutation = useForkChatFromMessage()
  const [rawMessageIds, setRawMessageIds] = useState<Set<number>>(new Set())

  const handleCopyMessage = useCallback(
    (content: string) => {
      copyToClipboard(content)
      toast.success('Message copied!')
    },
    [copyToClipboard]
  )

  const handleForkFromMessage = useCallback(
    async (messageId: number) => {
      if (!chatId) {
        toast.error('Cannot fork: Chat ID not available.')
        return
      }
      try {
        await forkChatMutation.mutateAsync({
          chatId,
          messageId,
          excludedMessageIds: Array.from(excludedSet)
        })
        toast.success('Chat forked successfully')
      } catch (error) {
        console.error('Error forking chat:', error)
        toast.error('Failed to fork chat')
      }
    },
    [chatId, forkChatMutation, excludedSet]
  )

  const handleDeleteMessage = useCallback(
    async (messageId: number) => {
      if (!window.confirm('Are you sure you want to delete this message?')) return
      try {
        await deleteMessageMutation.mutateAsync({ chatId: chatId ?? -1, messageId })
        toast.success('Message deleted successfully')
      } catch (error) {
        console.error('Error deleting message:', error)
        toast.error('Failed to delete message')
      }
    },
    [deleteMessageMutation]
  )

  const handleToggleRawView = useCallback((messageId: number) => {
    setRawMessageIds((prev) => {
      const newSet = new Set<number>(prev)
      if (newSet.has(messageId)) newSet.delete(messageId)
      else newSet.add(messageId)
      return newSet
    })
  }, [])

  const handleToggleExclude = useCallback(
    (messageId: number) => {
      onToggleExclude(messageId)
    },
    [onToggleExclude]
  )

  if (!chatId && !isLoading) {
    return (
      <div className='flex-1 flex items-center justify-center p-4'>
        <Card className='p-6 max-w-md text-center'>
          <MessageSquareIcon className='mx-auto h-12 w-12 text-muted-foreground mb-4' />
          <h3 className='text-lg font-semibold mb-2'>No Chat Selected</h3>
          <p className='text-muted-foreground text-sm'>
            Select a chat from the sidebar or create a new one to start messaging.
          </p>
        </Card>
  </div>
)
}

  let conversationBody: React.ReactNode

  if (isLoading && messages.length === 0) {
    conversationBody = (
      <div className='flex items-center justify-center py-6 text-sm text-muted-foreground'>
        Loading messages...
      </div>
    )
  } else if (!isLoading && messages.length === 0) {
    conversationBody = (
      <ConversationEmptyState
        className='border border-dashed border-muted/60 bg-background/60'
        description='Start the conversation by typing your message below.'
        icon={<MessageSquareIcon className='h-10 w-10 text-muted-foreground' />}
        title='No messages yet'
      />
    )
  } else {
    conversationBody = messages.map((msg) => (
      <ChatMessageItem
        key={msg.id || `temp-${Math.random()}`}
        msg={msg}
        excluded={excludedSet.has(Number(msg.id))}
        rawView={rawMessageIds.has(Number(msg.id))}
        onCopyMessage={handleCopyMessage}
        onForkMessage={handleForkFromMessage}
        onDeleteMessage={handleDeleteMessage}
        onToggleExclude={handleToggleExclude}
        onToggleRawView={handleToggleRawView}
      />
    ))
  }

  return (
    <Conversation className='flex h-full w-full flex-1 overflow-hidden rounded-lg border border-border/60 bg-background/40 backdrop-blur'>
      <ConversationContent className='mx-auto flex w-full max-w-[72rem] flex-col gap-4 px-4 py-4'>
        {conversationBody}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  )
}

export function ChatSidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const activeChatId = search.chatId ?? null
  const [activeProjectTabState] = useActiveProjectTab()
  const [editingChatId, setEditingChatId] = useState<number | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [visibleCount, setVisibleCount] = useState(50)

  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const activeChatRef = useRef<HTMLDivElement>(null)

  const { data: chatsData, isLoading: isLoadingChats } = useGetChats()
  const deleteChatMutation = useDeleteChat()
  const updateChatMutation = useUpdateChat()
  const createChatMutation = useCreateChat()

  const sortedChats = useMemo(() => {
    const chats: Chat[] = chatsData ?? []
    return [...chats].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [chatsData])

  const visibleChats = useMemo(() => sortedChats.slice(0, visibleCount), [sortedChats, visibleCount])

  const handleCreateNewChat = useCallback(async () => {
    const defaultTitle = `New Chat ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    try {
      const newChat = await createChatMutation.mutateAsync({ title: defaultTitle })
      const newChatId = newChat?.id
      if (newChatId) {
        navigate({
          to: '/chat',
          search: { ...search, chatId: newChatId },
          replace: true
        })
        toast.success('New chat created')
        setEditingTitle('')
        setEditingChatId(null)
        onClose()
      } else {
        throw new Error('Created chat did not return an ID.')
      }
    } catch (error) {
      console.error('Error creating chat:', error)
      toast.error('Failed to create chat')
    }
  }, [createChatMutation, navigate, search, onClose])

  const handleDeleteChat = useCallback(
    async (chatId: number, e: React.MouseEvent) => {
      e.stopPropagation()
      if (!window.confirm('Are you sure you want to delete this chat?')) return
      try {
        await deleteChatMutation.mutateAsync(chatId)
        toast.success('Chat deleted')
        if (activeChatId === chatId) {
          // Clear chatId from URL when deleting the active chat
          navigate({
            to: '/chat',
            search: { ...search, chatId: undefined },
            replace: true
          })
        }
        if (editingChatId === chatId) {
          setEditingChatId(null)
          setEditingTitle('')
        }
      } catch (error) {
        console.error('Error deleting chat:', error)
        toast.error('Failed to delete chat')
      }
    },
    [deleteChatMutation, activeChatId, navigate, search, editingChatId]
  )

  const startEditingChat = useCallback((chat: Chat, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingChatId(chat.id)
    setEditingTitle(chat.title ?? '')
  }, [])

  const handleUpdateChat = useCallback(
    async (chatId: number) => {
      if (!editingTitle.trim()) {
        toast.error('Chat title cannot be empty.')
        return
      }
      try {
        // TODO: Fix mutation call when hook is properly typed
        // await updateChatMutation.mutateAsync({ chatId, title: editingTitle })
        console.log('Chat update not implemented yet')
        toast.success('Chat title updated')
        setEditingChatId(null)
      } catch (error) {
        console.error('Error updating chat:', error)
        toast.error('Failed to update chat title')
      }
    },
    [updateChatMutation, editingTitle]
  )

  const cancelEditing = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation()
    setEditingChatId(null)
    setEditingTitle('')
  }, [])

  const handleSelectChat = useCallback(
    (chatId: number) => {
      if (!editingChatId) {
        // Navigate to chat with URL search param as single source of truth
        navigate({ to: '/chat', search: { ...search, chatId }, replace: true })
        onClose()
      }
    },
    [navigate, search, editingChatId, onClose]
  )

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector(':scope > div[style*="overflow: scroll"]')
    if (activeChatRef.current && viewport && viewport.contains(activeChatRef.current)) {
      activeChatRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      })
    }
  }, [activeChatId, visibleChats])

  const handleKeyDownEdit = (e: React.KeyboardEvent<HTMLInputElement>, chatId: number) => {
    if (e.key === 'Enter') {
      handleUpdateChat(chatId)
    } else if (e.key === 'Escape') {
      cancelEditing()
    }
  }

  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) => prev + 50)
  }, [])

  return (
    <SlidingSidebar width={300} side='left' isOpen={isOpen} onClose={onClose}>
      {/* Sidebar content  */}
      <div className='p-2 border-b mb-2 flex flex-col gap-2'>
        <Button variant='outline' className='w-full justify-start gap-2' onClick={handleCreateNewChat}>
          <PlusIcon className='h-4 w-4' /> New Chat
        </Button>
        <div className='text-xs text-muted-foreground px-1'>Chat History ({sortedChats.length})</div>
      </div>

      <ScrollArea className='flex-1' ref={scrollAreaRef}>
        <div className='px-2 pb-2'>
          {isLoadingChats ? (
            <div className='p-4 text-center text-sm text-muted-foreground'>Loading chats...</div>
          ) : visibleChats.length === 0 ? (
            <div className='p-4 text-center text-sm text-muted-foreground'>No chats yet.</div>
          ) : (
            visibleChats.map((chat) => {
              const isActive = activeChatId === chat.id
              const isEditing = editingChatId === chat.id

              return (
                <div
                  key={chat.id}
                  ref={isActive ? activeChatRef : null}
                  onClick={() => handleSelectChat(chat.id)}
                  className={cn(
                    'flex items-center p-2 rounded-md group text-sm relative cursor-pointer',
                    'hover:bg-muted dark:hover:bg-muted/50',
                    isActive && 'bg-muted dark:bg-muted/50',
                    isEditing && 'bg-transparent hover:bg-transparent'
                  )}
                >
                  {isEditing ? (
                    <div className='flex items-center gap-1 flex-1'>
                      <Input
                        autoFocus
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        className='h-7 text-sm flex-1'
                        onKeyDown={(e) => handleKeyDownEdit(e, chat.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Button size='icon' variant='ghost' className='h-6 w-6' onClick={() => handleUpdateChat(chat.id)}>
                        <Check className='h-4 w-4' />
                      </Button>
                      <Button size='icon' variant='ghost' className='h-6 w-6' onClick={cancelEditing}>
                        <X className='h-4 w-4' />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span
                        className={cn('flex-1 truncate pr-16', isActive ? 'font-medium' : '')}
                        title={chat.title ?? 'Untitled Chat'}
                      >
                        {chat.title || <span className='italic text-muted-foreground'>Untitled Chat</span>}
                      </span>
                      <div className='absolute right-1 top-1/2 transform -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity'>
                        <Button
                          size='icon'
                          variant='ghost'
                          className='h-6 w-6'
                          onClick={(e) => startEditingChat(chat, e)}
                          title='Rename'
                        >
                          <Edit2 className='h-4 w-4' />
                        </Button>
                        <Button
                          size='icon'
                          variant='ghost'
                          className='h-6 w-6 text-destructive/80 hover:text-destructive'
                          onClick={(e) => handleDeleteChat(chat.id, e)}
                          title='Delete'
                        >
                          <Trash2 className='h-4 w-4' />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )
            })
          )}
          {sortedChats.length > visibleCount && (
            <div className='p-2 mt-2 text-center'>
              <Button variant='outline' size='sm' onClick={handleLoadMore}>
                Show More ({sortedChats.length - visibleCount} remaining)
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </SlidingSidebar>
  )
}

export function ChatHeader({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const activeChatId = search.chatId ?? null
  const { data: chatsData } = useGetChats()
  const {
    settings: modelSettings,
    setTemperature,
    setMaxTokens,
    setTopP,
    setFreqPenalty,
    setPresPenalty,
    setPreset,
    selectedPreset
  } = useChatModelParams()
  const { defaultPreset } = useModelConfigPresets()

  const activeChat = useMemo(() => chatsData?.find((c: Chat) => c.id === activeChatId), [chatsData, activeChatId])

  return (
    <div className='flex items-center justify-between gap-x-4 bg-background px-4 py-2 border-b h-14 w-full max-w-7xl xl:rounded-b xl:border-x'>
      {/* Left: Sidebar Toggle Button */}
      <div className='flex-shrink-0'>
        <Button
          variant='outline'
          size='icon'
          onClick={onToggleSidebar}
          className='h-8 w-8'
          aria-label='Toggle chat sidebar'
        >
          <MessageSquareText className='h-4 w-4' />
        </Button>
      </div>

      {/* Middle: Chat Title (takes up remaining space, centered text, truncated) */}
      <div className='flex-1 min-w-0 text-center'>
        {activeChatId ? (
          <span className='font-semibold text-lg truncate block' title={activeChat?.title || 'Loading...'}>
            {activeChat?.title || 'Loading Chat...'}
          </span>
        ) : (
          <span className='font-semibold text-lg text-muted-foreground'>No Chat Selected</span>
        )}
      </div>

      {/* Right: Model Settings and Config Switcher */}
      <div className='flex-shrink-0 flex items-center gap-1'>
        {activeChatId && (
          <>
            <PresetSelector
              value={selectedPreset || defaultPreset}
              onChange={(preset) => {
                // Apply all preset settings from backend
                setPreset(preset)
              }}
              className='w-40'
              compact
            />
            <ModelSettingsPopover />
          </>
        )}
      </div>
    </div>
  )
}

export const Route = createFileRoute('/chat')({
  validateSearch: zodValidator(chatSearchSchema),
  component: ChatPage
})

function ChatPage() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Use URL search param as single source of truth for active chat ID
  const activeChatId = search.chatId ?? null
  const { settings: modelSettings, setModel } = useChatModelParams()
  const provider = modelSettings.provider ?? 'openrouter'
  const model = modelSettings.model
  const [appSettings] = useAppSettings()
  const providerOverrides = useMemo(() => {
    if (provider === 'ollama' && appSettings.ollamaGlobalUrl) {
      return { ollamaUrl: appSettings.ollamaGlobalUrl }
    }

    if (provider === 'lmstudio' && appSettings.lmStudioGlobalUrl) {
      return { lmstudioUrl: appSettings.lmStudioGlobalUrl }
    }

    return undefined
  }, [appSettings.lmStudioGlobalUrl, appSettings.ollamaGlobalUrl, provider])

  const { data: modelsData } = useGetModels(provider as APIProviders, providerOverrides)
  const { presets } = useModelConfigPresets()
  const enableChatAutoNaming = appSettings?.enableChatAutoNaming ?? true
  const normalizedLmStudioUrl = appSettings?.lmStudioGlobalUrl?.replace(/\/$/, '')
  const hasCustomLmStudioUrl =
    provider === 'lmstudio' && normalizedLmStudioUrl && normalizedLmStudioUrl !== DEFAULT_LMSTUDIO_URL
  const lmStudioBadgeLabel = hasCustomLmStudioUrl
    ? (appSettings?.lmStudioGlobalUrl ?? '').replace(/^https?:\/\//, '') || appSettings?.lmStudioGlobalUrl
    : null
  const { copyToClipboard } = useCopyClipboard()
  const [excludedMessageIds, setExcludedMessageIds] = useState<number[]>([])

  const [initialChatContent, setInitialChatContent] = useLocalStorage<string | null>('initial-chat-content', null)
  const [systemPromptOverrides, setSystemPromptOverrides] = useLocalStorage<Record<string, string>>(
    SYSTEM_PROMPT_STORAGE_KEY,
    {}
  )
  const [systemPromptDraft, setSystemPromptDraft] = useState(DEFAULT_SYSTEM_PROMPT)
  const [isSystemPromptDialogOpen, setSystemPromptDialogOpen] = useState(false)
  const [systemPromptEditValue, setSystemPromptEditValue] = useState(DEFAULT_SYSTEM_PROMPT)
  const [isInputCollapsed, setInputCollapsed] = useState(false)

  useEffect(() => {
    if (!activeChatId) {
      setSystemPromptDraft(DEFAULT_SYSTEM_PROMPT)
      if (!isSystemPromptDialogOpen) {
        setSystemPromptEditValue(DEFAULT_SYSTEM_PROMPT)
      }
      return
    }
    const key = String(activeChatId)
    const stored = systemPromptOverrides?.[key]
    const nextValue = stored ?? DEFAULT_SYSTEM_PROMPT
    setSystemPromptDraft((prev) => (prev === nextValue ? prev : nextValue))
    if (!isSystemPromptDialogOpen) {
      setSystemPromptEditValue(nextValue)
    }
  }, [activeChatId, isSystemPromptDialogOpen, systemPromptOverrides])

  useEffect(() => {
    if (isInputCollapsed) {
      setSystemPromptDialogOpen(false)
    }
  }, [isInputCollapsed])

  const systemPrompt = activeChatId ? systemPromptDraft : DEFAULT_SYSTEM_PROMPT

  const lastDraftValueRef = useRef<string>('')
  const saveInputDraft = useDebounceCallback((value: string) => {
    const draft = value ?? ''
    if (lastDraftValueRef.current === draft) return

    lastDraftValueRef.current = draft
    try {
      localStorage.setItem(CHAT_INPUT_STORAGE_KEY, JSON.stringify(draft))
    } catch (error) {
      console.warn('Failed to persist chat draft to localStorage', error)
    }
  }, 500)

  // Get chats data for the grid view
  const { data: chatsData, isLoading: isLoadingChats } = useGetChats()
  const deleteChat = useDeleteChat()
  const updateChat = useUpdateChat()
  const createChat = useCreateChat()

  // Filter and sort chats
  const filteredAndSortedChats = useMemo(() => {
    if (!chatsData) return []

    let filtered = chatsData
    if (searchTerm.trim()) {
      filtered = chatsData.filter((chat) => (chat.title || '').toLowerCase().includes(searchTerm.toLowerCase()))
    }

    return filtered.sort((a, b) => b.updatedAt - a.updatedAt)
  }, [chatsData, searchTerm])

  useEffect(() => {
    if (activeChatId && !model && Array.isArray(modelsData) && modelsData[0]) {
      const newModelSelection = modelsData[0].id
      console.info('NO MODEL SET, SETTING DEFAULT MODEL', newModelSelection)
      setModel(newModelSelection)
    }
  }, [activeChatId, model, modelsData, setModel])

  const {
    messages,
    input,
    isLoading: isAiLoading,
    error,
    parsedError,
    clearError,
    setInput,
    sendMessage,
    reload
  } = useAIChat({
    // ai sdk uses strings for chatId
    chatId: activeChatId ?? -1,
    provider,
    model: model ?? '',
    systemMessage: systemPrompt,
    enableChatAutoNaming: !!enableChatAutoNaming
  })

  const isSystemPromptCustomized = useMemo(() => {
    if (!activeChatId) return false
    const key = String(activeChatId)
    return systemPromptOverrides[key] !== undefined
  }, [activeChatId, systemPromptOverrides])

  const selectedModelName = useMemo(() => {
    return Array.isArray(modelsData)
      ? (modelsData.find((m: { id: string; name: string }) => m.id === model)?.name ?? model ?? '...')
      : (model ?? '...')
  }, [modelsData, model])

  // Detect if current provider+model matches a known preset
  const matchedPreset = useMemo(() => {
    if (!presets || !provider || !model) return null as null | { key: string }
    for (const [key, cfg] of Object.entries(presets)) {
      if (cfg && cfg.provider === provider && cfg.model === model) {
        return { key }
      }
    }
    return null
  }, [presets, provider, model])

  const handleSystemPromptChange = useCallback(
    (value: string) => {
      setSystemPromptDraft(value)
      if (!activeChatId) return
      const key = String(activeChatId)
      setSystemPromptOverrides((prev) => {
        const trimmedValue = value.trim()
        const trimmedDefault = DEFAULT_SYSTEM_PROMPT.trim()
        if (trimmedValue === trimmedDefault) {
          if (prev[key] === undefined) return prev
          const next = { ...prev }
          delete next[key]
          return next
        }
        if (prev[key] === value) return prev
        return { ...prev, [key]: value }
      })
    },
    [activeChatId, setSystemPromptOverrides]
  )

  const handleOpenSystemPromptDialog = useCallback(() => {
    setSystemPromptEditValue(systemPromptDraft)
    setSystemPromptDialogOpen(true)
  }, [systemPromptDraft])

  const handleSystemPromptDialogOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setSystemPromptEditValue(systemPromptDraft)
      }
      setSystemPromptDialogOpen(open)
    },
    [systemPromptDraft]
  )

  const handleSystemPromptEditValueChange = useCallback((value: string) => {
    setSystemPromptEditValue(value)
  }, [])

  const handleSystemPromptResetDraft = useCallback(() => {
    setSystemPromptEditValue(DEFAULT_SYSTEM_PROMPT)
  }, [])

  const handleSystemPromptSave = useCallback(() => {
    handleSystemPromptChange(systemPromptEditValue)
    setSystemPromptDialogOpen(false)
  }, [handleSystemPromptChange, systemPromptEditValue])

  const handleToggleComposer = useCallback(() => {
    setInputCollapsed((prev) => !prev)
  }, [])

  const handleToggleExclude = useCallback((messageId: number) => {
    setExcludedMessageIds((prev) =>
      prev.includes(messageId) ? prev.filter((id) => id !== messageId) : [...prev, messageId]
    )
  }, [])

  const handleChatInputChange = useCallback(
    (value: string) => {
      setInput(value)
      saveInputDraft(value)
    },
    [setInput, saveInputDraft]
  )

  const handlePromptSubmit = useCallback(
    (message: PromptInputMessage) => {
      const text = message.text ?? ''
      if (!text.trim() || isAiLoading || !activeChatId) {
        return
      }

      clearError()

      void sendMessage(text, { ...modelSettings }).catch((err) => {
        console.error('Error sending message:', err)
      })
    },
    [activeChatId, clearError, isAiLoading, modelSettings, sendMessage]
  )

  const didRestoreDraftRef = useRef(false)

  useEffect(() => {
    if (didRestoreDraftRef.current) return
    didRestoreDraftRef.current = true

    try {
      const stored = localStorage.getItem(CHAT_INPUT_STORAGE_KEY)
      if (!stored) return
      const parsed = JSON.parse(stored)
      if (typeof parsed !== 'string') return
      if (!input || input.length === 0) {
        setInput(parsed)
        lastDraftValueRef.current = parsed
      }
    } catch (error) {
      console.warn('Failed to restore chat input draft', error)
    }
  }, [input, setInput])

  useEffect(() => {
    saveInputDraft(input ?? '')
  }, [input, saveInputDraft])

  const hasActiveChat = !!activeChatId

  const toggleSidebar = useCallback(() => setIsSidebarOpen((prev) => !prev), [])

  // Chat actions
  const handleCreateNewChat = useCallback(async () => {
    const defaultTitle = `New Chat ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    try {
      const newChat = await createChat.mutateAsync({ title: defaultTitle })
      const newChatId = newChat?.id
      if (newChatId) {
        navigate({
          to: '/chat',
          search: { ...search, chatId: newChatId },
          replace: true
        })
        toast.success('New chat created')
      }
    } catch (error) {
      console.error('Error creating chat:', error)
      toast.error('Failed to create chat')
    }
  }, [createChat, navigate, search])

  const handleDeleteChat = useCallback(
    async (chatId: number) => {
      if (!window.confirm('Are you sure you want to delete this chat?')) return
      try {
        await deleteChat.mutateAsync(chatId)
        toast.success('Chat deleted')
        if (activeChatId === chatId) {
          navigate({
            to: '/chat',
            search: { ...search, chatId: undefined },
            replace: true
          })
        }
      } catch (error) {
        console.error('Error deleting chat:', error)
        toast.error('Failed to delete chat')
      }
    },
    [deleteChat, activeChatId, navigate, search]
  )

  useEffect(() => {
    if (
      activeChatId &&
      initialChatContent &&
      setInput &&
      (input === '' || input === null) &&
      messages.length === 0 &&
      !isAiLoading
    ) {
      setInput(initialChatContent)
      toast.success('Context loaded into input.')
      setInitialChatContent(null) // Clear from localStorage after setting input
    }
  }, [activeChatId, initialChatContent, messages.length, isAiLoading]) // Remove circular dependencies

  // Cleanup effect to ensure ref is reset if chat changes or content is cleared
  useEffect(() => {
    if (!activeChatId || !initialChatContent) {
      // If chat ID changes or there's no initial content, ensure we're ready for a new load
    }
  }, [activeChatId, initialChatContent])

  return (
    <div className='flex flex-col md:flex-row overflow-hidden h-full'>
      <ChatSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className='flex-1 flex flex-col min-w-0 h-full items-center w-full'>
        {!isInputCollapsed && <ChatHeader onToggleSidebar={toggleSidebar} />}

        {hasActiveChat && model ? (
          <>
            <div className='flex-1 w-full min-h-0 px-4 pb-4 flex'>
              <ChatMessages
                chatId={activeChatId}
                messages={messages ?? []}
                isLoading={isAiLoading}
                excludedMessageIds={excludedMessageIds}
                onToggleExclude={handleToggleExclude}
              />
            </div>

            {!isInputCollapsed ? (
              <div className='border-t border-l border-r bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-[env(safe-area-inset-bottom)] max-w-[80rem] rounded-t-lg shadow-md w-full'>
                <div className='mx-auto w-full max-w-[72rem] px-4 pt-2 pb-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground'>
                  <div className='flex items-center gap-2'>
                    <span>Using: {provider} /</span>
                    <span className='inline-flex items-center gap-2 group'>
                      <span>{selectedModelName}</span>
                      {matchedPreset && (
                        <Badge variant='outline' className='ml-1'>
                          Preset: {matchedPreset.key}
                        </Badge>
                      )}
                      {model && (
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon'
                          className={cn(
                            'h-4 w-4 text-muted-foreground hover:text-foreground transition-opacity',
                            'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto',
                            'focus-visible:opacity-100 focus-visible:pointer-events-auto'
                          )}
                          title={`Copy model ID: ${model}`}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            copyToClipboard(model, { successMessage: 'Model ID copied!' })
                          }}
                        >
                          <Copy className='h-3 w-3' />
                        </Button>
                      )}
                      {hasCustomLmStudioUrl && lmStudioBadgeLabel && (
                        <Badge
                          variant='outline'
                          className='ml-1'
                          title={`LM Studio override URL: ${appSettings.lmStudioGlobalUrl}`}
                        >
                          LM Studio: {lmStudioBadgeLabel}
                        </Badge>
                      )}
                    </span>
                  </div>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={handleToggleComposer}
                    aria-label='Collapse composer'
                    className='flex items-center gap-1'
                  >
                    <ChevronsDown className='h-4 w-4' />
                    <span className='hidden sm:inline'>Collapse composer</span>
                  </Button>
                </div>

                <div className='mx-auto w-full max-w-[72rem] px-4 pb-1.5'>
                  <div
                    role='button'
                    tabIndex={0}
                    onClick={handleOpenSystemPromptDialog}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        handleOpenSystemPromptDialog()
                      }
                    }}
                    className='group flex items-center gap-2 rounded-lg border border-border/40 bg-background/60 px-2 py-0.5 text-[11px] shadow-sm transition-all duration-150 hover:border-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 cursor-pointer'
                  >
                    <div className='flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground'>
                      <span>System Prompt</span>
                      {isSystemPromptCustomized && <Badge variant='outline'>Custom</Badge>}
                    </div>
                    <span
                      className='flex-1 truncate text-xs text-muted-foreground/90 max-w-0 opacity-0 transition-all duration-150 ease-out group-hover:max-w-[420px] group-hover:opacity-100 group-focus-within:max-w-[420px] group-focus-within:opacity-100'
                    >
                      {systemPromptDraft}
                    </span>
                    <Button
                      type='button'
                      size='icon'
                      variant='ghost'
                      aria-label='Edit system prompt'
                      onClick={(event) => {
                        event.stopPropagation()
                        handleOpenSystemPromptDialog()
                      }}
                      className='h-5 w-5 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100'
                    >
                      <Edit2 className='h-4 w-4' />
                    </Button>
                  </div>
                </div>

                <Dialog open={isSystemPromptDialogOpen} onOpenChange={handleSystemPromptDialogOpenChange}>
                  <DialogContent className='sm:max-w-lg'>
                    <DialogHeader>
                      <DialogTitle>Edit system prompt</DialogTitle>
                      <DialogDescription>
                        Update the instructions the assistant will follow for this chat.
                      </DialogDescription>
                    </DialogHeader>
                    <div className='space-y-3'>
                      <Textarea
                        value={systemPromptEditValue}
                        onChange={(event) => handleSystemPromptEditValueChange(event.target.value)}
                        className='min-h-[160px] resize-y text-sm'
                      />
                      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground'>
                        <div className='flex items-center gap-2'>
                          <span>{systemPromptEditValue.length} characters</span>
                          <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            onClick={handleSystemPromptResetDraft}
                            disabled={systemPromptEditValue.trim() === DEFAULT_SYSTEM_PROMPT.trim()}
                          >
                            Use default
                          </Button>
                        </div>
                        <div className='flex items-center gap-2'>
                          <Button type='button' variant='ghost' onClick={() => setSystemPromptDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button type='button' onClick={handleSystemPromptSave}>
                            Save
                          </Button>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <PromptInput
                  onSubmit={handlePromptSubmit}
                  className='mx-auto w-full max-w-[72rem] divide-y-0 border-0 bg-transparent px-4 pb-3 shadow-none'
                >
                  <PromptInputBody className='rounded-xl border border-border/50 bg-background/70 shadow-sm backdrop-blur'>
                    <div className='flex items-end gap-3 px-3 py-3'>
                      <PromptInputTextarea
                        value={input ?? ''}
                        onChange={(event) => handleChatInputChange(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                            event.preventDefault()
                            event.currentTarget.form?.requestSubmit()
                          }
                        }}
                        placeholder='Type your message...'
                        disabled={!activeChatId}
                        className='min-h-[60px] flex-1 resize-none rounded-lg bg-background/60 text-sm shadow-inner'
                      />
                      <PromptInputSubmit
                        status={isAiLoading ? 'submitted' : undefined}
                        disabled={!input?.trim() || !activeChatId}
                        variant='default'
                        className='h-11 w-11 rounded-full'
                      />
                    </div>
                  </PromptInputBody>
                </PromptInput>

                {parsedError && (
                  <div className='mx-auto mb-3 w-full max-w-[72rem] px-4'>
                    <AIErrorDisplay
                      error={parsedError}
                      onRetry={() => {
                        clearError()
                        reload()
                      }}
                      onDismiss={clearError}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className='mx-auto w-full max-w-[72rem] px-4 pb-2 pt-2 flex justify-end'>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={handleToggleComposer}
                  aria-label='Expand composer'
                  className='flex items-center gap-1'
                >
                  <ChevronsUp className='h-4 w-4' />
                  <span className='hidden sm:inline'>Expand composer</span>
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className='flex-1 overflow-auto'>
            {activeChatId ? (
              // Loading state when a chat is selected but model isn't ready
              <div className='flex-1 flex items-center justify-center p-4 w-full'>
                <Card className='p-6 max-w-md text-center'>
                  <MessageSquareIcon className='mx-auto h-12 w-12 text-muted-foreground mb-4' />
                  <h2 className='text-xl font-semibold text-foreground mb-2'>Loading Chat...</h2>
                  <p className='text-sm text-muted-foreground mb-4'>Loading model information and messages.</p>
                  {!model && <p className='text-sm text-muted-foreground'>Initializing model...</p>}
                </Card>
              </div>
            ) : (
              // Chat grid view when no chat is selected
              <div className='max-w-7xl mx-auto p-6'>
                {/* Header */}
                <div className='mb-8'>
                  <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6'>
                    <div>
                      <h1 className='text-3xl font-bold tracking-tight'>Recent Chats</h1>
                      <p className='text-muted-foreground mt-1'>Continue your conversations or start a new one</p>
                    </div>

                    {/* New Chat Button */}
                    <Button
                      onClick={handleCreateNewChat}
                      size='lg'
                      className='gap-2 shadow-lg hover:shadow-xl transition-all'
                      disabled={createChat.isPending}
                    >
                      <PlusIcon className='h-5 w-5' />
                      New Chat
                    </Button>
                  </div>

                  {/* Search Bar */}
                  {chatsData && chatsData.length > 0 && (
                    <div className='relative max-w-md'>
                      <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                      <Input
                        placeholder='Search chats...'
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className='pl-10'
                      />
                    </div>
                  )}
                </div>

                {/* Content */}
                {isLoadingChats ? (
                  <div className='flex items-center justify-center py-12'>
                    <div className='text-center'>
                      <MessageSquareIcon className='mx-auto h-12 w-12 text-muted-foreground mb-4 animate-pulse' />
                      <p className='text-muted-foreground'>Loading your chats...</p>
                    </div>
                  </div>
                ) : filteredAndSortedChats.length === 0 ? (
                  <div className='flex items-center justify-center py-12'>
                    <Card className='p-8 max-w-md text-center'>
                      <MessageSquareIcon className='mx-auto h-16 w-16 text-muted-foreground mb-6' />
                      <h3 className='text-xl font-semibold mb-2'>
                        {searchTerm.trim() ? 'No matching chats' : 'No chats yet'}
                      </h3>
                      <p className='text-muted-foreground mb-6'>
                        {searchTerm.trim()
                          ? 'Try adjusting your search terms'
                          : 'Start your first conversation to see it here'}
                      </p>
                      {!searchTerm.trim() && (
                        <Button onClick={handleCreateNewChat} disabled={createChat.isPending}>
                          <PlusIcon className='mr-2 h-4 w-4' />
                          Create Your First Chat
                        </Button>
                      )}
                    </Card>
                  </div>
                ) : (
                  /* Chat Grid */
                  <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
                    {filteredAndSortedChats.map((chat) => (
                      <ChatCard key={chat.id} chat={chat} onDelete={handleDeleteChat} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
