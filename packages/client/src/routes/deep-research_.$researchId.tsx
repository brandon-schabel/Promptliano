import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { useState } from 'react'
import {
  useResearchRecord,
  useResearchProgress,
  useResearchSources,
  useResearchSections,
  useAddSource,
  useProcessSource,
  useGenerateOutline,
  useBuildSection,
  useUpdateResearch,
  useExecuteWorkflow,
  useResumeWorkflow,
  useStopWorkflow,
  useWorkflowStatus,
  useCrawlProgress
} from '@/hooks/api-hooks'
import { Tabs, TabsContent, TabsList, TabsTrigger, Button, Badge, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from '@promptliano/ui'
import { ArrowLeft, Download, Loader2, Plus, PlayCircle, FileText, Sparkles, Edit2, Check, X, Eye } from 'lucide-react'
import { ResearchProgressPanel } from '@/components/deep-research/research-progress-panel'
import { CrawlProgressDisplay } from '@/components/deep-research/crawl-progress-display'
import { CrawlDebugPanel } from '@/components/deep-research/crawl-debug-panel'
import { SourceDetailsModal } from '@/components/deep-research/source-details-modal'
import { deepResearchDetailSearchSchema } from '@/lib/search-schemas'
import type { ResearchSource, ResearchDocumentSection } from '@promptliano/database'

export const Route = createFileRoute('/deep-research_/$researchId')({
  validateSearch: zodValidator(deepResearchDetailSearchSchema),
  component: ResearchDetailPage
})

function ResearchDetailPage() {
  const { researchId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const numericResearchId = Number(researchId)

  // State for adding sources
  const [newSourceUrl, setNewSourceUrl] = useState('')
  const [sourceType, setSourceType] = useState<'web' | 'pdf' | 'academic' | 'api'>('web')

  // State for editing research metadata
  const [isEditing, setIsEditing] = useState(false)
  const [editedTopic, setEditedTopic] = useState('')
  const [editedDescription, setEditedDescription] = useState('')

  // State for source details modal
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null)
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false)

  // Fetch data with polling for progress
  const { data: research, isLoading: isLoadingResearch } = useResearchRecord(numericResearchId)
  const { data: progress, isLoading: isLoadingProgress } = useResearchProgress(numericResearchId)
  const { data: sources } = useResearchSources(numericResearchId)
  const { data: sections } = useResearchSections(numericResearchId)
  const { data: workflowStatus } = useWorkflowStatus(numericResearchId)
  const { data: crawlProgress } = useCrawlProgress(numericResearchId)

  // Mutations
  const addSource = useAddSource()
  const processSource = useProcessSource()
  const generateOutline = useGenerateOutline()
  const buildSection = useBuildSection()
  const updateResearch = useUpdateResearch()
  const executeWorkflow = useExecuteWorkflow()
  const resumeWorkflow = useResumeWorkflow()
  const stopWorkflow = useStopWorkflow()

  const currentTab = search.tab || 'overview'

  const handleAddSource = async () => {
    if (!newSourceUrl.trim()) return

    await addSource.mutateAsync({
      researchId: numericResearchId,
      url: newSourceUrl,
      sourceType
    })

    setNewSourceUrl('')
  }

  const handleProcessSource = async (sourceId: number) => {
    await processSource.mutateAsync(sourceId)
  }

  const handleGenerateOutline = async () => {
    await generateOutline.mutateAsync({
      researchId: numericResearchId,
      sectionsCount: 8,
      depth: 2
    })
  }

  const handleBuildSection = async (sectionId: number) => {
    await buildSection.mutateAsync({
      sectionId
    })
  }

  const handleStartEdit = () => {
    if (!researchData) return
    setEditedTopic(researchData.topic)
    setEditedDescription(researchData.description || '')
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditedTopic('')
    setEditedDescription('')
  }

  const handleSaveEdit = async () => {
    if (!editedTopic.trim()) return

    await updateResearch.mutateAsync({
      id: numericResearchId,
      data: {
        topic: editedTopic,
        description: editedDescription || undefined
      }
    })

    setIsEditing(false)
  }

  const handleExecuteWorkflow = async () => {
    await executeWorkflow.mutateAsync({
      researchId: numericResearchId
    })
  }

  const handleResumeWorkflow = async () => {
    await resumeWorkflow.mutateAsync(numericResearchId)
  }

  const handleStopWorkflow = async () => {
    if (!window.confirm('Stop automatic execution? You can resume it later.')) return
    await stopWorkflow.mutateAsync(numericResearchId)
  }

  const handleViewSourceDetails = (sourceId: number) => {
    setSelectedSourceId(sourceId)
    setIsSourceModalOpen(true)
  }

  const handleCloseSourceModal = () => {
    setIsSourceModalOpen(false)
    setSelectedSourceId(null)
  }

  const handleTabChange = (tab: string) => {
    // Validate tab value at runtime
    const validTabs = ['overview', 'sources', 'sections', 'document'] as const
    const validatedTab = validTabs.includes(tab as any) ? tab : 'overview'

    navigate({
      to: '/deep-research/$researchId',
      params: { researchId },
      search: { tab: validatedTab as any }, // Validated but still needs cast for TanStack Router
      replace: true
    })
  }

  const handleBack = () => {
    navigate({ to: '/deep-research' })
  }

  if (isLoadingResearch) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!research?.data) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Research
        </Button>
        <div className="text-center mt-8">Research not found</div>
      </div>
    )
  }

  const researchData = research.data
  const progressData = progress?.data

  // Check if research can be edited (not actively running or completed)
  const canEdit = researchData.status === 'initializing' || researchData.status === 'failed'

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Breadcrumb navigation */}
      <Button variant="ghost" onClick={handleBack} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Research
      </Button>

      {/* Hero Summary */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="space-y-3">
                <Input
                  value={editedTopic}
                  onChange={(e) => setEditedTopic(e.target.value)}
                  placeholder="Research topic"
                  className="text-2xl font-bold h-12"
                  autoFocus
                />
                <Textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  placeholder="Description (optional)"
                  className="min-h-[80px]"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={!editedTopic.trim() || updateResearch.isPending}
                  >
                    {updateResearch.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 h-4 w-4" />
                    )}
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelEdit}
                    disabled={updateResearch.isPending}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold tracking-tight">{researchData.topic}</h1>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleStartEdit}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {researchData.description && (
                  <p className="text-muted-foreground mt-2">{researchData.description}</p>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {canEdit && !isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartEdit}
              >
                <Edit2 className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}

            {/* Execute Workflow Button - Show when can execute */}
            {workflowStatus?.data?.canExecute && (
              <Button
                onClick={handleExecuteWorkflow}
                disabled={executeWorkflow.isPending}
                variant="default"
                size="sm"
              >
                {executeWorkflow.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <PlayCircle className="mr-2 h-4 w-4" />
                Start Research
              </Button>
            )}

            {/* Resume Button - Show when can resume */}
            {workflowStatus?.data?.canResume && researchData.status === 'failed' && (
              <Button
                onClick={handleResumeWorkflow}
                disabled={resumeWorkflow.isPending}
                variant="default"
                size="sm"
              >
                {resumeWorkflow.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <PlayCircle className="mr-2 h-4 w-4" />
                Resume
              </Button>
            )}

            {/* Stop Button - Show when can stop */}
            {workflowStatus?.data?.canStop && (
              <Button
                onClick={handleStopWorkflow}
                disabled={stopWorkflow.isPending}
                variant="outline"
                size="sm"
              >
                {stopWorkflow.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <X className="mr-2 h-4 w-4" />
                Stop
              </Button>
            )}

            <Badge variant={researchData.status === 'complete' ? 'default' : 'secondary'}>
              {researchData.status}
            </Badge>
          </div>
        </div>

        {/* Progress Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Research Progress Panel */}
          {progressData && (
            <ResearchProgressPanel
              researchId={numericResearchId}
              status={progressData.status}
              progress={progressData.progress}
              currentPhase={progressData.currentPhase}
              estimatedTimeRemaining={progressData.estimatedTimeRemaining}
            />
          )}

          {/* Crawl Progress Panel - Only shown if crawling is enabled */}
          {crawlProgress?.data?.crawlEnabled && (
            <CrawlProgressDisplay researchId={numericResearchId} />
          )}
        </div>
      </div>

      {/* Tabbed Content */}
      <Tabs value={currentTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
          <TabsTrigger value="document">Document</TabsTrigger>
          {crawlProgress?.data?.crawlEnabled && (
            <TabsTrigger value="debug">Debug</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Research Overview</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Total Sources</div>
                <div className="text-2xl font-bold">{progressData?.progress.totalSources || 0}</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Sections</div>
                <div className="text-2xl font-bold">{progressData?.progress.sectionsTotal || 0}</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Strategy</div>
                <div className="text-2xl font-bold capitalize">{researchData.strategy}</div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sources">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Sources</h2>
              {sources?.data && sources.data.length > 0 && (
                <Button
                  onClick={handleGenerateOutline}
                  disabled={generateOutline.isPending || sources.data.some((s: ResearchSource) => s.status !== 'complete')}
                  variant="default"
                >
                  {generateOutline.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Outline
                </Button>
              )}
            </div>

            {/* Add Source Form */}
            <div className="flex gap-2 p-4 border rounded-lg bg-muted/30">
              <Input
                placeholder="Enter source URL (e.g., https://example.com/article)"
                value={newSourceUrl}
                onChange={(e) => setNewSourceUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSource()}
                className="flex-1"
              />
              <Select value={sourceType} onValueChange={(v: any) => setSourceType(v)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="web">Web</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="academic">Academic</SelectItem>
                  <SelectItem value="api">API</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handleAddSource}
                disabled={!newSourceUrl.trim() || addSource.isPending}
              >
                {addSource.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Sources List */}
            {sources?.data && sources.data.length > 0 ? (
              <div className="space-y-2">
                {sources.data.map((source: ResearchSource) => (
                  <div key={source.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline break-all"
                        >
                          {source.title || source.url}
                        </a>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge
                            variant={
                              source.status === 'complete' ? 'default' :
                              source.status === 'failed' ? 'destructive' :
                              source.status === 'pending' ? 'secondary' :
                              'outline'
                            }
                          >
                            {source.status}
                          </Badge>
                          <Badge variant="outline">{source.sourceType}</Badge>
                          {source.tokenCount && (
                            <span className="text-xs text-muted-foreground">
                              {source.tokenCount.toLocaleString()} tokens
                            </span>
                          )}
                        </div>
                        {source.errorMessage && (
                          <div className="text-sm text-destructive mt-2">
                            Error: {source.errorMessage}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {source.status === 'complete' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewSourceDetails(source.id)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View Details
                          </Button>
                        )}
                        {source.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleProcessSource(source.id)}
                            disabled={processSource.isPending}
                          >
                            {processSource.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <PlayCircle className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        {source.status === 'failed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleProcessSource(source.id)}
                            disabled={processSource.isPending}
                          >
                            Retry
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8 border rounded-lg">
                <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No sources added yet</p>
                <p className="text-sm mt-2">Add source URLs above to begin research</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="sections">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Document Sections</h2>
            {sections?.data && sections.data.length > 0 ? (
              <div className="space-y-2">
                {sections.data.map((section: ResearchDocumentSection) => (
                  <div key={section.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{section.title}</h3>
                          <Badge
                            variant={
                              section.status === 'complete' ? 'default' :
                              section.status === 'drafting' ? 'secondary' :
                              'outline'
                            }
                          >
                            {section.status}
                          </Badge>
                        </div>
                        {section.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {section.description}
                          </p>
                        )}
                        {section.content && (
                          <div className="mt-2 text-sm text-muted-foreground">
                            {section.wordCount || 0} words
                            {section.tokenCount && ` • ${section.tokenCount} tokens`}
                          </div>
                        )}
                      </div>
                      <div>
                        {section.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleBuildSection(section.id)}
                            disabled={buildSection.isPending}
                          >
                            {buildSection.isPending ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Sparkles className="mr-2 h-4 w-4" />
                            )}
                            Build Section
                          </Button>
                        )}
                      </div>
                    </div>
                    {section.content && (
                      <div className="mt-4 p-3 bg-muted/30 rounded text-sm max-h-48 overflow-y-auto">
                        <pre className="whitespace-pre-wrap font-sans">{section.content}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8 border rounded-lg">
                <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No sections generated yet</p>
                <p className="text-sm mt-2">Add sources and generate an outline first</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="document">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Full Document</h2>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
            <div className="prose max-w-none p-6 border rounded-lg">
              <p className="text-muted-foreground">
                Document preview will be available when research is complete
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="debug">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Web Crawling Debug</h2>
              <Badge variant="outline">Real-time Monitoring</Badge>
            </div>
            <CrawlDebugPanel researchId={numericResearchId} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Source Details Modal */}
      <SourceDetailsModal
        sourceId={selectedSourceId}
        isOpen={isSourceModalOpen}
        onClose={handleCloseSourceModal}
      />
    </div>
  )
}
