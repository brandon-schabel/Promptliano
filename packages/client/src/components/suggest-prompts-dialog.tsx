import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { useActiveProjectTab, useUpdateActiveProjectTab, useProjectTabField } from '@/hooks/use-kv-local-storage'
import type { Prompt } from '@promptliano/schemas'
import type { SuggestPromptsScoreDebug } from '@/hooks/api-hooks'
import { ErrorBoundary } from '@/components/error-boundary/error-boundary'
import { cn } from '@/lib/utils'

export type SuggestedPromptWithScore = {
  prompt: Prompt
  score?: SuggestPromptsScoreDebug
}

type SuggestedPromptsDialogProps = {
  open: boolean
  onClose: () => void
  suggestedPrompts: SuggestedPromptWithScore[]
}

export function SuggestedPromptsDialog({ open, onClose, suggestedPrompts }: SuggestedPromptsDialogProps) {
  const [activeProjectTabState, , activeProjectTabId] = useActiveProjectTab()
  const updateActiveProjectTab = useUpdateActiveProjectTab()
  const { data: selectedPrompts = [] } = useProjectTabField('selectedPrompts', activeProjectTabId ?? -1)
  const [localSelectedPrompts, setLocalSelectedPrompts] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (open) {
      setLocalSelectedPrompts(new Set(selectedPrompts))
    }
  }, [open, selectedPrompts])

  const toggleLocalPrompt = (promptId: number) => {
    setLocalSelectedPrompts((prev) => {
      const next = new Set(prev)
      if (next.has(promptId)) {
        next.delete(promptId)
      } else {
        next.add(promptId)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    setLocalSelectedPrompts((prev) => {
      const next = new Set<number>(prev)
      const allSelected = suggestedPrompts.every((p) => next.has(p.prompt.id))

      if (allSelected) {
        suggestedPrompts.forEach((p) => next.delete(p.prompt.id))
      } else {
        suggestedPrompts.forEach((p) => next.add(p.prompt.id))
      }
      return next
    })
  }

  const handleDialogClose = () => {
    updateActiveProjectTab({ selectedPrompts: [...localSelectedPrompts] })
    onClose()
  }

  const formatScore = (value?: number) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return null
    return `${Math.round(value * 100)}%`
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className='max-w-2xl'>
        <ErrorBoundary>
          <DialogHeader>
            <DialogTitle>Recommended Prompts</DialogTitle>
            <DialogDescription>
              Based on your input and project context, these prompts may be helpful:
            </DialogDescription>
          </DialogHeader>

          <div className='mt-2 space-y-3 max-h-[400px] overflow-y-auto pr-2'>
            {suggestedPrompts.map(({ prompt, score }) => {
              const promptId = prompt.id
              const isSelected = localSelectedPrompts.has(promptId)
              const breakdown = [
                { label: 'Title', value: score?.titleScore },
                { label: 'Content', value: score?.contentScore },
                { label: 'Tags', value: score?.tagScore },
                { label: 'Recency', value: score?.recencyScore },
                { label: 'Usage', value: score?.usageScore }
              ].filter((item) => typeof item.value === 'number' && !Number.isNaN(item.value as number)) as Array<{
                label: string
                value: number
              }>
              const totalScore = formatScore(score?.totalScore)
              return (
                <div
                  key={promptId}
                  className={cn(
                    'p-3 rounded-md border cursor-pointer transition-colors',
                    isSelected ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                  )}
                  onClick={() => toggleLocalPrompt(promptId)}
                  data-testid='suggested-prompt'
                >
                  <div className='flex items-start gap-3'>
                    <input
                      type='checkbox'
                      checked={isSelected}
                      onChange={() => toggleLocalPrompt(promptId)}
                      onClick={(e) => e.stopPropagation()}
                      className='mt-1'
                    />
                    <div className='flex-1 space-y-1'>
                      <div className='flex items-start justify-between gap-2'>
                        <div className='font-medium text-sm'>{prompt.title}</div>
                        {totalScore && (
                          <span className='text-xs font-medium text-muted-foreground whitespace-nowrap'>
                            Score {totalScore}
                          </span>
                        )}
                      </div>
                      <div className='text-xs text-muted-foreground line-clamp-3'>{prompt.content}</div>
                      {breakdown.length > 0 && (
                        <div className='flex flex-wrap gap-2 pt-1 text-[11px] text-muted-foreground/80'>
                          {breakdown.map(({ label, value }) => {
                            const formattedScore = formatScore(value) ?? '0%'
                            return (
                              <span
                                key={label}
                                className='rounded-full bg-muted px-2 py-0.5 uppercase tracking-wide'
                              >
                                {label}: {formattedScore}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            {suggestedPrompts.length === 0 && (
              <div className='text-center py-8 text-muted-foreground'>No prompts found matching your input</div>
            )}
          </div>

          <DialogFooter>
            {suggestedPrompts.length > 0 && (
              <Button onClick={handleSelectAll} variant='outline'>
                {suggestedPrompts.every((item) => localSelectedPrompts.has(item.prompt.id))
                  ? 'Deselect All'
                  : 'Select All'}
              </Button>
            )}
            <Button onClick={handleDialogClose}>{suggestedPrompts.length > 0 ? 'Confirm' : 'Close'}</Button>
          </DialogFooter>
        </ErrorBoundary>
      </DialogContent>
    </Dialog>
  )
}
