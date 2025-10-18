import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { useSourceDashboard, useSourceLinks } from '@/hooks/api-hooks'
import React from 'react'
import {
  Badge,
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton
} from '@promptliano/ui'
import {
  ArrowLeft,
  RefreshCw,
  Settings,
  ExternalLink,
  Clock,
  FileText,
  Link2,
  AlertCircle,
  Activity
} from 'lucide-react'
import { sourceDashboardSearchSchema } from '@/lib/search-schemas'
import { formatDistanceToNow } from 'date-fns'
import { LinkDiscoveryTable } from '@/components/deep-research/source-dashboard/link-discovery-table'
import { ErrorBoundary } from '@/components/error-boundary/error-boundary'

export const Route = createFileRoute('/deep-research/$researchId/sources/$sourceId/')({
  validateSearch: zodValidator(sourceDashboardSearchSchema),
  component: () => (
    <ErrorBoundary>
      <SourceDashboardPage />
    </ErrorBoundary>
  )
})

function SourceDashboardPage() {
  const { researchId, sourceId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const numericSourceId = Number(sourceId)
  const numericResearchId = Number(researchId)

  const { data: dashboard, isLoading, refetch } = useSourceDashboard(numericSourceId)

  const currentTab = search.tab || 'overview'

  const handleTabChange = (tab: string) => {
    const validTabs = ['overview', 'links', 'content', 'errors'] as const
    const validatedTab = validTabs.includes(tab as any) ? tab : 'overview'

    navigate({
      to: '/deep-research/$researchId/sources/$sourceId',
      params: { researchId, sourceId },
      search: { tab: validatedTab as any },
      replace: true
    })
  }

  const handleBack = () => {
    navigate({
      to: '/deep-research/$researchId',
      params: { researchId },
      search: { tab: 'sources' }
    })
  }

  const handleRefresh = () => {
    refetch()
  }

  if (isLoading) {
    return <SourceDashboardSkeleton />
  }

  if (!dashboard?.data) {
    return (
      <div className='max-w-7xl mx-auto p-6'>
        <Button variant='ghost' onClick={handleBack} className='mb-4'>
          <ArrowLeft className='mr-2 h-4 w-4' />
          Back to Research
        </Button>
        <div className='text-center mt-8'>
          <AlertCircle className='mx-auto h-12 w-12 text-muted-foreground mb-4' />
          <p className='text-lg font-semibold'>Source not found</p>
        </div>
      </div>
    )
  }

  const source = dashboard.data
  const crawlStatus = source.crawlStatus || {}
  const stats = React.useMemo(() => {
    if (source.metadata) {
      return {
        tokenCount: source.metadata.tokenCount ?? 0,
        pagesCrawled: source.metadata.pagesCrawled ?? source.crawlProgress?.totalPagesCrawled ?? 0,
        linksDiscovered:
          source.metadata.linksDiscovered ??
          source.crawlProgress?.totalLinksDiscovered ??
          source.recentLinks?.length ??
          0,
        lastCrawlTime:
          source.metadata.lastCrawlTime ??
          source.crawlStatus?.lastCrawlEndTime ??
          source.crawlStatus?.lastCrawlStartTime,
        totalRequests: source.metadata.totalRequests,
        successfulRequests: source.metadata.successfulRequests,
        avgResponseTime: source.metadata.avgResponseTime ?? source.performanceStats?.avgCrawlTimePerPage,
        maxDepth: source.metadata.maxDepth ?? source.crawlProgress?.maxDepthConfigured,
        currentDepth: source.metadata.currentDepth ?? source.crawlProgress?.currentCrawlDepth ?? 0,
        errorCount: source.metadata.errorCount ?? source.errors?.errorCount ?? 0
      }
    }

    return {
      tokenCount: source.tokenStats?.totalTokens ?? 0,
      pagesCrawled: source.crawlProgress?.totalPagesCrawled ?? 0,
      linksDiscovered: source.crawlProgress?.totalLinksDiscovered ?? source.recentLinks?.length ?? 0,
      lastCrawlTime: source.crawlStatus?.lastCrawlEndTime ?? source.crawlStatus?.lastCrawlStartTime,
      totalRequests: undefined,
      successfulRequests: undefined,
      avgResponseTime: source.performanceStats?.avgCrawlTimePerPage,
      maxDepth: source.crawlProgress?.maxDepthConfigured,
      currentDepth: source.crawlProgress?.currentCrawlDepth ?? 0,
      errorCount: source.errors?.errorCount ?? 0
    }
  }, [source])
  const isActive = crawlStatus.status === 'active'

  return (
    <div className='max-w-7xl mx-auto p-6 space-y-6'>
      <nav className='flex items-center gap-2 text-sm text-muted-foreground'>
        <Link to='/deep-research' className='hover:text-foreground transition-colors'>
          Research
        </Link>
        <span>/</span>
        <Link
          to='/deep-research/$researchId'
          params={{ researchId }}
          search={{ tab: 'sources' }}
          className='hover:text-foreground transition-colors'
        >
          {source.researchTopic || 'Research Session'}
        </Link>
        <span>/</span>
        <span className='text-foreground font-medium'>Source Dashboard</span>
      </nav>

      <div className='space-y-4'>
        <div className='flex items-start justify-between gap-4'>
          <div className='flex-1 min-w-0'>
            <div className='flex items-center gap-3 mb-2'>
              <Button variant='ghost' size='sm' onClick={handleBack}>
                <ArrowLeft className='h-4 w-4' />
              </Button>
              <h1 className='text-3xl font-bold tracking-tight truncate'>{source.title || 'Source Dashboard'}</h1>
            </div>
            <a
              href={source.url}
              target='_blank'
              rel='noopener noreferrer'
              className='text-sm text-blue-600 hover:underline flex items-center gap-1 max-w-full truncate'
            >
              <ExternalLink className='h-3 w-3 flex-shrink-0' />
              <span className='truncate'>{source.url}</span>
            </a>
          </div>

          <div className='flex items-center gap-2'>
            <Button variant='outline' size='sm' onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant='outline' size='sm'>
              <Settings className='h-4 w-4 mr-2' />
              Configure
            </Button>
            <Badge
              variant={
                isActive
                  ? 'default'
                  : crawlStatus.status === 'completed'
                    ? 'secondary'
                    : crawlStatus.status === 'failed'
                      ? 'destructive'
                      : 'outline'
              }
              className='flex items-center gap-1'
            >
              {isActive && <Activity className='h-3 w-3 animate-pulse' />}
              {crawlStatus.status || 'idle'}
            </Badge>
          </div>
        </div>

        <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription className='flex items-center gap-2'>
                <FileText className='h-4 w-4' />
                Token Count
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{stats.tokenCount.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='pb-2'>
              <CardDescription className='flex items-center gap-2'>
                <Activity className='h-4 w-4' />
                Pages Crawled
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{stats.pagesCrawled}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='pb-2'>
              <CardDescription className='flex items-center gap-2'>
                <Link2 className='h-4 w-4' />
                Links Discovered
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{stats.linksDiscovered}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='pb-2'>
              <CardDescription className='flex items-center gap-2'>
                <Clock className='h-4 w-4' />
                Last Crawl
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='text-sm font-medium'>
                {stats.lastCrawlTime
                  ? formatDistanceToNow(new Date(stats.lastCrawlTime), {
                      addSuffix: true
                    })
                  : 'Never'}
              </div>
            </CardContent>
          </Card>
        </div>

        {stats.totalRequests && (
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-sm font-medium'>Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='space-y-2'>
                <div className='flex items-center justify-between text-sm'>
                  <span className='text-muted-foreground'>
                    {stats.successfulRequests || 0} successful / {stats.totalRequests} total
                  </span>
                  <span className='font-bold'>
                    {stats.totalRequests > 0
                      ? Math.round(((stats.successfulRequests || 0) / stats.totalRequests) * 100)
                      : 0}
                    %
                  </span>
                </div>
                <div className='h-2 bg-secondary rounded-full overflow-hidden'>
                  <div
                    className='h-full bg-primary transition-all'
                    style={{
                      width: `$${
                        stats.totalRequests > 0 ? ((stats.successfulRequests || 0) / stats.totalRequests) * 100 : 0
                      }%`
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value='overview'>Overview</TabsTrigger>
          <TabsTrigger value='links'>Links ({stats.linksDiscovered})</TabsTrigger>
          <TabsTrigger value='content'>Content</TabsTrigger>
          <TabsTrigger value='errors'>Errors ({stats.errorCount})</TabsTrigger>
        </TabsList>

        <TabsContent value='overview' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Crawl Overview</CardTitle>
              <CardDescription>Comprehensive statistics and metadata</CardDescription>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div>
                  <h4 className='text-sm font-medium mb-2'>Source Information</h4>
                  <dl className='space-y-2 text-sm'>
                    <div className='flex justify-between'>
                      <dt className='text-muted-foreground'>Type:</dt>
                      <dd className='font-medium'>{source.sourceType || 'web'}</dd>
                    </div>
                    <div className='flex justify-between'>
                      <dt className='text-muted-foreground'>Status:</dt>
                      <dd className='font-medium'>{source.status || 'unknown'}</dd>
                    </div>
                    <div className='flex justify-between'>
                      <dt className='text-muted-foreground'>Created:</dt>
                      <dd className='font-medium'>
                        {source.createdAt
                          ? formatDistanceToNow(new Date(source.createdAt), {
                              addSuffix: true
                            })
                          : 'Unknown'}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h4 className='text-sm font-medium mb-2'>Crawl Statistics</h4>
                  <dl className='space-y-2 text-sm'>
                    <div className='flex justify-between'>
                      <dt className='text-muted-foreground'>Max Depth:</dt>
                      <dd className='font-medium'>{stats.maxDepth || 'N/A'}</dd>
                    </div>
                    <div className='flex justify-between'>
                      <dt className='text-muted-foreground'>Current Depth:</dt>
                      <dd className='font-medium'>{stats.currentDepth}</dd>
                    </div>
                    <div className='flex justify-between'>
                      <dt className='text-muted-foreground'>Avg Response Time:</dt>
                      <dd className='font-medium'>
                        {stats.avgResponseTime ? `${Math.round(stats.avgResponseTime)}ms` : 'N/A'}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </CardContent>
          </Card>

          {isActive && (
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Activity className='h-5 w-5 animate-pulse' />
                  Real-time Activity
                </CardTitle>
                <CardDescription>Live updates from active crawl</CardDescription>
              </CardHeader>
              <CardContent>
                <p className='text-sm text-muted-foreground'>
                  Crawl is currently in progress. Data updates every 5 seconds.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value='links' className='space-y-4'>
          <LinkDiscoveryTable sourceId={numericSourceId} showBulkActions={true} showColumnControls={true} />
        </TabsContent>

        <TabsContent value='content' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Crawled Content</CardTitle>
              <CardDescription>Samples of content extracted from pages</CardDescription>
            </CardHeader>
            <CardContent>
              <p className='text-sm text-muted-foreground'>Content samples will be displayed here</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='errors' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Error Log</CardTitle>
              <CardDescription>Issues encountered during crawling</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.errorCount && stats.errorCount > 0 ? (
                <div className='space-y-2'>
                  <p className='text-sm text-muted-foreground'>
                    {stats.errorCount} error{stats.errorCount !== 1 ? 's' : ''} logged
                  </p>
                  {source.errorMessage && (
                    <div className='p-3 border border-destructive/50 rounded-lg bg-destructive/10'>
                      <p className='text-sm text-destructive'>{source.errorMessage}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className='text-center py-8 text-muted-foreground'>
                  <AlertCircle className='mx-auto h-12 w-12 mb-4 opacity-50' />
                  <p>No errors recorded</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function SourceDashboardSkeleton() {
  return (
    <div className='max-w-7xl mx-auto p-6 space-y-6'>
      <div className='flex items-center gap-2'>
        <Skeleton className='h-4 w-20' />
        <span className='text-muted-foreground'>/</span>
        <Skeleton className='h-4 w-32' />
        <span className='text-muted-foreground'>/</span>
        <Skeleton className='h-4 w-40' />
      </div>

      <div className='space-y-4'>
        <div className='flex items-start justify-between'>
          <div className='flex-1 space-y-2'>
            <Skeleton className='h-10 w-2/3' />
            <Skeleton className='h-4 w-1/2' />
          </div>
          <div className='flex gap-2'>
            <Skeleton className='h-9 w-24' />
            <Skeleton className='h-9 w-28' />
            <Skeleton className='h-6 w-16' />
          </div>
        </div>

        <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className='pb-2'>
                <Skeleton className='h-4 w-24' />
              </CardHeader>
              <CardContent>
                <Skeleton className='h-8 w-20' />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className='space-y-4'>
        <Skeleton className='h-10 w-full max-w-md' />
        <Card>
          <CardHeader>
            <Skeleton className='h-6 w-40' />
            <Skeleton className='h-4 w-64' />
          </CardHeader>
          <CardContent>
            <div className='space-y-3'>
              <Skeleton className='h-4 w-full' />
              <Skeleton className='h-4 w-full' />
              <Skeleton className='h-4 w-3/4' />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
