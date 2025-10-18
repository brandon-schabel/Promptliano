# Source Dashboard Components

A comprehensive collection of reusable React components for displaying real-time web crawling statistics, performance metrics, and activity feeds. Built with TypeScript, shadcn/ui, and Tailwind CSS.

## Overview

This component library provides a complete dashboard solution for monitoring and visualizing web crawling operations. All components follow Promptliano's design patterns with full type safety, accessibility features, and responsive layouts.

## Components

### 1. CrawlStatusIndicator

Real-time status indicator showing current crawl state with visual feedback.

**Features:**
- Color-coded status badges (active, completed, failed, idle, queued, paused)
- Pulse animation for active crawls
- Tooltip with detailed information
- Session ID tracking
- Last crawl timestamp

**Usage:**
```tsx
import { CrawlStatusIndicator } from '@/components/deep-research/source-dashboard'

<CrawlStatusIndicator
  status="active"
  lastCrawlTime="2024-03-15T10:30:00Z"
  sessionId="session-abc123"
/>
```

**Variants:**
- `CrawlStatusIndicator` - Full version with tooltip
- `CrawlStatusBadge` - Compact badge for lists
- `CrawlStatusCard` - Large card with details

### 2. CrawlProgressPanel

Comprehensive progress visualization with metrics and depth breakdown.

**Features:**
- Total links discovered, pages crawled, queue size
- Progress bars with percentages
- Current depth vs max depth
- Links per depth breakdown visualization
- Real-time updates during active crawl

**Usage:**
```tsx
import { CrawlProgressPanel } from '@/components/deep-research/source-dashboard'

<CrawlProgressPanel
  progress={{
    totalLinksDiscovered: 150,
    totalPagesCrawled: 45,
    pagesRemainingInQueue: 105,
    currentCrawlDepth: 2,
    maxDepthConfigured: 3,
    linksPerDepth: { 0: 1, 1: 25, 2: 124 }
  }}
  isActive={true}
/>
```

### 3. PerformanceStatsCard

Detailed performance metrics with health indicators.

**Features:**
- Success rate with progress bar
- Average crawl time per page
- Throughput (pages per minute)
- Token usage statistics
- Content size tracking
- Performance health indicators (good/warning/poor)

**Usage:**
```tsx
import { PerformanceStatsCard } from '@/components/deep-research/source-dashboard'

<PerformanceStatsCard
  stats={{
    avgCrawlTimePerPage: 1250,
    successRate: 95.5,
    failedPagesCount: 3,
    totalTokens: 45000,
    avgTokensPerPage: 1500,
    totalContentSize: 2.5,
    pagesPerMinute: 4.2
  }}
/>
```

### 4. LinkTimeline

Chronological timeline of discovered links with status tracking.

**Features:**
- Real-time link discovery updates
- Status badges (pending, crawled, failed)
- Depth level indicators
- Parent URL tracking
- Relevance scores
- Expandable details
- Auto-scroll to latest
- Virtualized scrolling for performance

**Usage:**
```tsx
import { LinkTimeline } from '@/components/deep-research/source-dashboard'

<LinkTimeline
  links={[
    {
      url: 'https://example.com/page1',
      title: 'Example Page',
      depth: 1,
      discoveredAt: '2024-03-15T10:30:00Z',
      status: 'crawled',
      parentUrl: 'https://example.com',
      relevanceScore: 0.85
    }
  ]}
  linkDiscoveryRate={2.5}
  isLive={true}
/>
```

**Variants:**
- `LinkTimeline` - Full timeline with expansion
- `CompactLinkTimeline` - Condensed version for smaller displays

### 5. ErrorLogPanel

Comprehensive error logging with filtering and export capabilities.

**Features:**
- Expandable error details with accordion
- Search and filter functionality
- Error type categorization
- Export to JSON/CSV
- Consecutive error tracking
- Stack trace display
- Empty state handling

**Usage:**
```tsx
import { ErrorLogPanel } from '@/components/deep-research/source-dashboard'

<ErrorLogPanel
  errors={{
    errorCount: 5,
    consecutiveErrors: 2,
    recentErrors: [
      {
        message: 'Connection timeout',
        url: 'https://example.com/page',
        timestamp: '2024-03-15T10:30:00Z',
        errorCode: 'TIMEOUT',
        stackTrace: 'Error stack...'
      }
    ]
  }}
/>
```

**Variants:**
- `ErrorLogPanel` - Full panel with search/filter
- `ErrorLogSummary` - Compact summary for overview displays

### 6. CrawlActivityFeed

Real-time activity stream for active crawls.

**Features:**
- Live activity updates
- Auto-scroll to latest activity
- Activity type icons (link discovered, page crawled, error, depth completed)
- Timestamp formatting
- Maximum 50 recent activities
- Conditional rendering (only shows when active)

**Usage:**
```tsx
import { CrawlActivityFeed } from '@/components/deep-research/source-dashboard'

<CrawlActivityFeed
  isActive={true}
  recentLinks={[
    { url: 'https://example.com/page1', discoveredAt: '2024-03-15T10:30:00Z' }
  ]}
  recentErrors={[
    { message: 'Connection timeout', timestamp: '2024-03-15T10:31:00Z' }
  ]}
  currentDepth={2}
/>
```

**Variants:**
- `CrawlActivityFeed` - Full activity feed with scrolling
- `CompactActivityFeed` - Condensed list for smaller spaces
- `ActivityFeedWithStats` - Includes statistics header

### 7. ContentSamplesPanel

Display crawled content samples with previews and full-view modals.

**Features:**
- Content preview cards (first 200 chars)
- Full content expansion in modal
- Token usage display
- Timestamp formatting
- Syntax highlighting support
- View all content navigation
- Empty state handling

**Usage:**
```tsx
import { ContentSamplesPanel } from '@/components/deep-research/source-dashboard'

<ContentSamplesPanel
  sourceId={123}
  samples={[
    {
      url: 'https://example.com/page1',
      title: 'Example Page',
      contentPreview: 'This is a sample of the content...',
      tokenCount: 1500,
      crawledAt: '2024-03-15T10:30:00Z',
      fullContent: 'Full content here...'
    }
  ]}
/>
```

**Variants:**
- `ContentSamplesPanel` - Panel with preview cards
- `ContentSamplesGrid` - Grid layout for multiple samples

## Integration Example

Complete dashboard integration:

```tsx
import {
  CrawlStatusIndicator,
  CrawlProgressPanel,
  PerformanceStatsCard,
  LinkTimeline,
  ErrorLogPanel,
  CrawlActivityFeed,
  ContentSamplesPanel
} from '@/components/deep-research/source-dashboard'

function SourceDashboard({ sourceId }: { sourceId: number }) {
  const { data: dashboard, isLoading } = useSourceDashboard(sourceId)
  const { data: linksData } = useSourceLinks(sourceId)

  if (isLoading) return <Skeleton />

  const source = dashboard?.data
  const crawlStatus = source?.crawlStatus || {}
  const metadata = source?.metadata || {}
  const isActive = crawlStatus.status === 'active'

  return (
    <div className="space-y-6">
      {/* Header with Status */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{source?.title}</h1>
        <CrawlStatusIndicator
          status={crawlStatus.status}
          lastCrawlTime={metadata.lastCrawlTime}
          sessionId={crawlStatus.sessionId}
        />
      </div>

      {/* Progress and Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CrawlProgressPanel
          progress={{
            totalLinksDiscovered: metadata.linksDiscovered,
            totalPagesCrawled: metadata.pagesCrawled,
            pagesRemainingInQueue: metadata.pagesInQueue,
            currentCrawlDepth: metadata.currentDepth,
            maxDepthConfigured: metadata.maxDepth,
            linksPerDepth: metadata.linksPerDepth
          }}
          isActive={isActive}
        />
        <PerformanceStatsCard
          stats={{
            avgCrawlTimePerPage: metadata.avgCrawlTime,
            successRate: metadata.successRate,
            failedPagesCount: metadata.failedPages,
            totalTokens: metadata.tokenCount,
            avgTokensPerPage: metadata.avgTokens,
            totalContentSize: metadata.contentSize,
            pagesPerMinute: metadata.crawlRate
          }}
        />
      </div>

      {/* Activity Feed (if active) */}
      {isActive && (
        <CrawlActivityFeed
          isActive={isActive}
          recentLinks={crawlStatus.recentLinks}
          recentErrors={crawlStatus.recentErrors}
          currentDepth={metadata.currentDepth}
        />
      )}

      {/* Tabs for Different Views */}
      <Tabs defaultValue="links">
        <TabsList>
          <TabsTrigger value="links">Links</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
        </TabsList>

        <TabsContent value="links">
          <LinkTimeline
            links={linksData?.links || []}
            linkDiscoveryRate={metadata.linkDiscoveryRate}
            isLive={isActive}
          />
        </TabsContent>

        <TabsContent value="content">
          <ContentSamplesPanel
            sourceId={sourceId}
            samples={source?.contentSamples}
          />
        </TabsContent>

        <TabsContent value="errors">
          <ErrorLogPanel
            errors={{
              errorCount: metadata.errorCount,
              consecutiveErrors: metadata.consecutiveErrors,
              recentErrors: crawlStatus.recentErrors
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

## Design Patterns

### Component Architecture

All components follow these patterns:

1. **TypeScript First** - Fully typed props and state
2. **Composition** - Small, focused components that compose well
3. **Accessibility** - ARIA labels, keyboard navigation, screen reader support
4. **Responsive** - Mobile-first design with Tailwind CSS
5. **Performance** - Memoization, virtualization where needed
6. **Empty States** - Proper handling of no-data scenarios

### Styling Guidelines

- Use shadcn/ui components as building blocks
- Tailwind CSS for all styling
- Consistent spacing: `space-y-{n}`, `gap-{n}`
- Color coding for status: green (success), red (error), yellow (warning), blue (info)
- Animations: `animate-pulse`, `animate-in`, `fade-in`, `slide-in`

### Performance Optimizations

- Virtualized scrolling for large lists (LinkTimeline)
- Conditional rendering (ActivityFeed only when active)
- Debounced search inputs
- Lazy loading for heavy components
- Memoized calculations

## Accessibility Features

All components include:

- ✅ Proper ARIA attributes (`aria-label`, `aria-expanded`, `role`)
- ✅ Keyboard navigation support (Tab, Enter, Space)
- ✅ Screen reader announcements
- ✅ Focus management
- ✅ Color contrast compliance
- ✅ Semantic HTML

## Testing

Components are designed to be testable:

```tsx
import { render, screen } from '@testing-library/react'
import { CrawlStatusIndicator } from './crawl-status-indicator'

test('displays active status with pulse animation', () => {
  render(<CrawlStatusIndicator status="active" />)
  expect(screen.getByText('Active')).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveClass('animate-pulse')
})
```

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Dependencies

- React 19
- TypeScript 5.x
- shadcn/ui components
- Tailwind CSS 3.x
- lucide-react (icons)
- date-fns (date formatting)

## Future Enhancements

Potential improvements:

- [ ] WebSocket integration for real-time updates
- [ ] Export to PDF functionality
- [ ] Advanced filtering options
- [ ] Custom chart visualizations
- [ ] Comparison mode between sources
- [ ] Historical data trends

## Contributing

When adding new components to this directory:

1. Follow existing patterns and naming conventions
2. Include JSDoc comments with examples
3. Add TypeScript types for all props
4. Implement accessibility features
5. Handle empty states gracefully
6. Add responsive breakpoints
7. Export from `index.ts`
8. Update this README

## License

Part of the Promptliano project.
