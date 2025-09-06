import { createFileRoute } from '@tanstack/react-router'
import { DevToolIframe } from '@/components/dev-tools/dev-tool-iframe'
import { useAppSettings } from '@/hooks/use-kv-local-storage'
import { Card, CardContent, CardHeader, CardTitle } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Link } from '@tanstack/react-router'
import { FileJson, Settings } from 'lucide-react'

function SwaggerUIPage() {
  const [settings] = useAppSettings()
  const devToolsEnabled = settings?.devToolsEnabled
  const promptlianoServerUrl = settings?.promptlianoServerUrl || 'http://localhost:3147'

  // Redirect if dev tool is not enabled
  if (!devToolsEnabled?.swaggerUI) {
    return (
      <div className='container mx-auto p-6'>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <FileJson className='h-5 w-5' />
              Swagger UI Not Enabled
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <p className='text-muted-foreground'>
              Swagger UI is currently disabled. Enable it in the settings to access the API documentation and testing interface.
            </p>
            <Button asChild>
              <Link to='/settings' search={{ tab: 'dev' }}>
                <Settings className='h-4 w-4 mr-2' />
                Enable in Settings
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className='h-screen flex flex-col'>
      <DevToolIframe
        title='Swagger UI'
        description='Interactive API documentation and testing interface'
        url={`${promptlianoServerUrl}/swagger`}
        className='flex-1'
        onError={(error) => {
          console.error('Swagger UI error:', error)
        }}
      />
    </div>
  )
}

export const Route = createFileRoute('/dev-swagger')({
  component: SwaggerUIPage
})