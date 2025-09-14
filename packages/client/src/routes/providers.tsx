import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  ComponentErrorBoundary,
  Alert,
  AlertDescription,
  AlertTitle,
  ScrollArea,
  RadioGroup,
  RadioGroupItem
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
import { useLocalStorage } from '@/hooks/utility-hooks/use-local-storage'
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
import { CopilotEmbedPanel } from '@/components/providers/copilot-embed-panel'
import { ProvidersTabWithSidebar } from '@/components/providers/providers-tab-with-sidebar'
// Encryption UI removed; provider keys use secretRef only

// Form schema for adding/editing provider
const providerFormSchema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    provider: z.string().min(1, 'Provider is required'),
    storageMethod: z.enum(['direct', 'env']).default('direct'),
    key: z.string().optional(),
    secretRef: z.string().optional(),
    isDefault: z.boolean().default(false)
  })
  .refine(
    (data) => {
      // Allow keyless for Copilot and Custom providers
      const p = (data.provider || '').toLowerCase()
      const isKeyless = p === 'copilot' || p === 'custom'
      if (isKeyless) return true

      // Validate that either key or secretRef is provided based on storage method
      if (data.storageMethod === 'direct') {
        return !!(data.key && data.key.length > 0)
      } else {
        return !!(data.secretRef && data.secretRef.length > 0)
      }
    },
    {
      message: 'API key or environment variable is required',
      path: ['key'] // Show error on key field
    }
  )

type ProviderFormValues = z.infer<typeof providerFormSchema>

function ProvidersPage() {
  const [activeSection, setActiveSection] = useLocalStorage<
    'overview' | 'api' | 'local' | 'presets' | 'copilot' | 'health'
  >('providers.activeSection', 'overview')
  const [searchQuery, setSearchQuery] = useState('')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isCustomProviderDialogOpen, setIsCustomProviderDialogOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<ProviderKey | null>(null)
  const [deletingProvider, setDeletingProvider] = useState<ProviderKey | null>(null)
  const [testingProvider, setTestingProvider] = useState<ProviderKey | null>(null)
  const [testingProviders, setTestingProviders] = useState<Set<number>>(new Set())
  const [storageMethod, setStorageMethod] = useState<'direct' | 'env'>('direct')
  // Encryption key configuration removed

  // Sidebar section persistence handled by useLocalStorage above

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

  // Tab-based filtering removed in favor of sidebar sections

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
        // Prepare the data based on storage method
        const createData: any = {
          provider: values.provider,
          keyName: values.name,
          name: values.name,
          isDefault: values.isDefault
        }

        // Add either key or secretRef based on storage method
        if (values.storageMethod === 'direct') {
          createData.key = values.key
        } else {
          createData.secretRef = values.secretRef
        }

        await createMutation.mutateAsync(createData)
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
        <div className='flex h-full w-full overflow-hidden bg-gradient-to-br from-background via-background to-muted/20'>
          <ProvidersTabWithSidebar
            activeView={activeSection as any}
            onViewChange={(v) => setActiveSection(v as any)}
            renderView={(view) => {
              const Header = (
                <div className='px-6 py-6 border-b'>
                  <div className='flex items-start justify-between'>
                    <div className='space-y-1'>
                      <h1 className='text-2xl font-bold'>Provider Management</h1>
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
                </div>
              )

              const SearchBar = (
                <div className='flex items-center justify-between gap-4 px-6 py-4'>
                  <div className='relative'>
                    <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                    <Input
                      placeholder='Search providers...'
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className='pl-9 w-[300px]'
                    />
                  </div>
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
              )

              if (view === 'copilot') {
                return (
                  <div className='flex-1 overflow-y-auto'>
                    {Header}
                    <CopilotEmbedPanel />
                  </div>
                )
              }

              if (view === 'presets') {
                return (
                  <div className='flex-1 overflow-y-auto'>
                    {Header}
                    <div className='p-6'>
                      <ModelPresetConfigurator />
                    </div>
                  </div>
                )
              }

              if (view === 'health') {
                return (
                  <div className='flex-1 overflow-y-auto'>
                    {Header}
                    <div className='p-6'>
                      <h2 className='text-xl font-semibold mb-4'>Providers Health</h2>
                      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                        {(healthStatuses || []).map((h, i) => (
                          <Card key={i}>
                            <CardHeader>
                              <CardTitle className='text-base'>Status: {h.status}</CardTitle>
                            </CardHeader>
                            <CardContent className='text-sm'>
                              {typeof h.latency === 'number' && <div>Latency: {h.latency} ms</div>}
                              {typeof h.averageResponseTime === 'number' && <div>Avg: {h.averageResponseTime} ms</div>}
                              {typeof h.modelCount === 'number' && <div>Models: {h.modelCount}</div>}
                              {h.error && <div className='text-red-500'>Error: {h.error}</div>}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              }

              const showLocal = view === 'overview' || view === 'local'
              const showApi = view === 'overview' || view === 'api'

              return (
                <div className='flex-1 overflow-y-auto'>
                  {Header}
                  {SearchBar}
                  <ScrollArea className='px-6 pb-6'>
                    {showLocal && (
                      <div className='mb-8'>
                        <h2 className='text-xl font-semibold mb-4'>Local Providers</h2>
                        <LocalProviderSection
                          providers={providers.filter(
                            (p: ProviderKey) =>
                              Boolean(PROVIDERS.find((prov) => prov.id === p.provider)?.isLocal) &&
                              (searchQuery
                                ? p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  p.provider.toLowerCase().includes(searchQuery.toLowerCase())
                                : true)
                          )}
                          onEdit={openEditDialog}
                          isLoading={isLoadingProviders}
                        />
                      </div>
                    )}
                    {showApi && (
                      <div>
                        <div className='flex items-center justify-between mb-4'>
                          <h2 className='text-xl font-semibold'>API Providers</h2>
                          <div className='flex items-center gap-2'>
                            <Button variant='outline' size='sm' onClick={() => refetchHealth()} className='gap-2'>
                              <RefreshCw className='h-4 w-4' />
                              Refresh
                            </Button>
                            <Button variant='outline' size='sm' onClick={handleTestAllConnections} className='gap-2'>
                              <TestTube className='h-4 w-4' />
                              Test All
                            </Button>
                          </div>
                        </div>
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
                  </ScrollArea>
                </div>
              )
            }}
          />
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
                            return
                          }
                          if (value === 'copilot') {
                            // Redirect to Copilot integration panel
                            setIsAddDialogOpen(false)
                            setActiveSection('copilot')
                            toast.info('Redirected to GitHub Copilot integration')
                            form.reset()
                            return
                          }
                          field.onChange(value)
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

                {/* Storage Method Selection */}
                <FormField
                  control={form.control}
                  name='storageMethod'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Storage Method</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className='flex flex-row space-x-4'
                        >
                          <div className='flex items-center space-x-2'>
                            <RadioGroupItem value='direct' id='direct' />
                            <Label htmlFor='direct' className='font-normal cursor-pointer'>
                              Direct API Key
                            </Label>
                          </div>
                          <div className='flex items-center space-x-2'>
                            <RadioGroupItem value='env' id='env' />
                            <Label htmlFor='env' className='font-normal cursor-pointer'>
                              Environment Variable
                            </Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormDescription>
                        Choose how to store the API key - directly or via environment variable
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Conditional Fields based on Storage Method */}
                {form.watch('storageMethod') === 'direct' ? (
                  <FormField
                    control={form.control}
                    name='key'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>API Key</FormLabel>
                        <FormControl>
                          <Input type='password' placeholder='sk-...' {...field} />
                        </FormControl>
                        <FormDescription>The actual API key will be stored securely in the database</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <FormField
                    control={form.control}
                    name='secretRef'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Environment Variable Name</FormLabel>
                        <FormControl>
                          <Input placeholder='OPENAI_API_KEY' {...field} />
                        </FormControl>
                        <FormDescription>
                          Name of the environment variable containing the API key (without $ prefix)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

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
      </TooltipProvider>
    </ComponentErrorBoundary>
  )
}

export const Route = createFileRoute('/providers')({
  component: ProvidersPage
})
