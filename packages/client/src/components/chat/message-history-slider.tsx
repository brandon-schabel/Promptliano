import { Slider } from '@promptliano/ui'
import { FormatTokenCount } from '@/components/format-token-count'
import { estimateTokenCount } from '@promptliano/shared'
import { useMemo } from 'react'
import type { ChatUiMessage } from '@/hooks/generated/ai-chat-hooks'
import { cn } from '@/lib/utils'

interface MessageHistorySliderProps {
  messages: ChatUiMessage[]
  currentValue: number
  onChange: (value: number) => void
  newInputText: string
  className?: string
}

export function MessageHistorySlider({
  messages,
  currentValue,
  onChange,
  newInputText,
  className
}: MessageHistorySliderProps) {
  const tokenStats = useMemo(() => {
    // Calculate tokens for selected message range
    const selectedMessages = messages.slice(-currentValue)
    const messagesTokens = selectedMessages.reduce((total, msg) => {
      const content = typeof msg.content === 'string' ? msg.content : ''
      return total + estimateTokenCount(content)
    }, 0)

    // Calculate tokens for new input
    const inputTokens = estimateTokenCount(newInputText)

    // Total context
    const totalTokens = messagesTokens + inputTokens

    return {
      messagesTokens,
      inputTokens,
      totalTokens,
      messageCount: selectedMessages.length
    }
  }, [messages, currentValue, newInputText])

  return (
    <div className={cn('space-y-3', className)}>
      {/* Slider Control */}
      <div className='space-y-2'>
        <div className='flex items-center justify-between'>
          <label className='text-sm font-medium'>Message History</label>
          <span className='text-sm text-muted-foreground'>
            {currentValue} of {messages.length} messages
          </span>
        </div>

        <Slider
          value={[currentValue]}
          onValueChange={([value]) => onChange(value!)}
          min={1}
          max={messages.length || 1}
          step={1}
          className='w-full'
        />
      </div>

      {/* Token Statistics */}
      <div className='grid grid-cols-3 gap-4 rounded-lg border bg-muted/30 p-3 text-sm'>
        <div className='space-y-1'>
          <div className='text-muted-foreground'>History</div>
          <div className='flex items-center gap-2'>
            <FormatTokenCount tokenContent={tokenStats.messagesTokens} />
            <span className='text-xs text-muted-foreground'>tokens</span>
          </div>
        </div>

        <div className='space-y-1'>
          <div className='text-muted-foreground'>New Input</div>
          <div className='flex items-center gap-2'>
            <FormatTokenCount tokenContent={tokenStats.inputTokens} />
            <span className='text-xs text-muted-foreground'>tokens</span>
          </div>
        </div>

        <div className='space-y-1'>
          <div className='text-muted-foreground'>Total Context</div>
          <div className='flex items-center gap-2'>
            <FormatTokenCount tokenContent={tokenStats.totalTokens} />
            <span className='text-xs text-muted-foreground'>tokens</span>
          </div>
        </div>
      </div>

      {/* Context Window Warning */}
      {tokenStats.totalTokens > 8000 && (
        <div className='rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-2 text-xs text-yellow-600 dark:text-yellow-400'>
          ⚠️ Large context window may increase response time and cost
        </div>
      )}
    </div>
  )
}
