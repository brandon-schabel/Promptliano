import { useState, useMemo } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import {
  Button,
  Card,
  Input,
  Textarea,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ScrollArea
} from '@promptliano/ui'
import { PlusIcon, Search, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  useResearchRecords,
  useStartResearch,
  useDeleteResearch,
  useExportDocument,
  useExecuteWorkflow,
  useResumeWorkflow
} from '@/hooks/api-hooks'
import { ResearchCard } from '@/components/deep-research/research-card'
import { CrawlConfigForm } from '@/components/deep-research/crawl-config-form'
import { deepResearchSearchSchema } from '@/lib/search-schemas'
import { PresetSelector, type ModelPreset } from '@/components/model-selection/preset-selector'
import { useModelConfigPresets } from '@/hooks/use-model-presets'

export const Route = createFileRoute('/deep-research')({
  validateSearch: zodValidator(deepResearchSearchSchema),
  component: DeepResearchPage
})

function DeepResearchPage() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const searchTerm = search.search || ''
  const selectedFilter = search.filter || 'all'

  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false)

  // Hooks
  const { data: researchRecords, isLoading } = useResearchRecords()
  const startResearch = useStartResearch()
  const deleteResearch = useDeleteResearch()
  const exportDocument = useExportDocument()
  const executeWorkflow = useExecuteWorkflow()
  const resumeWorkflow = useResumeWorkflow()

  // Model config presets
  const { presets, getPresetConfig, defaultPreset } = useModelConfigPresets()

  // New research form state
  const [newResearch, setNewResearch] = useState({
    topic: '',
    description: '',
    maxSources: 10,
    strategy: 'balanced' as 'fast' | 'balanced' | 'thorough',
    modelPreset: defaultPreset as ModelPreset,
    // Crawl config
    enableCrawling: false,
    crawlSeedUrl: '',
    crawlMaxDepth: 2,
    crawlMaxPages: 20,
    crawlRelevanceThreshold: 0.6
  })

  // Filter and search
  const filteredRecords = useMemo(() => {
    if (!researchRecords) return []

    let filtered = researchRecords

    // Apply status filter
    if (selectedFilter === 'active') {
      filtered = filtered.filter((r: any) =>
        ['initializing', 'gathering', 'processing', 'building'].includes(r.status)
      )
    } else if (selectedFilter === 'complete') {
      filtered = filtered.filter((r: any) => r.status === 'complete')
    }

    // Apply search
    if (searchTerm.trim()) {
      filtered = filtered.filter((r: any) =>
        r.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    return filtered.sort((a: any, b: any) => b.createdAt - a.createdAt)
  }, [researchRecords, searchTerm, selectedFilter])

  const handleCreateResearch = async () => {
    if (!newResearch.topic.trim()) {
      toast.error('Please enter a research topic')
      return
    }

    // Validate crawl config if enabled
    if (newResearch.enableCrawling && !newResearch.crawlSeedUrl.trim()) {
      toast.error('Please enter a seed URL for web crawling')
      return
    }

    try {
      // Get model config from selected preset
      const presetConfig = getPresetConfig(newResearch.modelPreset)
      const modelConfig = presetConfig ? {
        provider: presetConfig.provider,
        model: presetConfig.model,
        temperature: presetConfig.temperature ?? undefined,
        maxTokens: presetConfig.maxTokens ?? undefined
      } : undefined

      const research = await startResearch.mutateAsync({
        topic: newResearch.topic,
        description: newResearch.description,
        maxSources: newResearch.maxSources,
        strategy: newResearch.strategy,
        modelConfig,
        // Include crawl config
        enableCrawling: newResearch.enableCrawling,
        crawlSeedUrl: newResearch.enableCrawling ? newResearch.crawlSeedUrl : undefined,
        crawlMaxDepth: newResearch.enableCrawling ? newResearch.crawlMaxDepth : undefined,
        crawlMaxPages: newResearch.enableCrawling ? newResearch.crawlMaxPages : undefined,
        crawlRelevanceThreshold: newResearch.enableCrawling ? newResearch.crawlRelevanceThreshold : undefined
      })

      toast.success('Research session started')
      setCreateDialogOpen(false)
      setNewResearch({
        topic: '',
        description: '',
        maxSources: 10,
        strategy: 'balanced',
        modelPreset: defaultPreset as ModelPreset,
        enableCrawling: false,
        crawlSeedUrl: '',
        crawlMaxDepth: 2,
        crawlMaxPages: 20,
        crawlRelevanceThreshold: 0.6
      })

      // Navigate to research detail page when available
      // navigate({ to: `/deep-research/${research.id}` })
    } catch (error) {
      console.error('Failed to create research:', error)
      toast.error('Failed to start research')
    }
  }

  const handleDeleteResearch = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this research?')) return

    try {
      await deleteResearch.mutateAsync(id)
      toast.success('Research deleted')
    } catch (error) {
      console.error('Failed to delete research:', error)
      toast.error('Failed to delete research')
    }
  }

  const handleExport = async (id: number) => {
    try {
      await exportDocument.mutateAsync({
        researchId: id,
        format: 'markdown',
        includeToc: true,
        includeReferences: true
      })
      toast.success('Export started')
    } catch (error) {
      console.error('Failed to export:', error)
      toast.error('Failed to export document')
    }
  }

  const handleViewResearch = (id: number) => {
    navigate({ to: '/deep-research/$researchId', params: { researchId: String(id) } })
  }

  const handleExecute = async (id: number) => {
    try {
      await executeWorkflow.mutateAsync({ researchId: id })
    } catch (error) {
      console.error('Failed to execute workflow:', error)
    }
  }

  const handleResume = async (id: number) => {
    try {
      await resumeWorkflow.mutateAsync(id)
    } catch (error) {
      console.error('Failed to resume workflow:', error)
    }
  }

  const updateSearch = (value: string) => {
    navigate({
      to: '/deep-research',
      search: (prev: any) => ({ ...prev, search: value }),
      replace: true
    })
  }

  const updateFilter = (value: 'all' | 'active' | 'complete') => {
    navigate({
      to: '/deep-research',
      search: (prev: any) => ({ ...prev, filter: value }),
      replace: true
    })
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Deep Research</h1>
          <p className="text-muted-foreground mt-1">
            AI-powered comprehensive research and document generation
          </p>
        </div>

        <Button
          size="lg"
          onClick={() => setCreateDialogOpen(true)}
          className="gap-2 shadow-lg hover:shadow-xl transition-all"
        >
          <PlusIcon className="h-5 w-5" />
          New Research
        </Button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search research topics..."
            value={searchTerm}
            onChange={(e) => updateSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={selectedFilter} onValueChange={(v: any) => updateFilter(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Research</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="complete">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="mx-auto h-12 w-12 text-muted-foreground animate-spin mb-4" />
            <p className="text-muted-foreground">Loading research sessions...</p>
          </div>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Card className="p-8 max-w-md text-center">
            <FileText className="mx-auto h-16 w-16 text-muted-foreground mb-6" />
            <h3 className="text-xl font-semibold mb-2">
              {searchTerm.trim() ? 'No matching research' : 'No research sessions yet'}
            </h3>
            <p className="text-muted-foreground mb-6">
              {searchTerm.trim()
                ? 'Try adjusting your search terms'
                : 'Start your first research session to see it here'}
            </p>
            {!searchTerm.trim() && (
              <Button onClick={() => setCreateDialogOpen(true)}>
                <PlusIcon className="mr-2 h-4 w-4" />
                Create Your First Research
              </Button>
            )}
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRecords.map((research: any) => (
            <ResearchCard
              key={research.id}
              research={research}
              onView={handleViewResearch}
              onDelete={handleDeleteResearch}
              onExport={handleExport}
              onExecute={handleExecute}
              onResume={handleResume}
            />
          ))}
        </div>
      )}

      {/* Create Research Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Start New Research</DialogTitle>
            <DialogDescription>
              Create a new research session. AI will gather sources and build a comprehensive document.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-12rem)] pr-4">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Research Topic *</label>
                <Input
                  placeholder="e.g., The Impact of AI on Healthcare"
                  value={newResearch.topic}
                  onChange={(e) => setNewResearch({ ...newResearch, topic: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Description (Optional)</label>
                <Textarea
                  placeholder="Provide additional context or specific requirements..."
                  value={newResearch.description}
                  onChange={(e) => setNewResearch({ ...newResearch, description: e.target.value })}
                  className="min-h-[100px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Max Sources</label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={newResearch.maxSources}
                    onChange={(e) => setNewResearch({ ...newResearch, maxSources: parseInt(e.target.value) })}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Strategy</label>
                  <Select
                    value={newResearch.strategy}
                    onValueChange={(v: any) => setNewResearch({ ...newResearch, strategy: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fast">Fast</SelectItem>
                      <SelectItem value="balanced">Balanced</SelectItem>
                      <SelectItem value="thorough">Thorough</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">AI Model</label>
                <PresetSelector
                  value={newResearch.modelPreset}
                  onChange={(preset) => setNewResearch({ ...newResearch, modelPreset: preset })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Select the AI model tier for research generation
                </p>
              </div>

              {/* Web Crawling Configuration */}
              <CrawlConfigForm
                enabled={newResearch.enableCrawling}
                seedUrl={newResearch.crawlSeedUrl}
                maxDepth={newResearch.crawlMaxDepth}
                maxPages={newResearch.crawlMaxPages}
                relevanceThreshold={newResearch.crawlRelevanceThreshold}
                onEnabledChange={(enabled) => setNewResearch({ ...newResearch, enableCrawling: enabled })}
                onSeedUrlChange={(url) => setNewResearch({ ...newResearch, crawlSeedUrl: url })}
                onMaxDepthChange={(depth) => setNewResearch({ ...newResearch, crawlMaxDepth: depth })}
                onMaxPagesChange={(pages) => setNewResearch({ ...newResearch, crawlMaxPages: pages })}
                onRelevanceThresholdChange={(threshold) => setNewResearch({ ...newResearch, crawlRelevanceThreshold: threshold })}
              />
            </div>
          </ScrollArea>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateResearch} disabled={startResearch.isPending}>
              {startResearch.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Start Research
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
