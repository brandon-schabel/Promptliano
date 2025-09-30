import { useState, useMemo } from 'react'
import { MessageSquareText } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger, Button, Progress, Slider } from '@promptliano/ui'
import { FormatTokenCount } from '@/components/format-token-count'
import { estimateTokenCount } from '@promptliano/shared'
import type { ChatUiMessage } from '@/hooks/generated/ai-chat-hooks'
import { cn } from '@/lib/utils'

interface MessageHistoryPopoverProps {
  messages: ChatUiMessage[]
  currentValue: number
  onChange: (value: number) => void
  newInputText: string
  onOpenChange?: (open: boolean) => void
  className?: string
}

export function MessageHistoryPopover({
  messages,
  currentValue,
  onChange,
  newInputText,
  onOpenChange,
  className
}: MessageHistoryPopoverProps) {
  const [open, setOpen] = useState(false)

  const handleOpenChange = (newOpen: boolean) => {
    console.log('[MessageHistoryPopover] Open state changing:', { from: open, to: newOpen })
    setOpen(newOpen)
    onOpenChange?.(newOpen)
  }

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

  // Calculate progress percentage for preview bar
  const progressPercentage = (currentValue / Math.max(messages.length, 1)) * 100

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant='ghost'
          size='sm'
          className={cn(
            'h-auto gap-2 px-3 py-1.5 hover:bg-muted/50',
            className
          )}
        >
          {/* Single Line Compact Preview */}
          <div className='flex items-center gap-2.5'>
            <MessageSquareText className='h-3.5 w-3.5 text-muted-foreground flex-shrink-0' />
            <span className='text-xs font-medium text-muted-foreground whitespace-nowrap'>
              {currentValue} of {messages.length}
            </span>
            <Progress
              value={progressPercentage}
              variant='fullness'
              className='h-1 w-20'
            />
            <div className='flex items-center gap-1'>
              <FormatTokenCount tokenContent={tokenStats.totalTokens} />
              <span className='text-[10px] text-muted-foreground'>tokens</span>
            </div>
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent className='w-96' align='end'>
        <div className='space-y-4'>
          <div>
            <h4 className='text-sm font-medium mb-1'>Message History</h4>
            <p className='text-xs text-muted-foreground'>
              Control how many previous messages are included in the context
            </p>
          </div>

          {/* Slider Control */}
          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <span className='text-xs text-muted-foreground'>Messages</span>
              <span className='text-xs font-medium'>
                {currentValue} of {messages.length}
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
          <div className='grid grid-cols-3 gap-3 rounded-lg border bg-muted/30 p-3 text-xs'>
            <div className='space-y-1'>
              <div className='text-muted-foreground'>History</div>
              <div className='flex items-center gap-1.5'>
                <FormatTokenCount tokenContent={tokenStats.messagesTokens} />
                <span className='text-[10px] text-muted-foreground'>tokens</span>
              </div>
            </div>

            <div className='space-y-1'>
              <div className='text-muted-foreground'>New Input</div>
              <div className='flex items-center gap-1.5'>
                <FormatTokenCount tokenContent={tokenStats.inputTokens} />
                <span className='text-[10px] text-muted-foreground'>tokens</span>
              </div>
            </div>

            <div className='space-y-1'>
              <div className='text-muted-foreground'>Total Context</div>
              <div className='flex items-center gap-1.5'>
                <FormatTokenCount tokenContent={tokenStats.totalTokens} />
                <span className='text-[10px] text-muted-foreground'>tokens</span>
              </div>
            </div>
          </div>

          {/* Context Window Warning */}
          {tokenStats.totalTokens > 8000 && (
            <div className='rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-2.5 text-xs text-yellow-600 dark:text-yellow-400'>
              ⚠️ Large context window may increase response time and cost
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}