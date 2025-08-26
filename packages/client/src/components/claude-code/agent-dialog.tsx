import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@promptliano/ui'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@promptliano/ui'
import { Input } from '@promptliano/ui'
import { Textarea } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@promptliano/ui'
import { Loader2 } from 'lucide-react'
import { useCreateAgent, useUpdateAgent, useAgent } from '@/hooks/api-hooks'
import type { ClaudeAgent } from '@promptliano/database'

const agentFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  description: z.string().min(1, 'Description is required').max(500, 'Description is too long'),
  instructions: z.string().min(1, 'Instructions are required'),
  model: z.string().min(1, 'Model is required')
})

type AgentFormData = z.infer<typeof agentFormSchema>

interface AgentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentId?: string | null
  projectId?: number
}

const modelOptions = [
  { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
  { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' }
]

export function AgentDialog({ open, onOpenChange, agentId, projectId }: AgentDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isEditing = !!agentId

  // Fetch agent data if editing
  const { data: agentResponse, isLoading: isLoadingAgent } = useAgent(agentId ? parseInt(agentId) : 0)
  const agent = agentResponse

  // Mutations
  const createAgentMutation = useCreateAgent()
  const updateAgentMutation = useUpdateAgent()

  // Type assertion to help TypeScript understand the mutation signatures
  const updateMutation = updateAgentMutation as any

  const form = useForm<AgentFormData>({
    resolver: zodResolver(agentFormSchema),
    defaultValues: {
      name: '',
      description: '',
      instructions: '',
      model: 'claude-3-5-haiku-20241022'
    }
  })

  // Update form when agent data is loaded
  useEffect(() => {
    if (agent && isEditing) {
      form.reset({
        name: agent.name,
        description: agent.description || '',
        instructions: agent.instructions || '',
        model: agent.model
      })
    }
  }, [agent, isEditing, form])

  const onSubmit = async (data: AgentFormData) => {
    setIsSubmitting(true)

    try {
      if (isEditing && agentId) {
        updateMutation.mutate({ id: parseInt(agentId), data })
      } else {
        createAgentMutation.mutate({
          ...data
        })
      }

      // Close dialog after mutation is submitted (not necessarily completed)
      onOpenChange(false)
      form.reset()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[625px]'>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Agent' : 'Create New Agent'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the agent details below.'
              : 'Create a new Claude Code agent for specialized AI assistance.'}
          </DialogDescription>
        </DialogHeader>

        {isLoadingAgent && isEditing ? (
          <div className='flex items-center justify-center py-8'>
            <Loader2 className='h-8 w-8 animate-spin' />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder='e.g., frontend-expert' {...field} />
                    </FormControl>
                    <FormDescription>A unique identifier for this agent (lowercase, hyphens allowed)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='description'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='e.g., Expert in React, TypeScript, and modern frontend development'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Brief description of the agent's capabilities</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='model'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select a model' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {modelOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Claude model to use for this agent</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='instructions'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agent Instructions (Markdown)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='# Agent Name&#10;&#10;## Expertise&#10;- List areas of expertise...&#10;&#10;## Instructions&#10;Detailed instructions for the AI...'
                        className='min-h-[200px] font-mono text-sm'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Full markdown content defining the agent's behavior and knowledge</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type='submit' disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
                  {isEditing ? 'Update Agent' : 'Create Agent'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
