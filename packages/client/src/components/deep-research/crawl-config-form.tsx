import { Card, Label, Input, Slider, Switch, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@promptliano/ui'
import { HelpCircle, Globe } from 'lucide-react'

export interface CrawlConfigFormProps {
  enabled: boolean
  seedUrl: string
  maxDepth: number
  maxPages: number
  relevanceThreshold: number
  onEnabledChange: (enabled: boolean) => void
  onSeedUrlChange: (url: string) => void
  onMaxDepthChange: (depth: number) => void
  onMaxPagesChange: (pages: number) => void
  onRelevanceThresholdChange: (threshold: number) => void
  className?: string
}

/**
 * Crawl configuration form component for deep research
 * Allows users to configure web crawling parameters when creating research
 */
export function CrawlConfigForm({
  enabled,
  seedUrl,
  maxDepth,
  maxPages,
  relevanceThreshold,
  onEnabledChange,
  onSeedUrlChange,
  onMaxDepthChange,
  onMaxPagesChange,
  onRelevanceThresholdChange,
  className
}: CrawlConfigFormProps) {
  return (
    <Card className={className}>
      <div className="p-6 space-y-6">
        {/* Enable Web Crawling Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="enable-crawling" className="font-medium cursor-pointer">
              Enable Web Crawling
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Automatically discover and extract content from related web pages starting from a seed URL.
                    AI will intelligently filter links based on relevance to your research topic.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Switch
            id="enable-crawling"
            checked={enabled}
            onCheckedChange={onEnabledChange}
          />
        </div>

        {/* Crawl Configuration - Only shown when enabled */}
        {enabled && (
          <>
            <div className="h-px bg-border" />

            {/* Seed URL Input */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="seed-url" className="font-medium">
                  Seed URL *
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        The starting point for web crawling. AI will discover related pages by following links from this URL.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id="seed-url"
                type="url"
                placeholder="https://example.com/article"
                value={seedUrl}
                onChange={(e) => onSeedUrlChange(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Enter the URL where crawling should start
              </p>
            </div>

            {/* Max Depth Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label htmlFor="max-depth" className="font-medium">
                    Max Crawl Depth
                  </Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          How many link levels to follow from the seed URL.
                          Depth 1 = only pages directly linked from seed URL.
                          Depth 2 = pages linked from those pages, etc.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <span className="text-sm font-mono text-muted-foreground">
                  {maxDepth}
                </span>
              </div>
              <Slider
                id="max-depth"
                min={1}
                max={5}
                step={1}
                value={[maxDepth]}
                onValueChange={(values) => onMaxDepthChange(values[0])}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Shallow (1)</span>
                <span>Medium (3)</span>
                <span>Deep (5)</span>
              </div>
            </div>

            {/* Max Pages Input */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="max-pages" className="font-medium">
                  Max Pages
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Maximum number of pages to crawl. Crawling stops when this limit is reached.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id="max-pages"
                type="number"
                min={1}
                max={100}
                value={maxPages}
                onChange={(e) => onMaxPagesChange(parseInt(e.target.value) || 20)}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Range: 1-100 pages (recommended: 10-50)
              </p>
            </div>

            {/* Relevance Threshold Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label htmlFor="relevance-threshold" className="font-medium">
                    Relevance Threshold
                  </Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          AI filters links based on their relevance to your research topic.
                          Higher values = stricter filtering (only highly relevant pages).
                          Lower values = more exploratory (includes tangentially related pages).
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <span className="text-sm font-mono text-muted-foreground">
                  {(relevanceThreshold * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                id="relevance-threshold"
                min={0}
                max={1}
                step={0.05}
                value={[relevanceThreshold]}
                onValueChange={(values) => onRelevanceThresholdChange(values[0])}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Exploratory (0%)</span>
                <span>Balanced (60%)</span>
                <span>Strict (100%)</span>
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
