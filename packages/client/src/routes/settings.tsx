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
import { UserManagement } from '@/components/settings/user-management'
import {
  ArrowRight,
  Cloud,
  Database,
  FileJson,
  Terminal,
  Zap,
  Router,
  Bug,
  Cpu,
  LogOut,
  User as UserIcon,
  ShieldCheck
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { Alert, AlertDescription } from '@promptliano/ui'

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
  const { logout, user, isLoading: authLoading } = useAuth()
  const {
    useSpacebarToSelectAutocomplete: spacebarToSelectAutocomplete = true,
    hideInformationalTooltips,
    autoScrollEnabled,
    codeThemeDark,
    codeThemeLight,
    theme,
    enableChatAutoNaming = true,
    deepResearchEnabled = false,
    devToolsEnabled = {
      tanstackQuery: false,
      tanstackRouter: false,
      reactScan: false,
      drizzleStudio: false,
      swaggerUI: false,
      mcpInspector: false,
      aiSdk: false
    }
  } = settings
  const isDarkMode = theme === 'dark'
  const drizzleEnvEnabled = (import.meta.env.DEVTOOLS_ENABLE_DRIZZLE_STUDIO ?? 'false') === 'true'
  const mcpInspectorEnvEnabled = (import.meta.env.DEVTOOLS_ENABLE_MCP_INSPECTOR ?? 'false') === 'true'

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
    if ((tool === 'drizzleStudio' && !drizzleEnvEnabled) || (tool === 'mcpInspector' && !mcpInspectorEnvEnabled)) {
      return
    }
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
        <TabsList className='grid w-full grid-cols-5'>
          <TabsTrigger value='general'>General</TabsTrigger>
          <TabsTrigger value='server'>Server</TabsTrigger>
          <TabsTrigger value='global-mcp'>Global MCP</TabsTrigger>
          <TabsTrigger value='users'>Users</TabsTrigger>
          <TabsTrigger value='dev'>Dev</TabsTrigger>
        </TabsList>

        <TabsContent value='general' className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>Manage your account and authentication</CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              {authLoading ? (
                <div className='flex items-center justify-center py-8'>
                  <div className='flex items-center gap-2 text-muted-foreground'>
                    <div className='h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent' />
                    <span>Loading account information...</span>
                  </div>
                </div>
              ) : user ? (
                <div className='space-y-4'>
                  <div className='flex items-center gap-4 p-4 rounded-lg border bg-muted/30'>
                    <div className='flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 flex-shrink-0'>
                      <UserIcon className='h-6 w-6 text-primary' />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <p className='text-sm font-medium'>Logged in as</p>
                      <p className='text-lg font-semibold truncate'>{user.username}</p>
                      <div className='flex items-center gap-2 mt-1'>
                        <ShieldCheck className='h-4 w-4 text-muted-foreground' />
                        <span className='text-sm text-muted-foreground capitalize'>{user.role}</span>
                      </div>
                    </div>
                  </div>

                  <Alert>
                    <AlertDescription className='text-xs'>
                      Logging out will clear your session and require you to sign in again with your username and
                      password.
                    </AlertDescription>
                  </Alert>

                  <Button
                    variant='destructive'
                    onClick={() => logout()}
                    className='w-full'
                    data-testid='settings-logout-button'
                  >
                    <LogOut className='mr-2 h-4 w-4' />
                    Logout
                  </Button>
                </div>
              ) : (
                <div className='flex flex-col items-center justify-center py-8 text-center'>
                  <div className='p-3 bg-muted rounded-full mb-4'>
                    <UserIcon className='h-8 w-8 text-muted-foreground' />
                  </div>
                  <p className='text-sm text-muted-foreground mb-4'>Not logged in</p>
                  <Button asChild>
                    <Link to='/login'>Sign In</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

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
              <CardTitle>Feature Settings</CardTitle>
              <CardDescription>Enable or disable experimental features</CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='flex items-center justify-between'>
                <div className='space-y-0.5'>
                  <Label htmlFor='deep-research-enabled' className='text-sm font-medium'>
                    Deep Research (Beta)
                  </Label>
                  <p className='text-sm text-muted-foreground'>
                    Enable the Deep Research feature for web crawling and research workflows
                  </p>
                </div>
                <Switch
                  id='deep-research-enabled'
                  checked={deepResearchEnabled}
                  onCheckedChange={(checked) => {
                    updateSettings({
                      deepResearchEnabled: checked
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

        <TabsContent value='users' className='space-y-6'>
          <UserManagement />
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

                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-3'>
                      <div className='p-2 bg-teal-100 dark:bg-teal-900 rounded-lg'>
                        <Cpu className='h-5 w-5 text-teal-600 dark:text-teal-400' />
                      </div>
                      <div>
                        <Label className='text-sm font-medium'>AI SDK DevTools</Label>
                        <p className='text-sm text-muted-foreground'>
                          Inspect AI SDK tool calls, state, and performance while developing
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={devToolsEnabled.aiSdk}
                      onCheckedChange={(checked) => handleDevToolToggle('aiSdk', checked)}
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
                      checked={drizzleEnvEnabled && devToolsEnabled.drizzleStudio}
                      onCheckedChange={(checked) => handleDevToolToggle('drizzleStudio', checked)}
                      disabled={!drizzleEnvEnabled}
                    />
                  </div>
                  {!drizzleEnvEnabled && (
                    <p className='text-xs text-muted-foreground pl-11'>
                      Enable by setting <code>DEVTOOLS_ENABLE_DRIZZLE_STUDIO=true</code> in <code>.env</code> then
                      restart dev server.
                    </p>
                  )}

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
                      checked={mcpInspectorEnvEnabled && devToolsEnabled.mcpInspector}
                      onCheckedChange={(checked) => handleDevToolToggle('mcpInspector', checked)}
                      disabled={!mcpInspectorEnvEnabled}
                    />
                  </div>
                  {!mcpInspectorEnvEnabled && (
                    <p className='text-xs text-muted-foreground pl-11'>
                      Enable by setting <code>DEVTOOLS_ENABLE_MCP_INSPECTOR=true</code> in <code>.env</code> then
                      restart dev server.
                    </p>
                  )}
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
