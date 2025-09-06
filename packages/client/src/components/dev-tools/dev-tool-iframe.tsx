import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { Loader2, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DevToolIframeProps {
  title: string
  description?: string
  url: string
  className?: string
  onError?: (error: Error) => void
}

export function DevToolIframe({ title, description, url, className, onError }: DevToolIframeProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [iframeKey, setIframeKey] = useState(0)

  const handleIframeLoad = () => {
    setIsLoading(false)
    setHasError(false)
  }

  const handleIframeError = () => {
    setIsLoading(false)
    setHasError(true)
    const error = new Error(`Failed to load ${title} at ${url}`)
    onError?.(error)
  }

  const handleRefresh = () => {
    setIsLoading(true)
    setHasError(false)
    setIframeKey(prev => prev + 1)
  }

  const openInNewTab = () => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (hasError) {
    return (
      <Card className={cn('h-full', className)}>
        <CardHeader className='flex-shrink-0'>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle className='flex items-center gap-2'>
                {title}
                <Badge variant='destructive' className='text-xs'>
                  Error
                </Badge>
              </CardTitle>
              {description && <p className='text-sm text-muted-foreground mt-1'>{description}</p>}
            </div>
          </div>
        </CardHeader>
        <CardContent className='flex-1 flex items-center justify-center'>
          <div className='text-center space-y-4'>
            <AlertCircle className='h-12 w-12 text-destructive mx-auto' />
            <div>
              <h3 className='text-lg font-semibold'>Failed to Load {title}</h3>
              <p className='text-sm text-muted-foreground mt-1'>
                Unable to connect to {url}
              </p>
              <p className='text-xs text-muted-foreground mt-2'>
                Make sure the service is running and accessible
              </p>
            </div>
            <div className='flex gap-2 justify-center'>
              <Button onClick={handleRefresh} variant='outline' size='sm'>
                <RefreshCw className='h-4 w-4 mr-2' />
                Try Again
              </Button>
              <Button onClick={openInNewTab} variant='outline' size='sm'>
                <ExternalLink className='h-4 w-4 mr-2' />
                Open in New Tab
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('h-full flex flex-col', className)}>
      <CardHeader className='flex-shrink-0 border-b'>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle className='flex items-center gap-2'>
              {title}
              {isLoading && (
                <Badge variant='secondary' className='text-xs'>
                  <Loader2 className='h-3 w-3 animate-spin mr-1' />
                  Loading
                </Badge>
              )}
            </CardTitle>
            {description && <p className='text-sm text-muted-foreground mt-1'>{description}</p>}
          </div>
          <div className='flex gap-2'>
            <Button onClick={handleRefresh} variant='ghost' size='sm'>
              <RefreshCw className='h-4 w-4' />
            </Button>
            <Button onClick={openInNewTab} variant='ghost' size='sm'>
              <ExternalLink className='h-4 w-4' />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className='flex-1 p-0 relative overflow-hidden'>
        {isLoading && (
          <div className='absolute inset-0 flex items-center justify-center bg-background/50 z-10'>
            <div className='text-center space-y-2'>
              <Loader2 className='h-8 w-8 animate-spin mx-auto text-primary' />
              <p className='text-sm text-muted-foreground'>Loading {title}...</p>
            </div>
          </div>
        )}
        <iframe
          key={iframeKey}
          src={url}
          className='w-full h-full border-0'
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          title={title}
          sandbox='allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation'
          referrerPolicy='no-referrer-when-downgrade'
        />
      </CardContent>
    </Card>
  )
}