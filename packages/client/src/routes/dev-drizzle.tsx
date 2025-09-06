import { createFileRoute, redirect } from '@tanstack/react-router'
import { DevToolIframe } from '@/components/dev-tools/dev-tool-iframe'
import { useAppSettings } from '@/hooks/use-kv-local-storage'
import { Card, CardContent, CardHeader, CardTitle } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Link } from '@tanstack/react-router'
import { Database, Settings } from 'lucide-react'

function DrizzleStudioPage() {
  const [settings] = useAppSettings()
  const devToolsEnabled = settings?.devToolsEnabled

  // Redirect if dev tool is not enabled
  if (!devToolsEnabled?.drizzleStudio) {
    return (
      <div className='container mx-auto p-6'>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Database className='h-5 w-5' />
              Drizzle Studio Not Enabled
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <p className='text-muted-foreground'>
              Drizzle Studio is currently disabled. Enable it in the settings to access the database management interface.
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
        title='Drizzle Studio'
        description='Cloud-hosted database management and visual query builder'
        url='https://local.drizzle.studio'
        className='flex-1'
        onError={(error) => {
          console.error('Drizzle Studio error:', error)
        }}
      />
    </div>
  )
}

export const Route = createFileRoute('/dev-drizzle')({
  beforeLoad: async ({ context }) => {
    // We could check if the tool is enabled here and redirect if not,
    // but we'll handle it in the component to show a proper message
  },
  component: DrizzleStudioPage
})