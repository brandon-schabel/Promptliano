import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@promptliano/ui'
import { AlertTriangle, RefreshCcw, WifiOff } from 'lucide-react'
import { useServerConnection } from '@/hooks/use-server-connection'
import { cn } from '@/lib/utils'

export function ServerConnectionOverlay() {
  const {
    connectionStatus,
    connectionError,
    reconnect,
    lastCheckedAt,
    lastSuccessfulConnectionAt,
    isConnecting,
    isConnected
  } = useServerConnection()

  if (isConnected) {
    return null
  }

  const lastCheckedLabel = lastCheckedAt ? new Date(lastCheckedAt).toLocaleTimeString() : 'Never'
  const lastSuccessLabel = lastSuccessfulConnectionAt
    ? new Date(lastSuccessfulConnectionAt).toLocaleTimeString()
    : 'Never'

  const statusMessage = (() => {
    switch (connectionStatus) {
      case 'connecting':
        return 'Attempting to connect to the Promptliano server...'
      case 'disconnected':
        return 'We lost connection to your Promptliano server.'
      case 'error':
        return connectionError ?? 'Unexpected error connecting to the server.'
      default:
        return 'Connection status unknown.'
    }
  })()

  const icon =
    connectionStatus === 'error' ? (
      <AlertTriangle className='h-10 w-10 text-destructive' />
    ) : (
      <WifiOff className='h-10 w-10 text-muted-foreground' />
    )

  return (
    <div className='fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-sm px-4'>
      <Card className='w-full max-w-xl shadow-lg'>
        <CardHeader className='flex flex-col items-center text-center space-y-4'>
          {icon}
          <CardTitle className='text-2xl font-semibold'>Connection Lost</CardTitle>
          <CardDescription className='text-base text-muted-foreground'>{statusMessage}</CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='space-y-2 rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground'>
            <div className='flex items-center justify-between'>
              <span className='font-medium text-foreground'>Last checked</span>
              <span>{lastCheckedLabel}</span>
            </div>
            <div className='flex items-center justify-between'>
              <span className='font-medium text-foreground'>Last successful connection</span>
              <span>{lastSuccessLabel}</span>
            </div>
            {connectionError && <div className='pt-2 text-xs text-destructive'>{connectionError}</div>}
          </div>

          <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-center'>
            <Button
              type='button'
              variant='default'
              size='lg'
              className='md:w-auto'
              disabled={isConnecting}
              onClick={() => reconnect()}
            >
              <RefreshCcw className={cn('mr-2 h-4 w-4', isConnecting && 'animate-spin')} />
              {isConnecting ? 'Reconnecting...' : 'Retry Connection'}
            </Button>
            <Button type='button' variant='outline' size='lg' className='md:w-auto' disabled>
              Change Server URL (coming soon)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
