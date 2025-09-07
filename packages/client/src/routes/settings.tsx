import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { settingsSearchSchema, type SettingsSearch } from '@/lib/search-schemas'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Link } from '@tanstack/react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@promptliano/ui'
import { ScrollArea } from '@promptliano/ui'
import { Switch } from '@promptliano/ui'
import { Label } from '@promptliano/ui'
import { Input } from '@promptliano/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@promptliano/ui'
import * as themes from 'react-syntax-highlighter/dist/esm/styles/hljs'
import { useLocalStorage } from '@/hooks/utility-hooks/use-local-storage'
import { Theme } from '@promptliano/schemas'
import { useAppSettings } from '@/hooks/use-kv-local-storage'
import { MCPGlobalConfigEditor } from '@/components/settings/mcp-global-config-editor'
import { ServerConfiguration } from '@/components/settings/server-configuration'
import { ArrowRight, Cloud, Database, FileJson, Terminal, Zap, Router, Bug } from 'lucide-react'

type ThemeOption = {
  label: string
  value: keyof typeof themes
  theme: typeof themes.atomOneLight
}

const themeOptions = Object.entries(themes).map(([key, theme]) => ({
  label: key
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .replace(/^[a-z]/, (str) => str.toUpperCase()),
  value: key as keyof typeof themes,
  theme: theme
})) satisfies ThemeOption[]

export function SettingsPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const [settings, updateSettings] = useAppSettings()
  const {
    useSpacebarToSelectAutocomplete: spacebarToSelectAutocomplete = true,
    hideInformationalTooltips,
    autoScrollEnabled,
    codeThemeDark,
    codeThemeLight,
    theme,
    enableChatAutoNaming = true,
    devToolsEnabled = {
      tanstackQuery: false,
      tanstackRouter: false,
      reactScan: false,
      drizzleStudio: false,
      swaggerUI: false,
      mcpInspector: false
    }
  } = settings
  const isDarkMode = theme === 'dark'

  const [autoRefreshEnabled, setAutoRefreshEnabled] = useLocalStorage('autoRefreshEnabled', true)

  const handleThemeToggle = () => {
    const newTheme: Theme = isDarkMode ? 'light' : 'dark'
    updateSettings({
      theme: newTheme as Theme
    })
  }

  const handleSetCodeTheme = (value: string, isDark: boolean) => {
    const theme = themeOptions.find((t) => t.value === value)
    if (!theme) return

    updateSettings({
      ...(isDark ? { codeThemeDark: value } : { codeThemeLight: value })
    })
  }

  const handleDevToolToggle = (tool: keyof typeof devToolsEnabled, enabled: boolean) => {
    updateSettings({
      devToolsEnabled: {
        ...devToolsEnabled,
        [tool]: enabled
      }
    })
  }

  return (
    <div className='container mx-auto p-6 space-y-6'>
      <div>
        <h1 className='text-3xl font-bold'>Settings</h1>
        <p className='text-muted-foreground'>Manage your application preferences and configuration</p>
      </div>

      <Tabs
        value={search.tab || 'general'}
        onValueChange={(value) => {
          navigate({
            to: '/settings',
            search: { tab: value as SettingsSearch['tab'] },
            replace: true
          })
        }}
        className='w-full'
      >
        <TabsList className='grid w-full grid-cols-4'>
          <TabsTrigger value='general'>General</TabsTrigger>
          <TabsTrigger value='server'>Server</TabsTrigger>
          <TabsTrigger value='global-mcp'>Global MCP</TabsTrigger>
          <TabsTrigger value='dev'>Dev</TabsTrigger>
        </TabsList>

        <TabsContent value='general' className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle>LLM Provider Configuration</CardTitle>
              <CardDescription>Manage API keys and local model providers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='p-2 bg-primary/10 rounded-lg'>
                    <Cloud className='h-5 w-5 text-primary' />
                  </div>
                  <div>
                    <p className='font-medium'>Provider Management</p>
                    <p className='text-sm text-muted-foreground'>Configure API keys, Ollama, LM Studio, and more</p>
                  </div>
                </div>
                <Button asChild>
                  <Link to='/providers'>
                    Manage Providers
                    <ArrowRight className='ml-2 h-4 w-4' />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Configure general application preferences</CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='flex items-center justify-between'>
                <Label htmlFor='auto-refresh' className='text-sm font-medium'>
                  Auto-refresh on Window Focus
                </Label>
                <Switch id='auto-refresh' checked={autoRefreshEnabled} onCheckedChange={setAutoRefreshEnabled} />
              </div>

              <div className='flex items-center justify-between'>
                <Label htmlFor='dark-mode' className='text-sm font-medium'>
                  Dark Mode
                </Label>
                <Switch id='dark-mode' checked={isDarkMode} onCheckedChange={handleThemeToggle} />
              </div>

              <div className='flex items-center justify-between'>
                <Label htmlFor='auto-scroll' className='text-sm font-medium'>
                  Auto-scroll Chat Messages
                </Label>
                <Switch
                  id='auto-scroll'
                  checked={autoScrollEnabled}
                  onCheckedChange={(checked) => {
                    updateSettings({
                      autoScrollEnabled: checked
                    })
                  }}
                />
              </div>

              <div className='flex items-center justify-between'>
                <Label htmlFor='spacebar-select' className='text-sm font-medium'>
                  Use Spacebar to Select Autocomplete
                </Label>
                <Switch
                  id='spacebar-select'
                  checked={spacebarToSelectAutocomplete}
                  onCheckedChange={(checked) => {
                    updateSettings({
                      useSpacebarToSelectAutocomplete: checked
                    })
                  }}
                />
              </div>

              <div className='flex items-center justify-between'>
                <Label htmlFor='hide-informational-tooltips' className='text-sm font-medium'>
                  Hide Informational Tooltips
                </Label>
                <Switch
                  id='hide-informational-tooltips'
                  checked={hideInformationalTooltips}
                  onCheckedChange={(checked) => {
                    updateSettings({
                      hideInformationalTooltips: checked
                    })
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Chat Settings</CardTitle>
              <CardDescription>Configure chat behavior and automatic features</CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='flex items-center justify-between'>
                <Label htmlFor='auto-name-chats' className='text-sm font-medium'>
                  Auto-name Chats
                </Label>
                <Switch
                  id='auto-name-chats'
                  checked={enableChatAutoNaming}
                  onCheckedChange={(checked) => {
                    updateSettings({
                      enableChatAutoNaming: checked
                    })
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Code Editor Themes</CardTitle>
              <CardDescription>Customize syntax highlighting themes for code blocks</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex flex-col gap-2'>
                <Label>Light Mode Code Theme</Label>
                <Select value={codeThemeLight} onValueChange={(value) => handleSetCodeTheme(value, false)}>
                  <SelectTrigger>
                    <SelectValue placeholder='Select theme' />
                  </SelectTrigger>
                  <SelectContent>
                    {themeOptions.map((theme) => (
                      <SelectItem key={theme.value} value={theme.value}>
                        {theme.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='flex flex-col gap-2'>
                <Label>Dark Mode Code Theme</Label>
                <Select value={codeThemeDark} onValueChange={(value) => handleSetCodeTheme(value, true)}>
                  <SelectTrigger>
                    <SelectValue placeholder='Select theme' />
                  </SelectTrigger>
                  <SelectContent>
                    {themeOptions.map((theme) => (
                      <SelectItem key={theme.value} value={theme.value}>
                        {theme.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='server' className='space-y-6'>
          <ServerConfiguration />
        </TabsContent>

        <TabsContent value='global-mcp' className='space-y-6'>
          <MCPGlobalConfigEditor />
        </TabsContent>

        <TabsContent value='dev' className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle>Development Tools</CardTitle>
              <CardDescription>Enable or disable various development tools and debugging interfaces</CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                {/* TanStack DevTools */}
                <div className='space-y-4'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-3'>
                      <div className='p-2 bg-orange-100 dark:bg-orange-900 rounded-lg'>
                        <Zap className='h-5 w-5 text-orange-600 dark:text-orange-400' />
                      </div>
                      <div>
                        <Label className='text-sm font-medium'>TanStack Query DevTools</Label>
                        <p className='text-sm text-muted-foreground'>Debug React Query cache and network requests</p>
                      </div>
                    </div>
                    <Switch
                      checked={devToolsEnabled.tanstackQuery}
                      onCheckedChange={(checked) => handleDevToolToggle('tanstackQuery', checked)}
                    />
                  </div>

                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-3'>
                      <div className='p-2 bg-blue-100 dark:bg-blue-900 rounded-lg'>
                        <Router className='h-5 w-5 text-blue-600 dark:text-blue-400' />
                      </div>
                      <div>
                        <Label className='text-sm font-medium'>TanStack Router DevTools</Label>
                        <p className='text-sm text-muted-foreground'>Debug routing, search params, and navigation</p>
                      </div>
                    </div>
                    <Switch
                      checked={devToolsEnabled.tanstackRouter}
                      onCheckedChange={(checked) => handleDevToolToggle('tanstackRouter', checked)}
                    />
                  </div>

                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-3'>
                      <div className='p-2 bg-green-100 dark:bg-green-900 rounded-lg'>
                        <Bug className='h-5 w-5 text-green-600 dark:text-green-400' />
                      </div>
                      <div>
                        <Label className='text-sm font-medium'>React Scan</Label>
                        <p className='text-sm text-muted-foreground'>
                          Visualize React component performance and re-renders
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={devToolsEnabled.reactScan}
                      onCheckedChange={(checked) => handleDevToolToggle('reactScan', checked)}
                    />
                  </div>
                </div>

                {/* External Tools */}
                <div className='space-y-4'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-3'>
                      <div className='p-2 bg-purple-100 dark:bg-purple-900 rounded-lg'>
                        <Database className='h-5 w-5 text-purple-600 dark:text-purple-400' />
                      </div>
                      <div>
                        <Label className='text-sm font-medium'>Drizzle Studio</Label>
                        <p className='text-sm text-muted-foreground'>Cloud-hosted database management interface</p>
                      </div>
                    </div>
                    <Switch
                      checked={devToolsEnabled.drizzleStudio}
                      onCheckedChange={(checked) => handleDevToolToggle('drizzleStudio', checked)}
                    />
                  </div>

                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-3'>
                      <div className='p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg'>
                        <FileJson className='h-5 w-5 text-indigo-600 dark:text-indigo-400' />
                      </div>
                      <div>
                        <Label className='text-sm font-medium'>Swagger UI</Label>
                        <p className='text-sm text-muted-foreground'>API documentation and testing interface</p>
                      </div>
                    </div>
                    <Switch
                      checked={devToolsEnabled.swaggerUI}
                      onCheckedChange={(checked) => handleDevToolToggle('swaggerUI', checked)}
                    />
                  </div>

                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-3'>
                      <div className='p-2 bg-cyan-100 dark:bg-cyan-900 rounded-lg'>
                        <Terminal className='h-5 w-5 text-cyan-600 dark:text-cyan-400' />
                      </div>
                      <div>
                        <Label className='text-sm font-medium'>MCP Inspector</Label>
                        <p className='text-sm text-muted-foreground'>Model Context Protocol debugging interface</p>
                      </div>
                    </div>
                    <Switch
                      checked={devToolsEnabled.mcpInspector}
                      onCheckedChange={(checked) => handleDevToolToggle('mcpInspector', checked)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Development Tool Information</CardTitle>
              <CardDescription>Information about the development tools and how to use them</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4 text-sm text-muted-foreground'>
              <div>
                <p className='font-medium text-foreground mb-2'>TanStack DevTools:</p>
                <p>
                  When enabled, debugging tools will appear at the bottom of the screen. Use them to inspect query
                  cache, routing state, and component performance.
                </p>
              </div>
              <div>
                <p className='font-medium text-foreground mb-2'>External Tools:</p>
                <p>
                  When enabled, navigation items will appear in the sidebar to access database management, API
                  documentation, and protocol debugging interfaces.
                </p>
              </div>
              <div>
                <p className='font-medium text-foreground mb-2'>Note:</p>
                <p>
                  Development tools are disabled by default and only intended for development environments. Some tools
                  require external services to be running.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export const Route = createFileRoute('/settings')({
  validateSearch: zodValidator(settingsSearchSchema),
  component: SettingsPage
})
