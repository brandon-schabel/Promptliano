import { createFileRoute } from '@tanstack/react-router'
import { DevToolIframe } from '@/components/dev-tools/dev-tool-iframe'
import { useAppSettings } from '@/hooks/use-kv-local-storage'
import { Card, CardContent, CardHeader, CardTitle } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Link } from '@tanstack/react-router'
import { Terminal, Settings, ExternalLink } from 'lucide-react'

function MCPInspectorPage() {
  const [settings] = useAppSettings()
  const devToolsEnabled = settings?.devToolsEnabled

  // MCP Inspector runs on port 6274
  const mcpInspectorUrl = 'http://localhost:6274'

  // Redirect if dev tool is not enabled
  if (!devToolsEnabled?.mcpInspector) {
    return (
      <div className='container mx-auto p-6'>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Terminal className='h-5 w-5' />
              MCP Inspector Not Enabled
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <p className='text-muted-foreground'>
              MCP Inspector is currently disabled. Enable it in the settings to access the Model Context Protocol
              debugging interface.
            </p>
            <div className='flex gap-2'>
              <Button asChild>
                <Link to='/settings' search={{ tab: 'dev' }}>
                  <Settings className='h-4 w-4 mr-2' />
                  Enable in Settings
                </Link>
              </Button>
              <Button variant='outline' asChild>
                <a href={mcpInspectorUrl} target='_blank' rel='noopener noreferrer'>
                  <ExternalLink className='h-4 w-4 mr-2' />
                  Open in New Tab
                </a>
              </Button>
            </div>
            <div className='text-xs text-muted-foreground space-y-1'>
              <p>
                <strong>Note:</strong> MCP Inspector must be started separately using:
              </p>
              <code className='bg-muted px-2 py-1 rounded text-xs'>bun run mcp:inspector</code>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className='h-screen flex flex-col'>
      <DevToolIframe
        title='MCP Inspector'
        description='Model Context Protocol debugging and inspection interface'
        url={mcpInspectorUrl}
        className='flex-1'
        onError={(error) => {
          console.error('MCP Inspector error:', error)
        }}
      />
    </div>
  )
}

export const Route = createFileRoute('/dev-mcp')({
  component: MCPInspectorPage
})
