import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo, useRef } from 'react'
import { Button } from '@promptliano/ui'
import { Input } from '@promptliano/ui'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@promptliano/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@promptliano/ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@promptliano/ui'
import { toast } from 'sonner'
import {
  useCreatePrompt,
  useUpdatePrompt,
  useDeletePrompt,
  useGetAllPrompts,
  useExportPromptAsMarkdown
} from '@/hooks/api-hooks'
import { useDebounce } from '@/hooks/utility-hooks/use-debounce'
import { useActiveProjectTab } from '@/hooks/use-kv-local-storage'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuItem,
  DropdownMenuSeparator
} from '@promptliano/ui'
import { ArrowDownAZ, ArrowUpDown, Copy, Pencil, Upload, Download, MoreVertical, Trash } from 'lucide-react'
import { Badge } from '@promptliano/ui'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import { ExpandableTextarea } from '@/components/expandable-textarea'
import type { Prompt } from '@promptliano/database'
import { estimateTokenCount, formatTokenCount } from '@promptliano/shared'
import { MarkdownImportDialog } from '@/components/prompts/markdown-import-dialog'

export function PromptsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 300)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null)
  const [sortOrder, setSortOrder] = useState<'alphabetical' | 'default' | 'size_asc' | 'size_desc'>('alphabetical')
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [selectedPrompts, setSelectedPrompts] = useState<Set<number>>(new Set())

  // Get active project from tab state
  const [activeProjectTabState] = useActiveProjectTab()
  const selectedProjectId = activeProjectTabState?.selectedProjectId

  const { data: promptsRes, isLoading, error, refetch } = useGetAllPrompts()
  const prompts = promptsRes as Prompt[]
  const deletePromptMutation = useDeletePrompt()
  const createPromptMutation = useCreatePrompt()
  const updatePromptMutation = useUpdatePrompt()
  const exportPromptMutation = useExportPromptAsMarkdown()
  // TODO: Re-implement bulk export when the hook is available
  // const exportPromptsMutation = useExportPromptsAsMarkdown()

  // Filter and sort prompts
  const filteredAndSortedPrompts = useMemo(() => {
    // First filter by search query
    const filtered =
      prompts?.filter(
        (prompt) =>
          prompt.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          prompt.content.toLowerCase().includes(debouncedSearch.toLowerCase())
      ) ?? []

    // Then sort based on selected order
    let sorted = [...filtered]
    if (sortOrder === 'alphabetical') {
      sorted.sort((a, b) => a.title.localeCompare(b.title))
    } else if (sortOrder === 'size_desc') {
      sorted.sort((a, b) => estimateTokenCount(b.content) - estimateTokenCount(a.content))
    } else if (sortOrder === 'size_asc') {
      sorted.sort((a, b) => estimateTokenCount(a.content) - estimateTokenCount(b.content))
    }

    return sorted
  }, [prompts, debouncedSearch, sortOrder])

  // Handle bulk export
  const handleBulkExport = async () => {
    // TODO: Re-implement when bulk export hook is available
    toast.error('Bulk export not yet implemented')
  }

  // Handle import success
  const handleImportSuccess = (count: number) => {
    refetch()
    setIsImportDialogOpen(false)
  }

  return (
    <div className='container mx-auto p-6 space-y-6'>
      <div className='flex justify-between items-center'>
        <h1 className='text-3xl font-bold'>Prompt Management</h1>
        <div className='flex gap-2'>
          <Button
            variant='outline'
            onClick={() => setIsImportDialogOpen(true)}
            title='Import prompts from markdown files'
          >
            <Upload className='h-4 w-4 mr-2' />
            Import
          </Button>
          <Button
            variant='outline'
            onClick={handleBulkExport}
            disabled={false}
            title={
              selectedPrompts.size > 0
                ? `Export ${selectedPrompts.size} selected prompt${selectedPrompts.size > 1 ? 's' : ''}`
                : 'Export all prompts'
            }
          >
            <Download className='h-4 w-4 mr-2' />
            Export {selectedPrompts.size > 0 ? `(${selectedPrompts.size})` : 'All'}
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>Create New Prompt</Button>
        </div>
      </div>

      <div className='flex items-center justify-between'>
        <div className='flex items-center space-x-4'>
          <Input
            placeholder='Search prompts...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className='max-w-sm'
          />
          <Badge>{filteredAndSortedPrompts.length} Prompts</Badge>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='outline' size='sm'>
              <ArrowUpDown className='h-4 w-4 mr-2' />
              Sort
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuRadioGroup value={sortOrder} onValueChange={(value) => setSortOrder(value as any)}>
              <DropdownMenuRadioItem value='alphabetical'>
                <ArrowDownAZ className='h-4 w-4 mr-2' />
                Alphabetical
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value='size_desc'>Largest first</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value='size_asc'>Smallest first</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value='default'>Default order</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Tabs defaultValue='all' className='w-full'>
        <TabsList>
          <TabsTrigger value='all'>All Prompts</TabsTrigger>
          <TabsTrigger value='favorites'>Favorites</TabsTrigger>
          <TabsTrigger value='recent'>Recent</TabsTrigger>
        </TabsList>

        <TabsContent value='all' className='space-y-4'>
          {isLoading ? (
            <div>Loading prompts...</div>
          ) : error ? (
            <div>Error loading prompts: {error.message}</div>
          ) : (
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
              {filteredAndSortedPrompts.map((prompt) => (
                <PromptCard
                  key={prompt.id}
                  prompt={prompt}
                  isSelected={selectedPrompts.has(prompt.id)}
                  onToggleSelect={(selected) => {
                    const newSelected = new Set(selectedPrompts)
                    if (selected) {
                      newSelected.add(prompt.id)
                    } else {
                      newSelected.delete(prompt.id)
                    }
                    setSelectedPrompts(newSelected)
                  }}
                  onEdit={() => setSelectedPrompt(prompt)}
                  onDelete={async () => {
                    try {
                      // alert to confirm deletion
                      if (confirm('Are you sure you want to delete this prompt?')) {
                        await deletePromptMutation.mutateAsync(prompt.id)
                      }
                      // toast to confirm deletion
                      toast.success('Prompt deleted successfully')
                    } catch {
                      // Error is handled in usePrompts
                    }
                  }}
                  onExport={async () => {
                    try {
                      await exportPromptMutation.mutateAsync({
                        promptId: prompt.id
                      })
                      toast.success(`Exported "${prompt.title}"`)
                    } catch (error) {
                      toast.error('Failed to export prompt')
                    }
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <PromptDialog
        open={isCreateDialogOpen || !!selectedPrompt}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false)
            setSelectedPrompt(null)
          }
        }}
        prompt={selectedPrompt}
        onSave={async (data) => {
          if (selectedPrompt) {
            // TODO: Fix mutation call when hook is properly typed
            // await updatePromptMutation.mutateAsync({ promptId: selectedPrompt.id, title: data.name, content: data.content })
            console.log('Prompt update not implemented yet')
          } else {
            // Use the selected project ID, or fallback to -1 if no project is selected
            const projectId = selectedProjectId || -1
            if (projectId === -1) {
              toast.error('Please select a project first')
              return
            }
            await createPromptMutation.mutateAsync({ title: data.name, content: data.content, projectId })
          }
          setIsCreateDialogOpen(false)
          setSelectedPrompt(null)
        }}
      />

      {/* Import Dialog */}
      <MarkdownImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onSuccess={handleImportSuccess}
      />
    </div>
  )
}

// Prompt Card Component
interface PromptCardProps {
  prompt: Prompt
  isSelected?: boolean
  onToggleSelect?: (selected: boolean) => void
  onEdit: () => void
  onDelete: () => Promise<void>
  onExport?: () => Promise<void>
}

function PromptCard({ prompt, isSelected = false, onToggleSelect, onEdit, onDelete, onExport }: PromptCardProps) {
  const { copyToClipboard, status } = useCopyClipboard()
  const [isExporting, setIsExporting] = useState(false)

  const formatDate = (date: string | Date | number) => {
    try {
      return typeof date === 'string' ? new Date(date).toLocaleDateString() : new Date(date).toLocaleDateString()
    } catch (e) {
      return 'Invalid date'
    }
  }

  const tokenCount = estimateTokenCount(prompt.content)

  // Determine token count color based on size
  const getTokenCountClass = () => {
    if (tokenCount > 3000) return 'text-red-500'
    if (tokenCount > 1500) return 'text-yellow-500'
    return 'text-green-500'
  }

  const handleCopy = async () => {
    await copyToClipboard(prompt.content, {
      successMessage: `Copied "${prompt.title}" prompt content`,
      errorMessage: 'Failed to copy prompt content'
    })
  }

  const handleExport = async () => {
    if (onExport) {
      setIsExporting(true)
      try {
        await onExport()
      } finally {
        setIsExporting(false)
      }
    }
  }

  return (
    <Card className={`group ${isSelected ? 'ring-2 ring-primary' : ''}`}>
      <CardHeader>
        <div className='flex justify-between items-start'>
          <div className='flex items-start gap-2 flex-1'>
            {onToggleSelect && (
              <input
                type='checkbox'
                checked={isSelected}
                onChange={(e) => onToggleSelect(e.target.checked)}
                className='mt-1'
                onClick={(e) => e.stopPropagation()}
              />
            )}
            <CardTitle className='flex-1'>{prompt.title}</CardTitle>
          </div>
          <div className='flex items-center gap-2'>
            <span className={`text-xs ${getTokenCountClass()}`}>{formatTokenCount(tokenCount)} tokens</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='ghost' size='icon' className='h-8 w-8' onClick={(e) => e.stopPropagation()}>
                  <MoreVertical className='h-4 w-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuItem onClick={handleCopy}>
                  <Copy className='h-4 w-4 mr-2' />
                  Copy Content
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className='h-4 w-4 mr-2' />
                  Edit
                </DropdownMenuItem>
                {onExport && (
                  <DropdownMenuItem onClick={handleExport} disabled={isExporting}>
                    <Download className='h-4 w-4 mr-2' />
                    {isExporting ? 'Exporting...' : 'Export as Markdown'}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className='text-destructive'>
                  <Trash className='h-4 w-4 mr-2' />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <CardDescription>Created: {formatDate(prompt.createdAt)}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className='text-sm text-muted-foreground line-clamp-3'>{prompt.content}</p>
      </CardContent>
    </Card>
  )
}

interface PromptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  prompt: Prompt | null
  onSave: (data: { name: string; content: string }) => Promise<void>
}

function PromptDialog({ open, onOpenChange, prompt, onSave }: PromptDialogProps) {
  const [name, setName] = useState(prompt?.title ?? '')
  const [content, setContent] = useState(prompt?.content ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const tokenCount = useMemo(() => estimateTokenCount(content), [content])

  // Update form fields when prompt changes
  useMemo(() => {
    if (prompt) {
      setName(prompt.title || '')
      setContent(prompt.content || '')
    } else {
      setName('')
      setContent('')
    }
  }, [prompt])

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Prompt name is required')
      return
    }

    try {
      setIsSubmitting(true)
      await onSave({ name, content })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{prompt ? 'Edit Prompt' : 'Create New Prompt'}</DialogTitle>
        </DialogHeader>
        <div className='space-y-4'>
          <div>
            <label className='text-sm font-medium'>Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder='Enter prompt name...' />
          </div>
          <div>
            <div className='flex justify-between items-center mb-1'>
              <label className='text-sm font-medium'>Content</label>
              <span
                className={`text-xs ${tokenCount > 3000 ? 'text-red-500' : tokenCount > 1500 ? 'text-yellow-500' : 'text-green-500'}`}
              >
                {formatTokenCount(tokenCount)} tokens
              </span>
            </div>
            <ExpandableTextarea
              value={content}
              onChange={setContent}
              className='min-h-[200px]'
              placeholder='Enter prompt content...'
              title='Edit Prompt Content'
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : prompt ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export const Route = createFileRoute('/prompts')({
  component: PromptsPage
})
