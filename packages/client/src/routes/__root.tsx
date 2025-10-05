// File: packages/client/src/routes/__root.tsx
import { Outlet, createRootRouteWithContext, isRedirect } from '@tanstack/react-router'
import type { AuthStatusResponse } from '@promptliano/api-client'
import type { RouterContext } from '../main'
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
import { useMigrateDefaultTab } from '@/hooks/use-migrate-default-tab'
import { useMigrateTabViews } from '@/hooks/use-migrate-tab-views'
import { useSyncProviderSettings } from '@/hooks/use-sync-provider-settings'
import { useReactScan } from '@/hooks/use-react-scan'
import { useAuth } from '@/contexts/auth-context'
import { Loader2 } from 'lucide-react'
import { redirect } from '@tanstack/react-router'

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
  requirePassword: false,
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
    console.log('[ROOT-GUARD] beforeLoad triggered, pathname:', location.pathname)

    try {
      // Use cached FULL auth status to eliminate redundant API calls
      const cachedStatus = context.queryClient.getQueryData(['auth', 'full-status'])

      const fullStatus = cachedStatus
        ? normalizeAuthStatus(cachedStatus)
        : normalizeAuthStatus(await context.authClient.getAuthStatus())
      context.queryClient.setQueryData(['auth', 'full-status'], fullStatus)

      console.log('[ROOT-GUARD] Using auth status:', fullStatus)

      const authStatus = {
        needsSetup: fullStatus.data.needsSetup,
        authSettings: fullStatus.data.authSettings
      }

      // Keep legacy cache key in sync for downstream consumers
      context.queryClient.setQueryData(['auth', 'setup-status'], authStatus.needsSetup)

      console.log('[ROOT-GUARD] Auth status determined:', {
        needsSetup: authStatus.needsSetup,
        pathname: location.pathname
      })

      // If setup needed and not already on setup page, redirect
      if (authStatus.needsSetup && location.pathname !== '/setup') {
        console.log('[ROOT-GUARD] Setup needed, redirecting to /setup')
        throw redirect({ to: '/setup' })
      }

      // If setup complete but on setup page, redirect to login
      if (!authStatus.needsSetup && location.pathname === '/setup') {
        console.log('[ROOT-GUARD] Setup complete, redirecting to /login')
        const { redirect } = await import('@tanstack/react-router')
        throw redirect({ to: '/login' })
      }

      console.log('[ROOT-GUARD] No redirect needed, returning auth status')
      return {
        setupStatus: { needsSetup: authStatus.needsSetup },
        authSettings: authStatus.authSettings
      }
    } catch (error) {
      if (isRedirect(error)) {
        throw error
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

  // Get dev tools enabled settings
  const devToolsEnabled = settings?.devToolsEnabled || {
    tanstackQuery: false,
    tanstackRouter: false,
    reactScan: false,
    drizzleStudio: false,
    swaggerUI: false,
    mcpInspector: false,
    aiSdk: false
  }

  const isDevEnv = import.meta.env.DEV

  // CRITICAL: Check if we're on setup/login pages
  const isAuthPage = window.location.pathname === '/setup' || window.location.pathname === '/login'

  // Use React Scan hook for dynamic loading
  useReactScan(devToolsEnabled.reactScan)

  // Migrate legacy defaultTab to numeric ID system
  useMigrateDefaultTab()

  // Migrate old tab views to new Manage sub-view structure
  useMigrateTabViews()

  // Sync provider settings (custom URLs) with server
  useSyncProviderSettings()

  // Redirect from old /keys route to new /providers route
  useEffect(() => {
    if (window.location.pathname === '/keys') {
      navigate({ to: '/providers', replace: true })
    }
  }, [])

  // Show loading screen during authentication initialization
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
        {/* defaultOpen={initialSidebarOpen} can be used here */}
        <div className='flex h-screen w-screen bg-background text-foreground'>
          {/* Ensure background and text colors are set */}
          {/* Only render sidebar on non-auth pages */}
          {!isAuthPage && (
            <ComponentErrorBoundary componentName='Sidebar'>
              <AppSidebar data-testid='app-sidebar' />
            </ComponentErrorBoundary>
          )}
          <main className='flex-1 min-h-0 overflow-auto relative' data-testid='main-content'>
            {/* pt-[env(safe-area-inset-top)] can be added if needed */}
            {/* Example of a manual SidebarTrigger fixed in the content area */}
            {/* You might not need this if SidebarRail is sufficient */}
            {!isAuthPage && (
              <div className='absolute top-4 left-4 z-20 md:hidden'>
                {/* Show only on mobile, or remove if rail is enough */}
                <SidebarTrigger asChild>
                  <Button variant='ghost' size='icon'>
                    <MenuIcon />
                  </Button>
                </SidebarTrigger>
              </div>
            )}
            <ComponentErrorBoundary componentName='Main Content'>
              <Outlet />
            </ComponentErrorBoundary>
          </main>
          {/* Only render command palette on non-auth pages */}
          {!isAuthPage && (
            <ComponentErrorBoundary componentName='Command Palette'>
              <GlobalCommandPalette />
            </ComponentErrorBoundary>
          )}
          <ComponentErrorBoundary componentName='Development Tools'>
            {devToolsEnabled.tanstackQuery && (
              <Suspense fallback={null}>
                <ReactQueryDevtools initialIsOpen={false} />
              </Suspense>
            )}
            {devToolsEnabled.tanstackRouter && (
              <Suspense fallback={null}>
                <TanStackRouterDevtools position='bottom-right' />
              </Suspense>
            )}
            {isDevEnv && devToolsEnabled.aiSdk && (
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
