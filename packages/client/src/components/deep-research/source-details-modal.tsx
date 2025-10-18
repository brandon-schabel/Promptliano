import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Badge,
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  ScrollArea,
  Separator,
  MarkdownPreview
} from '@promptliano/ui'
import { Loader2, ExternalLink, FileText, Code, Type, Hash, Maximize2, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useSourceProcessedData } from '@/hooks/api-hooks'

interface SourceDetailsModalProps {
  sourceId: number | null
  isOpen: boolean
  onClose: () => void
}

const statusColors = {
  pending: 'bg-gray-500',
  fetching: 'bg-blue-500',
  processing: 'bg-yellow-500',
  complete: 'bg-green-500',
  failed: 'bg-red-500'
}

export function SourceDetailsModal({ sourceId, isOpen, onClose }: SourceDetailsModalProps) {
  const [activeTab, setActiveTab] = useState('markdown')
  const { data: response, isLoading, error } = useSourceProcessedData(sourceId ?? undefined)

  const processedData = response?.data

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='max-w-4xl h-[85vh] p-0 flex flex-col'>
        {/* Header */}
        <DialogHeader className='px-6 pt-6 pb-4 border-b flex-shrink-0'>
          <div className='flex items-start justify-between gap-4'>
            <div className='flex-1 min-w-0 space-y-2'>
              <DialogTitle className='text-xl font-semibold'>Source Details</DialogTitle>
              {processedData && (
                <>
                  {processedData.title && (
                    <p className='text-base font-medium text-foreground line-clamp-2'>{processedData.title}</p>
                  )}
                  {processedData.url && (
                    <a
                      href={processedData.url}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors'
                    >
                      <ExternalLink className='h-3 w-3' />
                      <span className='truncate'>{processedData.url}</span>
                    </a>
                  )}
                </>
              )}
            </div>
            <Button variant='ghost' size='icon' onClick={onClose} className='flex-shrink-0'>
              <X className='h-4 w-4' />
            </Button>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className='flex-1 overflow-hidden'>
          {isLoading && (
            <div className='flex items-center justify-center h-full'>
              <div className='text-center space-y-4'>
                <Loader2 className='h-8 w-8 animate-spin mx-auto text-muted-foreground' />
                <p className='text-sm text-muted-foreground'>Loading source data...</p>
              </div>
            </div>
          )}

          {error && (
            <div className='flex items-center justify-center h-full px-6'>
              <div className='text-center space-y-4'>
                <FileText className='h-12 w-12 mx-auto text-destructive/50' />
                <div>
                  <h3 className='text-lg font-semibold text-destructive'>Failed to load source data</h3>
                  <p className='text-sm text-muted-foreground mt-2'>
                    {error instanceof Error ? error.message : 'An unexpected error occurred'}
                  </p>
                </div>
                <Button variant='outline' onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          )}

          {!isLoading && !error && processedData && (
            <div className='h-full flex flex-col'>
              {/* Metadata Section */}
              <div className='px-6 py-4 bg-muted/30 border-b flex-shrink-0'>
                <div className='grid grid-cols-2 md:grid-cols-4 gap-4 text-sm'>
                  {processedData.tokenCount !== null && (
                    <div className='space-y-1'>
                      <div className='text-muted-foreground'>Token Count</div>
                      <div className='font-medium flex items-center gap-1'>
                        <Hash className='h-3 w-3' />
                        {processedData.tokenCount.toLocaleString()}
                      </div>
                    </div>
                  )}
                  {processedData.relevanceScore !== null && (
                    <div className='space-y-1'>
                      <div className='text-muted-foreground'>Relevance Score</div>
                      <div className='font-medium'>{(processedData.relevanceScore * 100).toFixed(1)}%</div>
                    </div>
                  )}
                  {processedData.author && (
                    <div className='space-y-1'>
                      <div className='text-muted-foreground'>Author</div>
                      <div className='font-medium truncate'>{processedData.author}</div>
                    </div>
                  )}
                  {processedData.publishedDate && (
                    <div className='space-y-1'>
                      <div className='text-muted-foreground'>Published</div>
                      <div className='font-medium'>
                        {formatDistanceToNow(new Date(processedData.publishedDate), { addSuffix: true })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Keywords and Entities */}
                {(processedData.keywords?.length > 0 || processedData.entities?.length > 0) && (
                  <>
                    <Separator className='my-3' />
                    <div className='space-y-3'>
                      {processedData.keywords && processedData.keywords.length > 0 && (
                        <div>
                          <div className='text-xs text-muted-foreground mb-2'>Keywords</div>
                          <div className='flex flex-wrap gap-1.5'>
                            {processedData.keywords.map((keyword: string, index: number) => (
                              <Badge key={index} variant='secondary' className='text-xs'>
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {processedData.entities && processedData.entities.length > 0 && (
                        <div>
                          <div className='text-xs text-muted-foreground mb-2'>Entities</div>
                          <div className='flex flex-wrap gap-1.5'>
                            {processedData.entities.map((entity: string, index: number) => (
                              <Badge key={index} variant='outline' className='text-xs'>
                                {entity}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Excerpt */}
                {processedData.excerpt && (
                  <>
                    <Separator className='my-3' />
                    <div>
                      <div className='text-xs text-muted-foreground mb-2'>Excerpt</div>
                      <p className='text-sm text-muted-foreground line-clamp-3'>{processedData.excerpt}</p>
                    </div>
                  </>
                )}
              </div>

              {/* Content Tabs */}
              <div className='flex-1 overflow-hidden'>
                <Tabs value={activeTab} onValueChange={setActiveTab} className='h-full flex flex-col'>
                  <TabsList className='mx-6 mt-4 mb-2 w-auto inline-flex flex-shrink-0'>
                    <TabsTrigger value='markdown' className='flex items-center gap-1.5'>
                      <FileText className='h-3.5 w-3.5' />
                      Markdown Preview
                    </TabsTrigger>
                    <TabsTrigger value='cleaned' className='flex items-center gap-1.5'>
                      <Type className='h-3.5 w-3.5' />
                      Cleaned Content
                    </TabsTrigger>
                    <TabsTrigger value='raw' className='flex items-center gap-1.5'>
                      <Code className='h-3.5 w-3.5' />
                      Raw Content
                    </TabsTrigger>
                  </TabsList>

                  <div className='flex-1 overflow-hidden px-6 pb-6'>
                    <TabsContent value='markdown' className='h-full mt-0'>
                      {processedData.markdown ? (
                        <div className='h-full border rounded-lg overflow-hidden bg-background'>
                          <MarkdownPreview
                            markdownContent={processedData.markdown}
                            showControls={true}
                            size='lg'
                            className='h-full'
                          />
                        </div>
                      ) : (
                        <div className='h-full flex items-center justify-center border rounded-lg bg-muted/30'>
                          <p className='text-sm text-muted-foreground'>No markdown content available</p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value='cleaned' className='h-full mt-0'>
                      {processedData.cleanedContent ? (
                        <ScrollArea className='h-full border rounded-lg bg-muted/30'>
                          <div className='p-4'>
                            <pre className='text-sm whitespace-pre-wrap font-mono'>{processedData.cleanedContent}</pre>
                          </div>
                        </ScrollArea>
                      ) : (
                        <div className='h-full flex items-center justify-center border rounded-lg bg-muted/30'>
                          <p className='text-sm text-muted-foreground'>No cleaned content available</p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value='raw' className='h-full mt-0'>
                      {processedData.rawContent ? (
                        <ScrollArea className='h-full border rounded-lg bg-muted/30'>
                          <div className='p-4'>
                            <pre className='text-sm whitespace-pre-wrap font-mono text-muted-foreground'>
                              {processedData.rawContent}
                            </pre>
                          </div>
                        </ScrollArea>
                      ) : (
                        <div className='h-full flex items-center justify-center border rounded-lg bg-muted/30'>
                          <p className='text-sm text-muted-foreground'>No raw content available</p>
                        </div>
                      )}
                    </TabsContent>
                  </div>
                </Tabs>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
