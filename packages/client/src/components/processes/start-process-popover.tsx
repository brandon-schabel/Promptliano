import React, { useState } from 'react'
import {
  Button,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@promptliano/ui'
import { useStartProcess } from '@/hooks/api/processes-hooks'
import { Loader2, Play, Check, X } from 'lucide-react'

type StartProcessPopoverProps = {
  projectId: number
  onProcessStarted?: () => void
  className?: string
}

export function StartProcessPopover({ projectId, onProcessStarted, className }: StartProcessPopoverProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [command, setCommand] = useState('')
  const [args, setArgs] = useState('')
  const [name, setName] = useState('')
  const startMutation = useStartProcess(projectId)

  const handleOpenPopover = () => {
    setCommand('')
    setArgs('')
    setName('')
    setIsOpen(true)
  }

  const handleStart = async () => {
    if (!command.trim()) return
    
    const parsedArgs = args.trim()
      ? args.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map((s) => s.replace(/^['"]|['"]$/g, ''))
      : []
    
    try {
      await startMutation.mutateAsync({
        command: command.trim(),
        args: parsedArgs || [],
        name: name.trim() || undefined
      })
      
      setCommand('')
      setArgs('')
      setName('')
      setIsOpen(false)
      onProcessStarted?.()
    } catch (error) {
      // Error handling is done by the mutation
    }
  }

  const handleCancel = () => {
    setCommand('')
    setArgs('')
    setName('')
    setIsOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleStart()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          onClick={handleOpenPopover}
          disabled={startMutation.isPending}
          className={className}
        >
          <Play className='h-4 w-4 mr-2' />
          Start Process
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-96 p-4' align='end'>
        <div className='space-y-4'>
          <div className='space-y-2'>
            <h4 className='font-medium text-sm'>Start New Process</h4>
            <p className='text-sm text-muted-foreground'>
              Run a command in the project workspace
            </p>
          </div>
          
          <div className='space-y-3'>
            <div className='space-y-1'>
              <Label htmlFor='command-input' className='text-xs'>
                Command *
              </Label>
              <Input
                id='command-input'
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder='bun run dev'
                autoFocus
                className='w-full'
              />
            </div>
            
            <div className='space-y-1'>
              <Label htmlFor='args-input' className='text-xs'>
                Arguments
              </Label>
              <Input
                id='args-input'
                value={args}
                onChange={(e) => setArgs(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder='--port 3000'
                className='w-full'
              />
            </div>
            
            <div className='space-y-1'>
              <Label htmlFor='name-input' className='text-xs'>
                Name (optional)
              </Label>
              <Input
                id='name-input'
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder='web server'
                className='w-full'
              />
            </div>
          </div>
          
          <div className='flex items-center justify-end gap-2'>
            <Button variant='ghost' size='sm' onClick={handleCancel} className='h-8'>
              <X className='h-3 w-3 mr-1' />
              Cancel
            </Button>
            <Button
              size='sm'
              onClick={handleStart}
              disabled={!command.trim() || startMutation.isPending}
              className='h-8'
            >
              {startMutation.isPending ? (
                <Loader2 className='h-3 w-3 mr-1 animate-spin' />
              ) : (
                <Check className='h-3 w-3 mr-1' />
              )}
              {startMutation.isPending ? 'Starting...' : 'Start'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}