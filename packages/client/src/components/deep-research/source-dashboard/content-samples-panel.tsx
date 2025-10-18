/**
 * Content Samples Panel Component
 *
 * Displays sample crawled content with previews and expansion capabilities.
 * Shows representative pages with metadata and token usage.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Badge,
  ScrollArea
} from '@promptliano/ui'
import { FileText, ExternalLink, Clock, Hash, Eye, ChevronRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { useState } from 'react'

interface ContentSamplesPanelProps {
  sourceId: number
  samples?: Array<{
    url: string
    title: string
    contentPreview: string
    tokenCount: number
    crawledAt: string
    fullContent?: string
  }>
  className?: string
}

/**
 * ContentSamplesPanel - Display crawled content samples with previews
 *
 * Features:
 * - Content preview cards
 * - Full content expansion
 * - Token usage display
 * - Timestamp formatting
 * - Syntax highlighting for HTML
 * - View all content button
 * - Empty state handling
 *
 * @example
 * ```tsx
 * <ContentSamplesPanel
 *   sourceId={123}
 *   samples={[
 *     {
 *       url: 'https://example.com/page1',
 *       title: 'Example Page',
 *       contentPreview: 'This is a sample of the content...',
 *       tokenCount: 1500,
 *       crawledAt: '2024-03-15T10:30:00Z',
 *       fullContent: 'Full content here...'
 *     }
 *   ]}
 * />
 * ```
 */
export function ContentSamplesPanel({ sourceId, samples, className }: ContentSamplesPanelProps) {
  // Show first 5 samples
  const displaySamples = samples?.slice(0, 5) || []
  const totalSamples = samples?.length || 0

  // Empty state
  if (totalSamples === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <FileText className='h-5 w-5 text-muted-foreground' />
            Content Samples
          </CardTitle>
          <CardDescription>Preview of crawled content</CardDescription>
        </CardHeader>
        <CardContent className='text-center py-8'>
          <FileText className='mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-4' />
          <p className='text-sm text-muted-foreground'>No content samples available yet</p>
          <p className='text-xs text-muted-foreground mt-1'>Content will appear here as pages are crawled</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle className='flex items-center gap-2'>
              <FileText className='h-5 w-5' />
              Content Samples
            </CardTitle>
            <CardDescription>
              Showing {displaySamples.length} of {totalSamples} crawled pages
            </CardDescription>
          </div>
          {totalSamples > 5 && (
            <Button variant='outline' size='sm'>
              <Eye className='h-4 w-4 mr-2' />
              View All ({totalSamples})
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className='space-y-4'>
        {displaySamples.map((sample, index) => (
          <ContentSampleCard key={`${sample.url}-${index}`} sample={sample} />
        ))}

        {/* View all button at bottom */}
        {totalSamples > 5 && (
          <div className='pt-4 border-t'>
            <Button variant='outline' className='w-full'>
              View All {totalSamples} Pages
              <ChevronRight className='h-4 w-4 ml-2' />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * ContentSampleCard - Individual content sample display
 */
function ContentSampleCard({ sample }: { sample: NonNullable<ContentSamplesPanelProps['samples']>[number] }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const timeAgo = formatDistanceToNow(new Date(sample.crawledAt), { addSuffix: true })

  return (
    <div className='rounded-lg border bg-card p-4 space-y-3 hover:shadow-md transition-shadow'>
      {/* Header */}
      <div className='space-y-2'>
        <div className='flex items-start justify-between gap-3'>
          <h4 className='font-semibold text-sm line-clamp-1' title={sample.title}>
            {sample.title}
          </h4>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant='ghost' size='sm' className='flex-shrink-0'>
                <Eye className='h-4 w-4' />
              </Button>
            </DialogTrigger>
            <DialogContent className='max-w-4xl max-h-[80vh]'>
              <DialogHeader>
                <DialogTitle className='flex items-center gap-2'>
                  <FileText className='h-5 w-5' />
                  {sample.title}
                </DialogTitle>
              </DialogHeader>
              <ContentFullView sample={sample} />
            </DialogContent>
          </Dialog>
        </div>

        <a
          href={sample.url}
          target='_blank'
          rel='noopener noreferrer'
          className='text-xs text-blue-600 hover:underline flex items-center gap-1 truncate'
          title={sample.url}
        >
          <ExternalLink className='h-3 w-3 flex-shrink-0' />
          <span className='truncate'>{sample.url}</span>
        </a>
      </div>

      {/* Content Preview */}
      <div className='space-y-2'>
        <p className='text-sm text-muted-foreground line-clamp-3'>{sample.contentPreview}</p>
        {sample.contentPreview.length > 200 && (
          <Button variant='link' size='sm' className='h-auto p-0 text-xs' onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? 'Show less' : 'Show more'}
          </Button>
        )}
      </div>

      {/* Metadata */}
      <div className='flex items-center gap-3 flex-wrap pt-2 border-t text-xs'>
        <div className='flex items-center gap-1 text-muted-foreground'>
          <Hash className='h-3 w-3' />
          <span>{sample.tokenCount.toLocaleString()} tokens</span>
        </div>
        <div className='flex items-center gap-1 text-muted-foreground'>
          <Clock className='h-3 w-3' />
          <span>{timeAgo}</span>
        </div>
        <Badge variant='outline' className='text-xs'>
          {formatContentSize(sample.contentPreview.length)}
        </Badge>
      </div>
    </div>
  )
}

/**
 * ContentFullView - Full content display in dialog
 */
function ContentFullView({ sample }: { sample: NonNullable<ContentSamplesPanelProps['samples']>[number] }) {
  const [viewMode, setViewMode] = useState<'preview' | 'raw'>('preview')
  const timeAgo = formatDistanceToNow(new Date(sample.crawledAt), { addSuffix: true })

  const content = sample.fullContent || sample.contentPreview

  return (
    <div className='space-y-4'>
      {/* Metadata Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-3 flex-wrap text-sm'>
          <Badge variant='outline'>
            <Hash className='h-3 w-3 mr-1' />
            {sample.tokenCount.toLocaleString()} tokens
          </Badge>
          <span className='text-muted-foreground flex items-center gap-1'>
            <Clock className='h-3 w-3' />
            {timeAgo}
          </span>
        </div>
        <div className='flex items-center gap-2'>
          <Button
            variant={viewMode === 'preview' ? 'default' : 'outline'}
            size='sm'
            onClick={() => setViewMode('preview')}
          >
            Preview
          </Button>
          <Button variant={viewMode === 'raw' ? 'default' : 'outline'} size='sm' onClick={() => setViewMode('raw')}>
            Raw
          </Button>
        </div>
      </div>

      {/* URL */}
      <div className='p-3 rounded-lg bg-muted'>
        <a
          href={sample.url}
          target='_blank'
          rel='noopener noreferrer'
          className='text-sm text-blue-600 hover:underline flex items-center gap-2 break-all'
        >
          <ExternalLink className='h-4 w-4 flex-shrink-0' />
          {sample.url}
        </a>
      </div>

      {/* Content */}
      <ScrollArea className='h-[400px] rounded-lg border bg-card p-4'>
        {viewMode === 'preview' ? (
          <div className='prose prose-sm max-w-none dark:prose-invert'>
            <p className='whitespace-pre-wrap'>{content}</p>
          </div>
        ) : (
          <pre className='text-xs font-mono whitespace-pre-wrap'>{content}</pre>
        )}
      </ScrollArea>

      {/* Footer Actions */}
      <div className='flex items-center justify-between pt-2 border-t'>
        <div className='text-xs text-muted-foreground'>
          Content length: {content.length.toLocaleString()} characters
        </div>
        <Button variant='outline' size='sm' onClick={() => copyToClipboard(content)}>
          Copy Content
        </Button>
      </div>
    </div>
  )
}

/**
 * Grid layout for multiple samples
 */
export function ContentSamplesGrid({ samples }: Pick<ContentSamplesPanelProps, 'samples'>) {
  if (!samples || samples.length === 0) {
    return (
      <div className='text-center py-12 text-muted-foreground'>
        <FileText className='mx-auto h-12 w-12 mb-4 opacity-50' />
        <p className='text-sm'>No content samples available</p>
      </div>
    )
  }

  return (
    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
      {samples.map((sample, index) => (
        <ContentSampleCard key={`${sample.url}-${index}`} sample={sample} />
      ))}
    </div>
  )
}

/**
 * Helper: Format content size
 */
function formatContentSize(chars: number): string {
  if (chars < 1000) return `${chars} chars`
  if (chars < 1000000) return `${(chars / 1000).toFixed(1)}K chars`
  return `${(chars / 1000000).toFixed(1)}M chars`
}

/**
 * Helper: Copy to clipboard
 */
function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => {
      // Success - could show toast here
      console.log('Content copied to clipboard')
    },
    (err) => {
      console.error('Failed to copy content:', err)
    }
  )
}
