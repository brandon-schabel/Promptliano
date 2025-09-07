import React, { useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import {
  Button,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  GlassCard,
  AnimateOnScroll,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Input,
  cn
} from '@promptliano/ui'
import { MessageSquare, ArrowRight, Clock, Hash, MoreVertical, Edit2, Trash2, User, Bot, Check, X } from 'lucide-react'
import type { Chat, ChatMessage } from '@promptliano/database'
import { useGetMessages, useUpdateChat } from '@/hooks/generated'

interface ChatCardProps {
  chat: Chat
  onEdit?: (chat: Chat) => void
  onDelete?: (chatId: number) => void
  className?: string
}

export const ChatCard = React.memo(function ChatCard({ chat, onEdit, onDelete, className }: ChatCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isRenameOpen, setIsRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const navigate = useNavigate()
  const search = useSearch({ from: '/chat' })

  // Fetch messages for preview - messages are cached and important for preview
  const { data: messages, isLoading: messagesLoading } = useGetMessages(chat.id)
  const updateChat = useUpdateChat()

  const handleCardClick = () => {
    navigate({
      to: '/chat',
      search: { ...search, chatId: chat.id },
      replace: true
    })
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit?.(chat)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete?.(chat.id)
  }

  const handleOpenRename = () => {
    setRenameValue(chat.title || '')
    setIsRenameOpen(true)
  }

  const handleSaveRename = async () => {
    if (renameValue.trim() && renameValue.trim() !== chat.title) {
      try {
        await updateChat.mutateAsync({
          id: chat.id,
          data: { title: renameValue.trim() }
        })
      } catch (error) {
        console.error('Failed to rename chat:', error)
      }
    }
    setIsRenameOpen(false)
  }

  const handleCancelRename = () => {
    setRenameValue('')
    setIsRenameOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveRename()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancelRename()
    }
  }

  const formatTitle = (title: string | null) => {
    if (!title) return 'Untitled Chat'
    return title.length > 40 ? `${title.substring(0, 40)}...` : title
  }

  // Helper to truncate message content
  const truncateMessage = (content: string, maxLength: number = 80) => {
    if (content.length <= maxLength) return content
    return content.substring(0, maxLength).trim() + '...'
  }

  // Get recent conversation preview
  const getRecentMessages = () => {
    if (!messages || messages.length === 0) return null

    // Sort by creation time and get last 2 messages (user + assistant ideally)
    const sortedMessages = [...messages].sort((a, b) => a.createdAt - b.createdAt)
    const recentMessages = sortedMessages.slice(-2)

    // If we only have one message, show it
    if (recentMessages.length === 1) {
      const msg = recentMessages[0]
      return {
        userMessage: msg.role === 'user' ? truncateMessage(msg.content) : null,
        assistantMessage: msg.role === 'assistant' ? truncateMessage(msg.content) : null
      }
    }

    // If we have 2+ messages, try to get the last user message and last assistant message
    const lastMessage = recentMessages[recentMessages.length - 1]
    const secondLastMessage = recentMessages[recentMessages.length - 2]

    return {
      userMessage:
        lastMessage.role === 'user'
          ? truncateMessage(lastMessage.content)
          : secondLastMessage.role === 'user'
            ? truncateMessage(secondLastMessage.content)
            : null,
      assistantMessage:
        lastMessage.role === 'assistant'
          ? truncateMessage(lastMessage.content)
          : secondLastMessage.role === 'assistant'
            ? truncateMessage(secondLastMessage.content)
            : null
    }
  }

  const recentMessages = getRecentMessages()

  return (
    <AnimateOnScroll className={className}>
      <GlassCard
        className={cn(
          'relative group transition-all duration-300',
          'hover:shadow-2xl hover:border-primary/30 hover:-translate-y-1',
          'overflow-hidden',
          'h-[200px] flex flex-col' // Fixed height with flex layout
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Animated Background Gradient */}
        <div
          className={cn(
            'absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500',
            'bg-gradient-to-br from-primary/5 via-transparent to-primary/5'
          )}
        />

        {/* Navigation Controls - appears on hover */}
        <div
          className={cn(
            'absolute top-4 right-4 z-10 transition-all duration-300 flex items-center gap-2',
            isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'
          )}
        >
          {/* Rename Icon */}
          <Popover open={isRenameOpen} onOpenChange={setIsRenameOpen}>
            <PopoverTrigger asChild>
              <Button
                variant='ghost'
                size='icon'
                className='h-8 w-8 rounded-full bg-primary/10 hover:bg-primary/20'
                onClick={handleOpenRename}
                title='Rename Chat'
              >
                <Edit2 className='h-4 w-4' />
              </Button>
            </PopoverTrigger>
            <PopoverContent className='w-80 p-3' align='end'>
              <div className='space-y-3'>
                <div className='space-y-2'>
                  <label htmlFor='rename-input' className='text-sm font-medium'>
                    Rename Chat
                  </label>
                  <Input
                    id='rename-input'
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder='Enter chat name...'
                    autoFocus
                    className='w-full'
                  />
                </div>
                <div className='flex items-center justify-end gap-2'>
                  <Button variant='ghost' size='sm' onClick={handleCancelRename} className='h-7'>
                    <X className='h-3 w-3 mr-1' />
                    Cancel
                  </Button>
                  <Button
                    size='sm'
                    onClick={handleSaveRename}
                    disabled={!renameValue.trim() || updateChat.isPending}
                    className='h-7'
                  >
                    <Check className='h-3 w-3 mr-1' />
                    {updateChat.isPending ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Navigate Arrow */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-8 w-8 rounded-full bg-primary/10 hover:bg-primary/20'
                  onClick={handleCardClick}
                >
                  <ArrowRight className='h-4 w-4' />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open Chat</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <CardHeader className='relative flex-shrink-0 pb-3'>
          <div className='flex items-start gap-3'>
            {/* Chat Icon */}
            <div
              className={cn(
                'p-2.5 rounded-xl transition-all duration-300',
                'bg-gradient-to-br from-blue-500/20 to-cyan-500/10 shadow-lg',
                'group-hover:from-blue-500/30 group-hover:to-cyan-500/20',
                isHovered && 'rotate-3'
              )}
            >
              <MessageSquare className='h-4 w-4 text-blue-500' />
            </div>

            {/* Title and ID */}
            <div className='flex-1 min-w-0'>
              <CardTitle className='text-base mb-1'>
                <span className='truncate block' title={chat.title || 'Untitled Chat'}>
                  {formatTitle(chat.title)}
                </span>
              </CardTitle>

              {/* Chat ID Badge */}
              <Badge variant='outline' className='text-xs gap-1'>
                <Hash className='h-3 w-3' />
                {chat.id}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className='flex-1 flex flex-col justify-between space-y-0 pt-0'>
          {/* Recent Messages Preview - fixed height area */}
          <div className='h-[80px] overflow-hidden'>
            {recentMessages && (
              <div className='space-y-2'>
                {recentMessages.userMessage && (
                  <div className='flex items-start gap-2 text-xs'>
                    <User className='h-3 w-3 mt-0.5 text-blue-500 flex-shrink-0' />
                    <span className='text-muted-foreground line-clamp-2 leading-relaxed'>
                      {recentMessages.userMessage}
                    </span>
                  </div>
                )}
                {recentMessages.assistantMessage && (
                  <div className='flex items-start gap-2 text-xs'>
                    <Bot className='h-3 w-3 mt-0.5 text-green-500 flex-shrink-0' />
                    <span className='text-muted-foreground line-clamp-2 leading-relaxed'>
                      {recentMessages.assistantMessage}
                    </span>
                  </div>
                )}
                {!recentMessages.userMessage && !recentMessages.assistantMessage && (
                  <div className='text-xs text-muted-foreground/60 italic'>No messages yet</div>
                )}
              </div>
            )}
          </div>

          {/* Condensed Timestamp - fixed at bottom */}
          <div className='flex items-center justify-between text-xs pt-2 border-t border-border/50 flex-shrink-0 px-1'>
            <span className='text-muted-foreground flex items-center gap-2'>
              <Clock className='h-3 w-3' />
              Updated
            </span>
            <span className='font-medium'>{formatDistanceToNow(new Date(chat.updatedAt), { addSuffix: true })}</span>
          </div>

          {/* Action Buttons - only show on hover, positioned at bottom */}
          <div
            className={cn(
              'flex items-center gap-2 transition-all duration-300 mt-2 flex-shrink-0',
              isHovered ? 'opacity-100' : 'opacity-0'
            )}
          >
            {onEdit && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant='ghost' size='sm' className='h-7 w-7 p-0' onClick={handleEdit}>
                      <Edit2 className='h-3 w-3' />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit Chat</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {onDelete && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-7 w-7 p-0 text-destructive/80 hover:text-destructive'
                      onClick={handleDelete}
                    >
                      <Trash2 className='h-3 w-3' />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete Chat</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </CardContent>

        {/* Pulse effect on hover */}
        {isHovered && (
          <div className='absolute inset-0 z-0 animate-pulse'>
            <div className='w-full h-full bg-primary/5 rounded-lg' />
          </div>
        )}
      </GlassCard>
    </AnimateOnScroll>
  )
})
