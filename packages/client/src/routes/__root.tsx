// File: packages/client/src/routes/__root.tsx
import { Outlet, createRootRouteWithContext, isRedirect } from '@tanstack/react-router'
import type { AuthStatusResponse } from '@promptliano/api-client'
import type { RouterContext } from '../main'
import { CONNECTION_QUERY_KEY, ConnectionSnapshot, createConnectionSnapshot } from '@/lib/system/connection-status'
import { ServerConnectionOverlay } from '@/components/server-connection/server-connection-overlay'
import { isNetworkError, getNetworkErrorMessage, withTimeout } from '@/lib/system/network'
// Removed: import { AppNavbar } from '@/components/navigation/app-navbar';
import { AppSidebar } from '@/components/navigation/app-sidebar' // Added
import { SidebarProvider, SidebarTrigger } from '@promptliano/ui' // Added
import React, { useState, useEffect, Suspense } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut
} from '@promptliano/ui' // Assuming @ui maps to @/components/ui
import { NavigationCommands } from '@/components/navigation/navigation-commands'
import { ErrorBoundary } from '@/components/error-boundary/error-boundary'
import { ComponentErrorBoundary } from '@/components/error-boundary/component-error-boundary'
import { useProjects } from '@/hooks/generated'
import { useDebounce } from '@/hooks/utility-hooks/use-debounce'
import { useNavigate } from '@tanstack/react-router'
import { useGetActiveProjectTabId, useAppSettings } from '@/hooks/use-kv-local-storage'
import { MenuIcon } from 'lucide-react' // For a custom trigger example
import { Button } from '@promptliano/ui'
import { useAuth } from '@/contexts/auth-context'
import { Loader2 } from 'lucide-react'
import { redirect } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'

// Dynamic imports for DevTools - only load when enabled
const ReactQueryDevtools = React.lazy(() =>
  import('@tanstack/react-query-devtools').then((module) => ({
    default: module.ReactQueryDevtools
  }))
)

const TanStackRouterDevtools = React.lazy(() =>
  import('@tanstack/router-devtools').then((module) => ({
    default: module.TanStackRouterDevtools
  }))
)

const AIDevtools = React.lazy(() =>
  import('@ai-sdk-tools/devtools').then((module) => ({
    default: module.AIDevtools
  }))
)

export const DEFAULT_AUTH_SETTINGS: AuthStatusResponse['data']['authSettings'] = {
  requirePassword: true,
  sessionTimeout: 3600,
  maxLoginAttempts: 5
}

function normalizeAuthSettings(settings: unknown): AuthStatusResponse['data']['authSettings'] {
  if (settings && typeof settings === 'object') {
    const record = settings as Record<string, unknown>
    return {
      requirePassword:
        typeof record.requirePassword === 'boolean' ? record.requirePassword : DEFAULT_AUTH_SETTINGS.requirePassword,
      sessionTimeout:
        typeof record.sessionTimeout === 'number' ? record.sessionTimeout : DEFAULT_AUTH_SETTINGS.sessionTimeout,
      maxLoginAttempts:
        typeof record.maxLoginAttempts === 'number' ? record.maxLoginAttempts : DEFAULT_AUTH_SETTINGS.maxLoginAttempts
    }
  }

  return { ...DEFAULT_AUTH_SETTINGS }
}

export function normalizeAuthStatus(status: unknown): AuthStatusResponse {
  if (status && typeof status === 'object') {
    const candidate = status as Record<string, unknown>

    if ('data' in candidate && typeof candidate.data === 'object' && candidate.data !== null) {
      const data = candidate.data as Record<string, unknown>
      return {
        success: true as const,
        data: {
          needsSetup: typeof data.needsSetup === 'boolean' ? data.needsSetup : false,
          authSettings: normalizeAuthSettings(data.authSettings)
        }
      }
    }

    if ('needsSetup' in candidate) {
      return {
        success: true as const,
        data: {
          needsSetup: typeof candidate.needsSetup === 'boolean' ? (candidate.needsSetup as boolean) : false,
          authSettings: normalizeAuthSettings(candidate.authSettings)
        }
      }
    }
  }

  return {
    success: true as const,
    data: {
      needsSetup: true,
      authSettings: { ...DEFAULT_AUTH_SETTINGS }
    }
  }
}

function GlobalCommandPalette() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const navigate = useNavigate()
  const { data: projectsData } = useProjects()

  useHotkeys('mod+k', (evt) => {
    evt.preventDefault()
    setOpen((o) => !o)
  })

  // Add hotkey for asset generator
  useHotkeys('mod+g', (evt) => {
    evt.preventDefault()
    navigate({ to: '/assets' })
  })

  const filteredProjects = (projectsData ?? [])
    .filter((project: any) => {
      const searchLower = debouncedSearch.toLowerCase()
      return (
        project.name.toLowerCase().includes(searchLower) || project.description?.toLowerCase().includes(searchLower)
      )
    })
    .slice(0, 5)

  return (
    <CommandDialog open={open} onOpenChange={setOpen} data-testid='command-palette'>
      <CommandInput
        placeholder='Type a command or search...'
        value={search}
        onValueChange={setSearch}
        data-testid='command-input'
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading='Navigation'>
          <NavigationCommands onSelect={() => setOpen(false)} />
        </CommandGroup>
        <CommandSeparator />
        {filteredProjects.length > 0 && (
          <>
            <CommandGroup heading='Projects'>
              {filteredProjects.map((project: any) => (
                <CommandItem
                  key={project.id}
                  onSelect={() => {
                    navigate({ to: '/projects', search: { projectId: project.id } })
                    setOpen(false)
                  }}
                >
                  <span>{project.name}</span>
                  {project.description && (
                    <span className='text-muted-foreground text-sm ml-2'>{project.description}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        <CommandGroup heading='Quick Actions'>
          <CommandItem
            onSelect={() => {
              navigate({ to: '/chat', search: { prefill: false } })
              setOpen(false)
            }}
          >
            New Chat
            <CommandShortcut>⌘ N</CommandShortcut>
          </CommandItem>
          <CommandItem // This might now be redundant if "Add Project" is in sidebar's "Open Projects" flow
            onSelect={() => {
              // Potentially trigger the new project dialog from AppSidebar context if needed,
              // or navigate and let AppSidebar handle it.
              // For now, navigating to /projects which should show the project management UI.
              navigate({ to: '/projects' })
              setOpen(false)
            }}
          >
            New Project
            <CommandShortcut>⌘ P</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              navigate({ to: '/prompts' })
              setOpen(false)
            }}
          >
            Manage Prompts
          </CommandItem>
          <CommandItem
            onSelect={() => {
              navigate({ to: '/providers' })
              setOpen(false)
            }}
          >
            Manage Providers
          </CommandItem>
          <CommandItem
            onSelect={() => {
              navigate({ to: '/assets' })
              setOpen(false)
            }}
          >
            Generate Assets
            <CommandShortcut>⌘ G</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading='File Navigation'>
          <CommandItem>
            Open File
            <CommandShortcut>⌘/Ctrl P</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading='Global Actions'>
          <CommandItem>
            Undo <CommandShortcut>⌘/Ctrl Z</CommandShortcut>
          </CommandItem>
          <CommandItem>
            Redo <CommandShortcut>⌘/Ctrl ⇧ Z</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ context, location }) => {
    const existingConnection = context.queryClient.getQueryData<ConnectionSnapshot>(CONNECTION_QUERY_KEY)
    if (existingConnection && existingConnection.status !== 'connected') {
      const cachedFullStatus = context.queryClient.getQueryData(['auth', 'full-status'])
      const normalized = cachedFullStatus ? normalizeAuthStatus(cachedFullStatus) : undefined

      return {
        connection: existingConnection,
        setupStatus: { needsSetup: normalized?.data.needsSetup ?? false },
        authSettings: normalized?.data.authSettings ?? DEFAULT_AUTH_SETTINGS
      }
    }

    try {
      const cachedStatus = context.queryClient.getQueryData(['auth', 'full-status'])

      const fullStatus = cachedStatus
        ? normalizeAuthStatus(cachedStatus)
        : normalizeAuthStatus(await withTimeout(context.authClient.getAuthStatus(), 8000))
      context.queryClient.setQueryData(['auth', 'full-status'], fullStatus)

      context.queryClient.setQueryData(
        CONNECTION_QUERY_KEY,
        createConnectionSnapshot('connected', null, Date.now(), Date.now())
      )

      const authStatus = {
        needsSetup: fullStatus.data.needsSetup,
        authSettings: fullStatus.data.authSettings
      }

      context.queryClient.setQueryData(['auth', 'setup-status'], authStatus.needsSetup)
      context.queryClient.setQueryData(['auth', 'auth-settings'], authStatus.authSettings)

      if (authStatus.needsSetup && location.pathname !== '/setup') {
        throw redirect({ to: '/setup' })
      }

      if (!authStatus.needsSetup && location.pathname === '/setup') {
        const { redirect } = await import('@tanstack/react-router')
        throw redirect({ to: '/login' })
      }

      const connectionSnapshot = createConnectionSnapshot('connected', null, Date.now(), Date.now())
      context.queryClient.setQueryData(CONNECTION_QUERY_KEY, connectionSnapshot)

      return {
        setupStatus: { needsSetup: authStatus.needsSetup },
        authSettings: authStatus.authSettings,
        connection: connectionSnapshot
      }
    } catch (error) {
      if (isRedirect(error)) {
        throw error
      }

      if (isNetworkError(error) || (error instanceof Error && error.message.includes('Request timed out'))) {
        const snapshot = createConnectionSnapshot(
          'disconnected',
          getNetworkErrorMessage(error),
          Date.now(),
          existingConnection?.lastSuccessfulConnectionAt ?? null
        )
        context.queryClient.setQueryData(CONNECTION_QUERY_KEY, snapshot)
        return {
          connection: snapshot,
          setupStatus: { needsSetup: context.queryClient.getQueryData(['auth', 'setup-status']) ?? false },
          authSettings: context.queryClient.getQueryData(['auth', 'auth-settings']) ?? DEFAULT_AUTH_SETTINGS
        }
      }

      console.error('[ROOT-GUARD] Unexpected error during auth status check', error)
      const fallbackStatus = {
        success: true as const,
        data: {
          needsSetup: true,
          authSettings: { ...DEFAULT_AUTH_SETTINGS }
        }
      } satisfies AuthStatusResponse
      context.queryClient.setQueryData(['auth', 'full-status'], fallbackStatus)
      context.queryClient.setQueryData(['auth', 'setup-status'], true)
      const { redirect } = await import('@tanstack/react-router')
      throw redirect({ to: '/setup' })
    }
  },
  component: RootComponent
})

function RootComponent() {
  const [activeProjectTabId] = useGetActiveProjectTabId()
  const navigate = useNavigate()
  const [settings] = useAppSettings()
  const { isLoading: authLoading, needsSetup } = useAuth()
  const queryClient = useQueryClient()
  const connectionSnapshot = queryClient.getQueryData(CONNECTION_QUERY_KEY) as ConnectionSnapshot | undefined

  const isAuthPage = window.location.pathname === '/setup' || window.location.pathname === '/login'

  if (authLoading) {
    return (
      <div className='flex h-screen items-center justify-center bg-background'>
        <div className='flex flex-col items-center gap-4'>
          <Loader2 className='h-8 w-8 animate-spin text-primary' />
          <p className='text-muted-foreground'>Initializing Promptliano...</p>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <SidebarProvider>
        <div className='flex h-screen w-screen bg-background text-foreground'>
          {!isAuthPage && (
            <ComponentErrorBoundary componentName='Sidebar'>
              <AppSidebar data-testid='app-sidebar' />
            </ComponentErrorBoundary>
          )}
          <main className='flex-1 min-h-0 overflow-auto relative' data-testid='main-content'>
            {!isAuthPage && (
              <div className='absolute top-4 left-4 z-20 md:hidden'>
                <SidebarTrigger asChild>
                  <Button variant='ghost' size='icon'>
                    <MenuIcon />
                  </Button>
                </SidebarTrigger>
              </div>
            )}
            {!isAuthPage && connectionSnapshot && connectionSnapshot.status !== 'connected' && (
              <ServerConnectionOverlay />
            )}
            <ComponentErrorBoundary componentName='Main Content'>
              <Outlet />
            </ComponentErrorBoundary>
          </main>
          {!isAuthPage && (
            <ComponentErrorBoundary componentName='Command Palette'>
              <GlobalCommandPalette />
            </ComponentErrorBoundary>
          )}
          <ComponentErrorBoundary componentName='Development Tools'>
            {settings?.devToolsEnabled?.tanstackQuery && (
              <Suspense fallback={null}>
                <ReactQueryDevtools initialIsOpen={false} />
              </Suspense>
            )}
            {settings?.devToolsEnabled?.tanstackRouter && (
              <Suspense fallback={null}>
                <TanStackRouterDevtools position='bottom-right' />
              </Suspense>
            )}
            {import.meta.env.DEV && settings?.devToolsEnabled?.aiSdk && (
              <Suspense fallback={null}>
                <AIDevtools />
              </Suspense>
            )}
          </ComponentErrorBoundary>
        </div>
      </SidebarProvider>
    </ErrorBoundary>
  )
}
