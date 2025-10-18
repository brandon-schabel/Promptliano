/**
 * Example Usage: Crawl Debug Panel
 *
 * This file demonstrates how to integrate the CrawlDebugPanel component
 * into your deep research routes and pages.
 */

import { CrawlDebugPanel } from './crawl-debug-panel'
import { Card, Tabs, TabsContent, TabsList, TabsTrigger } from '@promptliano/ui'

/**
 * Example 1: Standalone Debug Panel
 * Use the debug panel as a standalone component in a dedicated debug view
 */
export function DebugViewExample({ researchId }: { researchId: number }) {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Research Debug Dashboard</h1>
        <p className="text-muted-foreground">Real-time crawling diagnostics and event monitoring</p>
      </div>

      <CrawlDebugPanel researchId={researchId} />
    </div>
  )
}

/**
 * Example 2: Debug Panel in Tabbed Layout
 * Integrate the debug panel as a tab within the research detail view
 */
export function ResearchDetailWithDebugExample({ researchId }: { researchId: number }) {
  return (
    <div className="container mx-auto p-6">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="document">Document</TabsTrigger>
          <TabsTrigger value="debug">Debug</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {/* Research overview content */}
          <div>Overview content here...</div>
        </TabsContent>

        <TabsContent value="sources">
          {/* Sources list */}
          <div>Sources content here...</div>
        </TabsContent>

        <TabsContent value="document">
          {/* Document sections */}
          <div>Document content here...</div>
        </TabsContent>

        <TabsContent value="debug">
          <CrawlDebugPanel researchId={researchId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/**
 * Example 3: Side-by-Side Layout
 * Show debug panel alongside crawl progress
 */
export function ResearchWithSidePanelExample({ researchId }: { researchId: number }) {
  return (
    <div className="container mx-auto p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Crawl Progress */}
        <div className="space-y-4">
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Crawl Progress</h2>
              {/* Crawl progress component */}
              <div>Crawl progress display here...</div>
            </div>
          </Card>
        </div>

        {/* Right: Debug Panel */}
        <div>
          <CrawlDebugPanel researchId={researchId} />
        </div>
      </div>
    </div>
  )
}

/**
 * Example 4: Collapsible Debug Section
 * Add debug panel as a collapsible section at the bottom of the page
 */
export function ResearchWithCollapsibleDebugExample({ researchId }: { researchId: number }) {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Main content */}
      <div>
        <h1 className="text-2xl font-bold mb-4">Research: {researchId}</h1>
        <Card>
          <div className="p-6">Main research content here...</div>
        </Card>
      </div>

      {/* Collapsible Debug Section */}
      <details className="group">
        <summary className="cursor-pointer list-none">
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
            <span className="text-sm font-medium">Show Debug Panel</span>
            <svg
              className="h-5 w-5 transition-transform group-open:rotate-180"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </summary>
        <div className="mt-4">
          <CrawlDebugPanel researchId={researchId} />
        </div>
      </details>
    </div>
  )
}

/**
 * Example 5: Conditional Rendering
 * Only show debug panel when crawling is enabled
 */
export function ConditionalDebugPanelExample({
  researchId,
  crawlEnabled
}: {
  researchId: number
  crawlEnabled: boolean
}) {
  if (!crawlEnabled) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <div className="p-6 text-center text-muted-foreground">
            <p>Debug panel is only available when web crawling is enabled.</p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <CrawlDebugPanel researchId={researchId} />
    </div>
  )
}

/**
 * Example 6: Integration in TanStack Router
 * How to use in a route component
 */

// File: packages/client/src/routes/deep-research_.$researchId.tsx
/*
import { createFileRoute } from '@tanstack/react-router'
import { CrawlDebugPanel } from '@/components/deep-research/crawl-debug-panel'

export const Route = createFileRoute('/deep-research/$researchId')({
  component: ResearchDetailPage
})

function ResearchDetailPage() {
  const { researchId } = Route.useParams()

  return (
    <div className="container mx-auto p-6">
      <CrawlDebugPanel researchId={Number(researchId)} />
    </div>
  )
}
*/

/**
 * Example 7: With Custom Styling
 * Apply custom className for different layouts
 */
export function StyledDebugPanelExample({ researchId }: { researchId: number }) {
  return (
    <div className="container mx-auto p-6">
      {/* Compact version */}
      <CrawlDebugPanel researchId={researchId} className="max-w-4xl mx-auto shadow-lg" />

      {/* Full width version */}
      <CrawlDebugPanel researchId={researchId} className="w-full" />

      {/* Fixed height version */}
      <CrawlDebugPanel researchId={researchId} className="h-[600px] overflow-hidden" />
    </div>
  )
}
