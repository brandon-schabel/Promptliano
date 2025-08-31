import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Badge,
  Input,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  AnimateOnScroll,
  GlassCard,
  ComponentErrorBoundary,
  cn,
  Alert,
  AlertDescription,
  AlertTitle,
  ScrollArea
} from '@promptliano/ui'
import {
  Activity,
  AlertCircle,
  Check,
  ChevronRight,
  Cloud,
  Database,
  ExternalLink,
  Key,
  Loader2,
  Monitor,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  TestTube,
  Trash2,
  Wifi,
  WifiOff,
  X,
  Zap
} from 'lucide-react'
import {
  useGetProviderKeys,
  useGetProvidersHealth,
  useCreateProviderKey,
  useUpdateProviderKey,
  useDeleteProviderKey,
  useTestProvider,
  useBatchTestProviders
} from '@/hooks/generated'
import { PROVIDERS } from '@/constants/providers-constants'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import type { CreateProviderKey } from '@promptliano/database'
import type { ProviderKey } from '@/hooks/generated/providers-hooks'

// Health status interface based on API response
interface ProviderHealthStatusWithProvider {
  provider: string
  status: 'healthy' | 'degraded' | 'down' | 'unhealthy' | 'unknown'
  latency?: number
  averageResponseTime?: number
  modelCount?: number
  lastChecked: number
  error?: string
}

// Actual API response structure (the data array may not include provider field)
interface ProviderHealthStatus {
  status: 'healthy' | 'degraded' | 'down' | 'unhealthy' | 'unknown'
  latency?: number
  averageResponseTime?: number
  modelCount?: number
  lastChecked: number
  error?: string
  provider?: string
}
import { LocalProviderSection } from '@/components/providers/local-provider-section'
import { ProviderCard } from '@/components/providers/provider-card'
import { ProviderTestDialog } from '@/components/providers/provider-test-dialog'
import { CustomProviderDialog } from '@/components/providers/custom-provider-dialog'
import { ModelPresetConfigurator } from '@/components/providers/model-preset-configurator'
import { useLocalModelStatus } from '@/hooks/use-local-model-status'
import { useAppSettings } from '@/hooks/use-kv-local-storage'
// Encryption UI removed; provider keys use secretRef only

// Form schema for adding/editing provider
const providerFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  provider: z.string().min(1, 'Provider is required'),
  secretRef: z.string().min(1, 'Secret reference is required'),
  isDefault: z.boolean().default(false)
})

type ProviderFormValues = z.infer<typeof providerFormSchema>

function ProvidersPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'api' | 'local' | 'presets'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isCustomProviderDialogOpen, setIsCustomProviderDialogOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<ProviderKey | null>(null)
  const [deletingProvider, setDeletingProvider] = useState<ProviderKey | null>(null)
  const [testingProvider, setTestingProvider] = useState<ProviderKey | null>(null)
  const [testingProviders, setTestingProviders] = useState<Set<number>>(new Set())
  // Encryption key configuration removed

  // API Hooks
  const { data: providersData, isLoading: isLoadingProviders } = useGetProviderKeys()
  const { data: healthData, isLoading: isLoadingHealth, refetch: refetchHealth } = useGetProvidersHealth()
  const createMutation = useCreateProviderKey()
  const updateMutation = useUpdateProviderKey()
  const deleteMutation = useDeleteProviderKey()
  const testMutation = useTestProvider()
  const batchTestMutation = useBatchTestProviders()

  const providers = providersData || []
  const healthStatuses: ProviderHealthStatus[] = healthData?.data || []

  // Local provider hooks
  const [appSettings] = useAppSettings()
  const ollamaUrl = appSettings.ollamaGlobalUrl || 'http://localhost:11434'
  const lmstudioUrl = appSettings.lmStudioGlobalUrl || 'http://localhost:1234'
  const ollamaStatus = useLocalModelStatus('ollama', { url: ollamaUrl })
  const lmstudioStatus = useLocalModelStatus('lmstudio', { url: lmstudioUrl })

  // Filter providers based on tab and search
  const filteredProviders = useMemo(() => {
    let filtered = providers

    // Filter by tab
    if (activeTab === 'api') {
      filtered = filtered.filter((p: ProviderKey) => !PROVIDERS.find((prov) => prov.id === p.provider)?.isLocal)
    } else if (activeTab === 'local') {
      filtered = filtered.filter((p: ProviderKey) => PROVIDERS.find((prov) => prov.id === p.provider)?.isLocal)
    }

    // Filter by search
    if (searchQuery) {
      filtered = filtered.filter(
        (p: ProviderKey) =>
          p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.provider.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    return filtered
  }, [providers, activeTab, searchQuery])

  // Get provider metadata
  const getProviderMeta = (providerId: string) => {
    return PROVIDERS.find((p) => p.id === providerId)
  }

  // Render API Provider Cards
  const renderApiProviders = (providersToRender: ProviderKey[]) => {
    if (isLoadingProviders) {
      return (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className='h-[200px]' />
          ))}
        </div>
      )
    }

    if (providersToRender.length === 0) {
      return (
        <AnimateOnScroll>
          <Card className='border-dashed'>
            <CardContent className='flex flex-col items-center justify-center py-12'>
              <div className='rounded-full bg-muted p-3 mb-4'>
                <Key className='h-6 w-6 text-muted-foreground' />
              </div>
              <h3 className='text-lg font-semibold mb-2'>No providers found</h3>
              <p className='text-muted-foreground text-center mb-4'>
                {searchQuery ? 'No providers match your search criteria' : 'Get started by adding your first provider'}
              </p>
              {!searchQuery && (
                <Button onClick={() => setIsAddDialogOpen(true)} className='gap-2'>
                  <Plus className='h-4 w-4' />
                  Add Provider
                </Button>
              )}
            </CardContent>
          </Card>
        </AnimateOnScroll>
      )
    }

    return (
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
        {providersToRender.map((provider) => {
          const meta = getProviderMeta(provider.provider)
          const health = getHealthStatus(provider.provider)
          const isTesting = testingProviders.has(provider.id)

          return (
            <ProviderCard
              key={provider.id}
              provider={provider}
              health={health}
              meta={meta}
              onTest={() => handleTestConnection(provider)}
              onEdit={() => openEditDialog(provider)}
              onDelete={() => setDeletingProvider(provider)}
              isTesting={isTesting}
            />
          )
        })}
      </div>
    )
  }

  // Get health status for a provider (assuming index-based mapping or different API structure)
  const getHealthStatus = (providerId: string) => {
    // This would need to be updated based on actual API structure
    // For now, return the first status as placeholder
    return healthStatuses[0] || null
  }

  // Get stats
  const stats = useMemo(() => {
    // Database providers (cloud APIs that have been configured)
    const dbProviders = providers.filter((p: ProviderKey) => !getProviderMeta(p.provider)?.isLocal)

    // Count of healthy database providers
    const dbConnectedCount = healthStatuses.filter((h: ProviderHealthStatus) => h.status === 'healthy').length

    // Local providers are always 2 (Ollama and LMStudio are built-in)
    const localProviderCount = 2

    // Check local provider connection status
    const ollamaConnected = ollamaStatus.isConnected ? 1 : 0
    const lmstudioConnected = lmstudioStatus.isConnected ? 1 : 0
    const localConnectedCount = ollamaConnected + lmstudioConnected

    // Total counts
    const totalProviders = dbProviders.length + localProviderCount
    const totalConnected = dbConnectedCount + localConnectedCount

    return {
      total: totalProviders,
      api: dbProviders.length,
      local: localProviderCount,
      connected: totalConnected,
      disconnected: totalProviders - totalConnected
    }
  }, [providers, healthStatuses, ollamaStatus.isConnected, lmstudioStatus.isConnected])

  // Form setup
  const form = useForm<ProviderFormValues>({
    resolver: zodResolver(providerFormSchema),
    defaultValues: {
      name: '',
      provider: '',
      secretRef: '',
      isDefault: false
    }
  })

  // Handle test connection
  const handleTestConnection = (provider: ProviderKey) => {
    setTestingProvider(provider)
  }

  // Handle test all connections
  const handleTestAllConnections = async () => {
    const providerRequests = providers.map((p: ProviderKey) => ({
      provider: p.provider,
      timeout: 30000
    }))
    await batchTestMutation.mutateAsync({
      providerIds: providers.map((p: ProviderKey) => p.id),
      testPrompt: 'Hello',
      includeInactive: false
    })
  }

  // Handle form submit
  const handleSubmit = async (values: ProviderFormValues) => {
    try {
      if (editingProvider) {
        // TODO: Fix mutation call when hook is properly typed
        // await updateMutation.mutateAsync({ keyId: editingProvider.id, ...values })
        console.log('Provider update not implemented yet')
      } else {
        await createMutation.mutateAsync({
          provider: values.provider,
          keyName: values.name,
          secretRef: values.secretRef,
          isDefault: values.isDefault
        })
      }
      setIsAddDialogOpen(false)
      setEditingProvider(null)
      form.reset()
    } catch (error) {
      // Error is handled by mutation
    }
  }

  // Handle delete
  const handleDelete = async () => {
    if (!deletingProvider) return
    try {
      await deleteMutation.mutateAsync(deletingProvider.id)
      setDeletingProvider(null)
    } catch (error) {
      // Error is handled by mutation
    }
  }

  // Open edit dialog
  const openEditDialog = (provider: ProviderKey) => {
    setEditingProvider(provider)
    form.reset({
      name: provider.name || '',
      provider: provider.provider,
      secretRef: (provider as any).secretRef || '',
      isDefault: provider.isDefault
    })
    setIsAddDialogOpen(true)
  }

  return (
    <ComponentErrorBoundary componentName='ProvidersPage'>
      <TooltipProvider>
        <div className='flex flex-col h-full w-full overflow-hidden bg-gradient-to-br from-background via-background to-muted/20'>
          {/* Animated Header */}
          <div className='relative overflow-hidden border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent'>
            <div className='absolute inset-0 bg-grid-white/[0.02] bg-[size:20px_20px]' />
            <AnimateOnScroll>
              <div className='relative px-6 py-8'>
                <div className='flex items-start justify-between'>
                  <div className='space-y-1'>
                    <h1 className='text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent'>
                      Provider Management
                    </h1>
                    <p className='text-muted-foreground'>Configure and manage your AI provider connections</p>
                  </div>
                  <div className='flex gap-2'>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant='outline'
                          size='icon'
                          onClick={() => refetchHealth()}
                          disabled={isLoadingHealth}
                        >
                          {isLoadingHealth ? (
                            <Loader2 className='h-4 w-4 animate-spin' />
                          ) : (
                            <RefreshCw className='h-4 w-4' />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Refresh provider status</TooltipContent>
                    </Tooltip>
                    <Button onClick={() => setIsAddDialogOpen(true)} className='gap-2'>
                      <Plus className='h-4 w-4' />
                      Add Provider
                    </Button>
                  </div>
                </div>

                {/* Stats Cards */}
                <div className='mt-6 grid grid-cols-5 gap-4'>
                  {[
                    { label: 'Total Providers', value: stats.total, icon: Database, color: 'text-blue-500' },
                    { label: 'API Providers', value: stats.api, icon: Cloud, color: 'text-purple-500' },
                    { label: 'Local Providers', value: stats.local, icon: Monitor, color: 'text-orange-500' },
                    { label: 'Connected', value: stats.connected, icon: Wifi, color: 'text-green-500' },
                    { label: 'Disconnected', value: stats.disconnected, icon: WifiOff, color: 'text-red-500' }
                  ].map((stat, index) => (
                    <AnimateOnScroll key={stat.label} delay={index * 100}>
                      <GlassCard className='relative overflow-hidden'>
                        <div className='absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent' />
                        <CardContent className='relative p-4'>
                          <div className='flex items-center justify-between'>
                            <div>
                              <p className='text-xs text-muted-foreground'>{stat.label}</p>
                              <p className='text-2xl font-bold mt-1'>{stat.value}</p>
                            </div>
                            <stat.icon className={cn('h-8 w-8 opacity-50', stat.color)} />
                          </div>
                        </CardContent>
                      </GlassCard>
                    </AnimateOnScroll>
                  ))}
                </div>
              </div>
            </AnimateOnScroll>
          </div>

          {/* Main Content */}
          <div className='flex-1 overflow-hidden'>
            <div className='h-full p-6'>
              <div className='flex flex-col gap-6 h-full'>
                {/* Encryption key notice removed */}
                {/* Search and Tabs */}
                <div className='flex items-center justify-between gap-4'>
                  <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className='w-auto'>
                    <TabsList className='grid grid-cols-4 w-[550px]'>
                      <TabsTrigger value='all' className='gap-2'>
                        <Sparkles className='h-4 w-4' />
                        All Providers
                      </TabsTrigger>
                      <TabsTrigger value='api' className='gap-2'>
                        <Cloud className='h-4 w-4' />
                        API Providers
                      </TabsTrigger>
                      <TabsTrigger value='local' className='gap-2'>
                        <Monitor className='h-4 w-4' />
                        Local Providers
                      </TabsTrigger>
                      <TabsTrigger value='presets' className='gap-2'>
                        <Settings className='h-4 w-4' />
                        Model Presets
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>

                  <div className='flex items-center gap-2'>
                    <div className='relative'>
                      <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                      <Input
                        placeholder='Search providers...'
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className='pl-9 w-[300px]'
                      />
                    </div>
                    {/* Encryption config button removed */}
                    {providers.length > 0 && (
                      <Button
                        variant='outline'
                        onClick={handleTestAllConnections}
                        disabled={batchTestMutation.isPending}
                        className='gap-2'
                      >
                        {batchTestMutation.isPending ? (
                          <Loader2 className='h-4 w-4 animate-spin' />
                        ) : (
                          <TestTube className='h-4 w-4' />
                        )}
                        Test All
                      </Button>
                    )}
                  </div>
                </div>

                {/* Content based on active tab */}
                <ScrollArea className='flex-1'>
                  {activeTab === 'all' && (
                    <div className='space-y-6'>
                      {/* Local Providers Section */}
                      <LocalProviderSection
                        providers={providers.filter(
                          (p: ProviderKey) =>
                            PROVIDERS.find((prov) => prov.id === p.provider)?.isLocal &&
                            (searchQuery
                              ? p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                p.provider.toLowerCase().includes(searchQuery.toLowerCase())
                              : true)
                        )}
                        onEdit={openEditDialog}
                        isLoading={isLoadingProviders}
                      />

                      {/* Separator */}
                      <div className='relative'>
                        <div className='absolute inset-0 flex items-center'>
                          <div className='w-full border-t' />
                        </div>
                        <div className='relative flex justify-center text-xs uppercase'>
                          <span className='bg-background px-2 text-muted-foreground'>Cloud Providers</span>
                        </div>
                      </div>

                      {/* API Providers Section */}
                      {renderApiProviders(
                        providers.filter(
                          (p: ProviderKey) =>
                            !PROVIDERS.find((prov) => prov.id === p.provider)?.isLocal &&
                            (searchQuery
                              ? p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                p.provider.toLowerCase().includes(searchQuery.toLowerCase())
                              : true)
                        )
                      )}
                    </div>
                  )}

                  {activeTab === 'local' && (
                    <LocalProviderSection
                      providers={filteredProviders}
                      onEdit={openEditDialog}
                      isLoading={isLoadingProviders}
                    />
                  )}

                  {activeTab === 'api' && renderApiProviders(filteredProviders)}

                  {activeTab === 'presets' && (
                    <div className='pb-6'>
                      <ModelPresetConfigurator />
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          </div>

          {/* Add/Edit Dialog */}
          <Dialog
            open={isAddDialogOpen}
            onOpenChange={(open) => {
              setIsAddDialogOpen(open)
              if (!open) {
                setEditingProvider(null)
                form.reset()
              }
            }}
          >
            <DialogContent className='sm:max-w-[500px]'>
              <DialogHeader>
                <DialogTitle>{editingProvider ? 'Edit Provider' : 'Add Provider'}</DialogTitle>
                <DialogDescription>
                  {editingProvider ? 'Update your provider configuration' : 'Configure a new AI provider connection'}
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className='space-y-4'>
                  <FormField
                    control={form.control}
                    name='name'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder='My OpenAI Key' {...field} />
                        </FormControl>
                        <FormDescription>A friendly name for this provider key</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='provider'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Provider</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            if (value === 'custom') {
                              // Open custom provider dialog instead
                              setIsAddDialogOpen(false)
                              setIsCustomProviderDialogOpen(true)
                              form.reset()
                            } else {
                              field.onChange(value)
                            }
                          }}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder='Select a provider' />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PROVIDERS.map((provider) => (
                              <SelectItem key={provider.id} value={provider.id}>
                                <div className='flex items-center gap-2'>
                                  {provider.isLocal ? (
                                    <Monitor className='h-4 w-4' />
                                  ) : provider.isCustom ? (
                                    <Settings className='h-4 w-4' />
                                  ) : (
                                    <Cloud className='h-4 w-4' />
                                  )}
                                  {provider.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>Select the AI provider for this key</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='secretRef'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Secret Reference</FormLabel>
                        <FormControl>
                          <Input placeholder='OPENAI_API_KEY' {...field} />
                        </FormControl>
                        <FormDescription>Name of the environment secret that contains the API key</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='isDefault'
                    render={({ field }) => (
                      <FormItem className='flex flex-row items-center space-x-3 space-y-0'>
                        <FormControl>
                          <input type='checkbox' checked={field.value} onChange={field.onChange} className='h-4 w-4' />
                        </FormControl>
                        <div className='space-y-1 leading-none'>
                          <FormLabel>Set as default</FormLabel>
                          <FormDescription>Use this key as the default for this provider</FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  {(() => {
                    const selectedProviderId = form.watch('provider')
                    if (!selectedProviderId) return null
                    
                    const provider = PROVIDERS.find((p) => p.id === selectedProviderId)
                    if (!provider) return null
                    
                    return (
                      <Alert>
                        <AlertCircle className='h-4 w-4' />
                        <AlertTitle>Provider Information</AlertTitle>
                        <AlertDescription>
                          {provider.description}
                          {provider.link && (
                            <a
                              href={provider.link}
                              target='_blank'
                              rel='noopener noreferrer'
                              className='flex items-center gap-1 text-primary hover:underline mt-2'
                            >
                              {provider.linkTitle}
                              <ExternalLink className='h-3 w-3' />
                            </a>
                          )}
                        </AlertDescription>
                      </Alert>
                    )
                  })()}

                  <DialogFooter>
                    <Button type='button' variant='outline' onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type='submit' disabled={createMutation.isPending || updateMutation.isPending}>
                      {createMutation.isPending || updateMutation.isPending ? (
                        <Loader2 className='h-4 w-4 animate-spin mr-2' />
                      ) : null}
                      {editingProvider ? 'Update' : 'Add'} Provider
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <Dialog open={!!deletingProvider} onOpenChange={(open) => !open && setDeletingProvider(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Provider</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete "{deletingProvider?.name}"? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant='outline' onClick={() => setDeletingProvider(null)}>
                  Cancel
                </Button>
                <Button variant='destructive' onClick={handleDelete} disabled={deleteMutation.isPending}>
                  {deleteMutation.isPending && <Loader2 className='h-4 w-4 animate-spin mr-2' />}
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Provider Test Dialog */}
          {testingProvider && (
            <ProviderTestDialog
              provider={testingProvider}
              open={!!testingProvider}
              onOpenChange={(open) => !open && setTestingProvider(null)}
            />
          )}

          {/* Custom Provider Dialog */}
          <CustomProviderDialog
            open={isCustomProviderDialogOpen}
            onOpenChange={setIsCustomProviderDialogOpen}
            onSuccess={() => {
              setIsCustomProviderDialogOpen(false)
              // Refetch providers list to show the new custom provider
              refetchHealth()
            }}
          />

          {/* Encryption configuration dialog removed */}
        </div>
      </TooltipProvider>
    </ComponentErrorBoundary>
  )
}

export const Route = createFileRoute('/providers')({
  component: ProvidersPage
})
