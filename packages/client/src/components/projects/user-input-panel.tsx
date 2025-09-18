import { forwardRef, useState, useEffect, useRef, useImperativeHandle, useMemo } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@promptliano/ui'
import { ExpandableTextarea } from '@/components/expandable-textarea'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import { ShortcutDisplay } from '@/components/app-shortcut-display'
import { PromptlianoTooltip } from '@/components/promptliano/promptliano-tooltip'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@promptliano/ui'
import {
  useActiveProjectTab,
  useUpdateActiveProjectTab,
  useProjectTabField,
  useActiveChatId
} from '@/hooks/use-kv-local-storage'
import { useSelectedFiles } from '@/hooks/utility-hooks/use-selected-files'
import { SuggestedFilesDialog } from '../suggest-files-dialog'
import { SuggestedPromptsDialog, type SuggestedPromptWithScore } from '../suggest-prompts-dialog'
import { useCreateChat } from '@/hooks/generated'
import { useLocalStorage } from '@/hooks/utility-hooks/use-local-storage'
import { Binoculars, Bot, Copy, Check, MessageCircleCode, Search, Lightbulb } from 'lucide-react'
import {
  useSuggestFiles,
  useGetProjectPrompts,
  useSuggestPrompts,
  type SuggestPromptsHookResult,
  type SuggestPromptsScoreDebug
} from '@/hooks/api-hooks'
import { useApiClient } from '@/hooks/api/use-api-client'
import { useProjectFileTree } from '@/hooks/use-project-file-tree'
import { buildTreeStructure } from './file-panel/file-tree/file-tree'
import { ErrorBoundary } from '@/components/error-boundary/error-boundary'
import { ProjectFile, type Prompt } from '@promptliano/schemas'
import { buildPromptContent, calculateTotalTokens } from '@promptliano/shared/src/utils/projects-utils'

export type UserInputPanelRef = {
  focusPrompt: () => void
}

interface UserInputPanelProps {
  className?: string
}

// Utility function to format token count with abbreviations
function formatCompactTokenCount(count: number): string {
  if (count >= 1000000) {
    const millions = count / 1000000
    return millions >= 10 ? `${Math.floor(millions)}m` : `${millions.toFixed(1).replace(/\.0$/, '')}m`
  } else if (count >= 1000) {
    const thousands = count / 1000
    return thousands >= 10 ? `${Math.floor(thousands)}k` : `${thousands.toFixed(1).replace(/\.0$/, '')}k`
  }
  return count.toString()
}

export const UserInputPanel = forwardRef<UserInputPanelRef, UserInputPanelProps>(function UserInputPanel(
  { className },
  ref
) {
  const [activeProjectTabState, , activeProjectTabId] = useActiveProjectTab()
  const updateActiveProjectTab = useUpdateActiveProjectTab()

  const { data: selectedPrompts = [] } = useProjectTabField('selectedPrompts', activeProjectTabId ?? -1)
  const { data: globalUserPrompt = '' } = useProjectTabField('userPrompt', activeProjectTabId ?? -1)
  const [suggestedFiles, setSuggestedFiles] = useState<ProjectFile[]>([])
  const [suggestedPrompts, setSuggestedPrompts] = useState<SuggestedPromptWithScore[]>([])

  // Keep a local copy of userPrompt so that typing is instantly reflected in the textarea
  const [localUserPrompt, setLocalUserPrompt] = useState(globalUserPrompt)
  const createChatMutation = useCreateChat()
  const [, setInitialChatContent] = useLocalStorage('initial-chat-content', '')
  const [, setActiveChatId] = useActiveChatId()
  const navigate = useNavigate()

  const { copyToClipboard } = useCopyClipboard()
  const promptInputRef = useRef<HTMLTextAreaElement>(null)
  const findSuggestedFilesMutation = useSuggestFiles()
  const findSuggestedPromptsMutation = useSuggestPrompts()
  const apiClient = useApiClient()
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showPromptSuggestions, setShowPromptSuggestions] = useState(false)
  const [copyAllStatus, setCopyAllStatus] = useState<'idle' | 'copying' | 'success'>('idle')

  // Load the project's prompts
  const { data: promptData } = useGetProjectPrompts(activeProjectTabState?.selectedProjectId ?? -1)

  const projectPromptMap = useMemo(() => {
    if (!promptData) {
      return new Map<number, Prompt>()
    }
    return new Map<number, Prompt>(promptData.map((prompt) => [prompt.id, prompt]))
  }, [promptData])

  // Read selected files
  const { selectedFiles, projectFileMap } = useSelectedFiles()

  // Calculate total tokens
  const totalTokens = useMemo(() => {
    // Convert hook prompt format to expected format
    const prompts =
      promptData?.map((p) => ({
        id: p.id,
        title: p.title,
        content: p.content,
        description: null,
        projectId: p.projectId || -1,
        tags: [],
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      })) || []
    return calculateTotalTokens(prompts, selectedPrompts, localUserPrompt, selectedFiles, projectFileMap)
  }, [promptData, selectedPrompts, localUserPrompt, selectedFiles, projectFileMap])

  // Update localUserPrompt if global changes externally
  useEffect(() => {
    if (globalUserPrompt !== localUserPrompt) {
      setLocalUserPrompt(globalUserPrompt)
    }
  }, [globalUserPrompt])

  // Sync localUserPrompt back to the global store after a short delay
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localUserPrompt !== globalUserPrompt) {
        updateActiveProjectTab({ userPrompt: localUserPrompt })
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [localUserPrompt, globalUserPrompt])

  const buildFullProjectContext = () => {
    const finalUserPrompt = promptInputRef.current?.value ?? localUserPrompt

    if (!promptData) {
      return
    }

    // Convert hook prompt format to expected format
    const prompts =
      promptData?.map((p) => ({
        id: p.id,
        title: p.title,
        content: p.content,
        description: null,
        projectId: p.projectId || -1,
        tags: [],
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      })) || []

    return buildPromptContent({
      promptData: prompts,
      selectedPrompts,
      userPrompt: finalUserPrompt,
      selectedFiles,
      fileMap: projectFileMap
    })
  }

  const handleCopyAll = async () => {
    if (copyAllStatus === 'copying') return

    setCopyAllStatus('copying')

    try {
      await navigator.clipboard.writeText(buildFullProjectContext() ?? '')
      setCopyAllStatus('success')

      // Reset to idle after 2 seconds
      setTimeout(() => setCopyAllStatus('idle'), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
      setCopyAllStatus('idle')
      // Still use the toast for errors
      toast.error('Failed to copy to clipboard')
    }
  }

  const handleFindSuggestions = () => {
    // If localUserPrompt is empty, ask user to type something
    if (!localUserPrompt.trim()) {
      alert('Please enter a prompt!')
      return
    }
    findSuggestedFilesMutation.mutate(
      {
        projectId: activeProjectTabState?.selectedProjectId ?? -1,
        prompt: `Please find the relevant files for the following prompt: ${localUserPrompt}`,
        limit: 15
      },
      {
        onSuccess: (recommendedFiles) => {
          if (recommendedFiles && recommendedFiles.length > 0) {
            // recommendedFiles is already an array of ProjectFile objects
            setSuggestedFiles(recommendedFiles)
            setShowSuggestions(true)
          }
        }
      }
    )
  }

  const handleFindPromptSuggestions = async () => {
    if (!localUserPrompt.trim()) {
      alert('Please enter a prompt!')
      return
    }

    try {
      const result: SuggestPromptsHookResult = await findSuggestedPromptsMutation.mutateAsync({
        projectId: activeProjectTabState?.selectedProjectId ?? -1,
        userInput: localUserPrompt,
        limit: 5,
        includeScores: true
      })

      const promptEntries = Array.isArray(result?.prompts) ? result.prompts : []

      if (!promptEntries.length) {
        toast.info('No relevant prompts found for your input')
        return
      }

      const fallbackProjectId = activeProjectTabState?.selectedProjectId ?? -1

      const normalizePromptFromRemote = (raw: any): Prompt | undefined => {
        if (!raw || typeof raw !== 'object') return undefined
        const payload = (raw as any).data ?? raw
        const rawId = payload.id ?? payload.promptId
        const promptId = Number(rawId)
        if (!Number.isFinite(promptId)) return undefined

        return {
          id: promptId,
          title:
            typeof payload.title === 'string'
              ? payload.title
              : typeof payload.name === 'string'
                ? payload.name
                : `Prompt ${promptId}`,
          content: typeof payload.content === 'string' ? payload.content : '',
          description: typeof payload.description === 'string' ? payload.description : null,
          projectId: typeof payload.projectId === 'number' ? payload.projectId : fallbackProjectId,
          tags: Array.isArray(payload.tags)
            ? payload.tags.filter((tag: unknown): tag is string => typeof tag === 'string')
            : [],
          createdAt:
            typeof payload.createdAt === 'number'
              ? payload.createdAt
              : typeof payload.created === 'number'
                ? payload.created
                : Date.now(),
          updatedAt:
            typeof payload.updatedAt === 'number'
              ? payload.updatedAt
              : typeof payload.updated === 'number'
                ? payload.updated
                : Date.now()
        }
      }

      const scores = result?.debug?.scores || []
      const scoreMap = new Map<string, SuggestPromptsScoreDebug>()
      scores.forEach((score) => {
        if (!score) return
        scoreMap.set(String(score.promptId), score)
      })

      const parsedEntries: Array<{
        id: number | null
        prompt?: Prompt
        score?: SuggestPromptsScoreDebug
      }> = []
      const missingPromptIds = new Set<number>()

      for (const entry of promptEntries) {
        let promptId: number | null = null
        let promptDetails: Prompt | undefined

        if (typeof entry === 'number') {
          promptId = entry
        } else if (typeof entry === 'string') {
          const parsed = Number(entry)
          if (Number.isFinite(parsed)) {
            promptId = parsed
          }
        } else if (entry && typeof entry === 'object') {
          promptDetails = normalizePromptFromRemote(entry)
          const rawId = (entry as any).id ?? (entry as any).promptId
          const parsed = Number(rawId)
          if (Number.isFinite(parsed)) {
            promptId = parsed
          } else if (promptDetails) {
            promptId = promptDetails.id
          }
        }

        if (promptId !== null && !promptDetails) {
          promptDetails = projectPromptMap.get(promptId) ?? undefined
        }

        if (promptId !== null && !promptDetails) {
          missingPromptIds.add(promptId)
        }

        parsedEntries.push({
          id: promptId,
          prompt: promptDetails,
          score: promptId !== null ? scoreMap.get(String(promptId)) : undefined
        })
      }

      let fetchedPromptMap = new Map<number, Prompt>()
      if (missingPromptIds.size > 0 && apiClient) {
        const fetched = await Promise.all(
          [...missingPromptIds].map(async (id) => {
            try {
              const response = await apiClient.prompts.getPrompt(id)
              return normalizePromptFromRemote(response?.data ?? response)
            } catch (error) {
              console.warn('Failed to fetch prompt details for suggestion', id, error)
              return undefined
            }
          })
        )

        fetchedPromptMap = new Map(
          fetched
            .filter((prompt): prompt is Prompt => Boolean(prompt))
            .map((prompt) => [prompt.id, prompt])
        )
      }

      const suggestions = parsedEntries
        .map(({ id, prompt, score }) => {
          if (typeof id !== 'number') return null
          const resolvedPrompt = prompt ?? fetchedPromptMap.get(id) ?? projectPromptMap.get(id)
          if (!resolvedPrompt) return null
          return {
            prompt: resolvedPrompt,
            score
          }
        })
        .filter(Boolean) as SuggestedPromptWithScore[]

      if (!suggestions.length) {
        toast.info('No relevant prompts found for your input')
        return
      }

      setSuggestedPrompts(suggestions)
      setShowPromptSuggestions(true)

      if (
        missingPromptIds.size > 0 &&
        (!apiClient || fetchedPromptMap.size < missingPromptIds.size)
      ) {
        console.warn(
          'Missing prompt details for suggested prompts',
          [...missingPromptIds].filter((id) => !projectPromptMap.has(id) && !fetchedPromptMap.has(id))
        )
      }
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') {
        console.error('Failed to suggest prompts', error)
      }
    }
  }

  async function handleChatWithContext() {
    const defaultTitle = `New Chat ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    setInitialChatContent(buildFullProjectContext() ?? '')

    // without the timeout, the intial content doesn't get set before the navigation to the chat page
    setTimeout(async () => {
      try {
        const newChat = await createChatMutation.mutateAsync({
          title: defaultTitle
        })
        // Ensure newChat has an ID (adjust based on actual return type)
        const newChatId = newChat?.id // Type assertion might be needed
        if (newChatId) {
          setActiveChatId(newChatId)
          // navigate to the chat, where the chat page will load the initial content from local storage
          navigate({ to: '/chat' })

          toast.success('New chat created')
        } else {
          throw new Error('Created chat did not return an ID.')
        }
      } catch (error) {
        console.error('Error creating chat:', error)
        toast.error('Failed to create chat')
      }
    }, 10)
  }

  // Hotkey for copy
  useHotkeys('mod+shift+c', (e) => {
    e.preventDefault()
    handleCopyAll()
  })

  // Expose focus to parent
  useImperativeHandle(ref, () => ({
    focusPrompt() {
      promptInputRef.current?.focus()
    }
  }))

  const fileTree = useProjectFileTree()

  const tree = useMemo(() => {
    if (!fileTree || typeof fileTree !== 'object' || Object.keys(fileTree).length === 0) {
      return 'File tree structure not available.'
    }
    const outputLines: string[] = []
    const rootEntries = Object.entries(fileTree)

    for (const [name, nodeValue] of rootEntries) {
      outputLines.push(name)
      const node = nodeValue as any // Assuming nodeValue is FileNode-like
      if (node && typeof node === 'object' && node._folder && node.children) {
        const childrenTree = buildTreeStructure(node, '  ')
        if (childrenTree) {
          outputLines.push(childrenTree)
        }
      }
    }
    return outputLines.join('\n')
  }, [fileTree])

  return (
    <ErrorBoundary>
      <TooltipProvider>
        <div className={cn('flex flex-col h-full overflow-hidden p-4', className)}>
          <SuggestedFilesDialog
            open={showSuggestions}
            onClose={() => setShowSuggestions(false)}
            suggestedFiles={suggestedFiles}
          />
          <SuggestedPromptsDialog
            open={showPromptSuggestions}
            onClose={() => setShowPromptSuggestions(false)}
            suggestedPrompts={suggestedPrompts}
          />

          <div className='flex-1 flex flex-col min-h-0'>
            <div className='flex items-center gap-2 mb-2 shrink-0'>
              <span className='text-sm font-medium'>User Input</span>
              <PromptlianoTooltip>
                <div className='space-y-2'>
                  <p>Shortcuts:</p>
                  <ul>
                    <li>
                      - <span className='font-medium'>Copy All:</span>{' '}
                      <ShortcutDisplay shortcut={['mod', 'shift', 'c']} />
                    </li>
                  </ul>
                </div>
              </PromptlianoTooltip>
              <div className='ml-auto text-xs text-muted-foreground'>
                {formatCompactTokenCount(totalTokens)} tokens in context
              </div>
            </div>

            <div className='flex-1 min-h-0 flex flex-col'>
              <ExpandableTextarea
                ref={promptInputRef}
                placeholder='Type your user prompt here...'
                value={localUserPrompt}
                onChange={(val) => setLocalUserPrompt(val)}
                className='flex-1 min-h-0 bg-background'
              />

              <div className='flex gap-2 mt-3 shrink-0 flex-wrap'>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleCopyAll}
                      size='sm'
                      disabled={copyAllStatus === 'copying'}
                      className='transition-colors duration-200 w-[100px]'
                    >
                      <div className='flex items-center justify-center w-full'>
                        {copyAllStatus === 'success' ? (
                          <>
                            <Check className='h-3.5 w-3.5 mr-1 text-green-500 animate-in zoom-in-50 duration-200' />
                            <span className='text-green-600 dark:text-green-400'>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className='h-3.5 w-3.5 mr-1 transition-all duration-200' />
                            <span>Copy All</span>
                          </>
                        )}
                      </div>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Copy all context (User Input + Selected Prompts + Selected Files) to clipboard.
                      <ShortcutDisplay shortcut={['mod', 'shift', 'c']} variant='secondary' />
                    </p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={handleFindSuggestions} disabled={findSuggestedFilesMutation.isPending} size='sm'>
                      {findSuggestedFilesMutation.isPending ? (
                        <>
                          <Binoculars className='h-3.5 w-3.5 mr-1 animate-spin' />
                          Finding...
                        </>
                      ) : (
                        <>
                          <Search className='h-3.5 w-3.5 mr-1' />
                          Files
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Suggest relevant files based on your user input and project context.</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleFindPromptSuggestions}
                      disabled={findSuggestedPromptsMutation.isPending}
                      size='sm'
                    >
                      {findSuggestedPromptsMutation.isPending ? (
                        <>
                          <Lightbulb className='h-3.5 w-3.5 mr-1 animate-pulse' />
                          Finding...
                        </>
                      ) : (
                        <>
                          <Lightbulb className='h-3.5 w-3.5 mr-1' />
                          Prompts
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Suggest relevant saved prompts based on your user input and project context.</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={handleChatWithContext} size='sm'>
                      <MessageCircleCode className='h-3.5 w-3.5 mr-1' /> Chat
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Start a new chat session with the current context. This includes user input, selected prompts, and
                      selected files.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
      </TooltipProvider>
    </ErrorBoundary>
  )
})
