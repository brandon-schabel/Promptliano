import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from '@promptliano/ui'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@promptliano/ui'
import { Input } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Loader2 } from 'lucide-react'
import { UseFormReturn } from 'react-hook-form'
import { ExpandableTextarea } from '@/components/expandable-textarea'
import { ErrorBoundary } from '@/components/error-boundary/error-boundary'
import { useCreatePrompt, useUpdatePrompt } from '@/hooks/generated'
import { useGetProjectPrompts } from '@/hooks/api-hooks'
import { PROMPT_ENHANCED_KEYS } from '@/hooks/generated/query-keys'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

interface PromptDialogProps {
  open: boolean
  editPromptId: number | null
  promptForm: UseFormReturn<any, any>
  projectId: number
  onClose: () => void
  onSuccess?: () => void
}

export function PromptDialog({ open, editPromptId, promptForm, projectId, onClose, onSuccess }: PromptDialogProps) {
  const createPromptMutation = useCreatePrompt()
  const updatePromptMutation = useUpdatePrompt()
  const { data: promptData } = useGetProjectPrompts(projectId)
  const queryClient = useQueryClient()

  // Populate form when editing
  useEffect(() => {
    if (editPromptId && promptData) {
      const prompt = promptData.find((p) => p.id === editPromptId)
      if (prompt) {
        promptForm.setValue('title', prompt.title)
        promptForm.setValue('content', prompt.content)
      }
    } else {
      promptForm.reset()
    }
  }, [editPromptId, promptData, promptForm])

  const handleFormKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.target instanceof HTMLTextAreaElement) {
      e.stopPropagation()
    }
  }

  const handleCreatePrompt = async (values: { title: string; content: string }) => {
    try {
      const result = await createPromptMutation.mutateAsync({
        projectId,
        title: values.title,
        content: values.content
      })

      if (!result) {
        return
      }

      // Invalidate project prompts explicitly (generated hooks also invalidate all prompts)
      queryClient.invalidateQueries({ queryKey: PROMPT_ENHANCED_KEYS.projectPrompts(projectId) })
      onSuccess?.()
    } catch (error) {
      console.error('Error creating prompt:', error)
      // Error toasts are handled by the generated hook
    }
  }

  const handleUpdatePrompt = async (values: { title: string; content: string }) => {
    if (!editPromptId) return

    try {
      await updatePromptMutation.mutateAsync({
        id: editPromptId,
        data: {
          title: values.title,
          content: values.content
        }
      })
      onSuccess?.()
    } catch (error) {
      console.error('Error updating prompt:', error)
      // Error toasts are handled by the generated hook
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(dialogOpen) => {
        if (!dialogOpen) {
          promptForm.reset()
        }
        if (!dialogOpen) {
          onClose()
        }
      }}
    >
      <DialogContent className='sm:max-w-[800px]'>
        <ErrorBoundary>
          <DialogHeader>
            <DialogTitle>{editPromptId ? 'Edit Prompt' : 'New Prompt'}</DialogTitle>
            <DialogDescription>
              {editPromptId ? 'Update the prompt details.' : 'Create a new prompt.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...promptForm}>
            <form
              onSubmit={promptForm.handleSubmit(editPromptId ? handleUpdatePrompt : handleCreatePrompt)}
              className='space-y-4'
              onKeyDown={handleFormKeyDown}
            >
              <FormField
                control={promptForm.control}
                name='title'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prompt Title</FormLabel>
                    <FormControl>
                      <Input placeholder='e.g. Summarize Document' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={promptForm.control}
                name='content'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prompt Content</FormLabel>
                    <FormControl>
                      <ExpandableTextarea
                        value={field.value || ''}
                        onChange={field.onChange}
                        placeholder='Enter the prompt instructions here...'
                        title='Edit Prompt Content'
                        className='min-h-[200px]'
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant='outline'>Cancel</Button>
                </DialogClose>
                <Button
                  disabled={createPromptMutation.isPending || updatePromptMutation.isPending}
                  onClick={(e) => {
                    e.preventDefault()
                    // handle form submit/prompt creation because form submit is not working
                    if (editPromptId) {
                      handleUpdatePrompt(promptForm.getValues())
                    } else {
                      handleCreatePrompt(promptForm.getValues())
                    }
                  }}
                >
                  {(createPromptMutation.isPending || updatePromptMutation.isPending) && (
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  )}
                  {editPromptId ? 'Update Prompt' : 'Create Prompt'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </ErrorBoundary>
      </DialogContent>
    </Dialog>
  )
}
