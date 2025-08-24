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
import { RadioGroup, RadioGroupItem } from '@promptliano/ui'
import { Label } from '@promptliano/ui'
import { Loader2, Info, Code } from 'lucide-react'
import { useCreateCommand, useUpdateCommand, useGetCommand } from '@/hooks/api/use-commands-api'
import type { ClaudeCommand } from '@promptliano/database'

const commandFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(50, 'Name is too long')
    .regex(/^[a-z0-9-]+$/, 'Name must be lowercase letters, numbers, and hyphens only'),
  description: z.string().max(200, 'Description is too long').optional(),
  command: z.string().min(1, 'Command content is required'),
  args: z.record(z.any()).optional().default({})
})

type CommandFormData = z.infer<typeof commandFormSchema>

interface CommandDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  commandName?: string | null
  namespace?: string | null
  projectId: number
  initialData?: ClaudeCommand | null
}


export function CommandDialog({
  open,
  onOpenChange,
  commandName,
  namespace,
  projectId,
  initialData
}: CommandDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isEditing = !!commandName || !!initialData

  // Fetch command data if editing (but not if we have initialData)
  const shouldFetch = isEditing && !initialData && !!commandName
  const { data: commandResponse, isLoading: isLoadingCommand } = useGetCommand(
    projectId,
    shouldFetch ? commandName : '',
    shouldFetch ? namespace || undefined : undefined
  )
  const command = initialData || commandResponse?.data

  // Mutations
  const createCommandMutation = useCreateCommand(projectId)
  const updateCommandMutation = useUpdateCommand(projectId)

  const form = useForm<CommandFormData>({
    resolver: zodResolver(commandFormSchema),
    defaultValues: {
      name: '',
      description: '',
      command: '',
      args: {}
    }
  })

  // Update form when command data is loaded
  useEffect(() => {
    if (command && isEditing) {
      form.reset({
        name: command.name,
        description: command.description || '',
        command: command.command,
        args: command.args || {}
      })
    }
  }, [command, isEditing, form])

  const onSubmit = async (data: CommandFormData) => {
    setIsSubmitting(true)

    try {
      if (isEditing && commandName && !initialData) {
        // Update existing command
        await updateCommandMutation.mutateAsync({
          commandName: commandName || '',
          data: {
            name: data.name,
            description: data.description,
            command: data.command,
            args: data.args || {}
          }
        })
      } else {
        // Create new command (including saving generated commands)
        await createCommandMutation.mutateAsync({
          name: data.name,
          description: data.description,
          command: data.command,
          args: data.args || {},
          isActive: true
        })
      }

      onOpenChange(false)
      form.reset()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[725px] max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>
            {initialData ? 'Save Generated Command' : isEditing ? 'Edit Command' : 'Create New Command'}
          </DialogTitle>
          <DialogDescription>
            {initialData
              ? 'Review and save the AI-generated command. You can make any edits before saving.'
              : isEditing
                ? 'Update the command details below.'
                : 'Create a new Claude Code slash command for this project.'}
          </DialogDescription>
        </DialogHeader>

        {isLoadingCommand && isEditing ? (
          <div className='flex items-center justify-center py-8'>
            <Loader2 className='h-8 w-8 animate-spin' />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
              <div className='grid grid-cols-2 gap-4'>
                <FormField
                  control={form.control}
                  name='name'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Command Name</FormLabel>
                      <FormControl>
                        <Input placeholder='review-code' {...field} disabled={isEditing && !initialData} />
                      </FormControl>
                      <FormDescription>Lowercase letters, numbers, and hyphens only</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              </div>

              <FormField
                control={form.control}
                name='description'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder='Performs comprehensive code review with security analysis' {...field} />
                    </FormControl>
                    <FormDescription>Brief description of what this command does</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='command'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Command Content</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='Review the code in $ARGUMENTS and provide feedback on:&#10;1. Code quality and best practices&#10;2. Potential bugs or issues&#10;3. Performance optimizations&#10;4. Security concerns&#10;&#10;Focus on actionable suggestions...'
                        className='min-h-[200px] font-mono text-sm'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      The prompt that will be sent to Claude. Use $ARGUMENTS where user input should be inserted.
                    </FormDescription>
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
                  {isEditing ? 'Update Command' : 'Create Command'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}

