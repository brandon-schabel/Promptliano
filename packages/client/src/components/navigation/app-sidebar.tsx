import React, { useEffect, useState } from 'react'
import { Link, useMatches, useNavigate } from '@tanstack/react-router'
import { Button } from '@promptliano/ui' // Assuming @ui maps to @/components/ui
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@promptliano/ui'
import { ProjectList } from '@/components/projects/project-list'
import { ProjectDialog } from '@/components/projects/project-dialog'
import { useProjects, useDeleteProject } from '@/hooks/generated'
import { useRecentProjects } from '@/hooks/use-recent-projects'
import { useHotkeys } from 'react-hotkeys-hook'
import packageJson from '../../../package.json'
import {
  FolderIcon,
  MessageSquareIcon,
  Settings as SettingsIcon, // Renamed to avoid conflict with Settings state
  HelpCircleIcon,
  LightbulbIcon,
  MenuIcon, // Icon for SidebarTrigger if needed, or use default
  FolderCogIcon,
  FolderTreeIcon,
  Bot,
  Sparkles,
  Cloud,
  Database,
  FileJson,
  Terminal,
  LogOut,
  User
} from 'lucide-react'
import { HelpDialog } from '@/components/navigation/help-dialog'
import {
  useActiveProjectTab,
  useSelectSetting,
  useUpdateActiveProjectTab,
  useAppSettings
} from '@/hooks/use-kv-local-storage'
import { Logo } from '@promptliano/ui'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
  SidebarRail,
  SectionedSidebarNav
} from '@promptliano/ui' // Correct path to your sidebar.tsx
import { ErrorBoundary } from '@/components/error-boundary/error-boundary'
import { ServerStatusIndicator } from '@/components/navigation/server-status-indicator'
import { useAuth } from '@/contexts/auth-context'

const baseNavigationSections = [
  {
    title: 'Core',
    items: [
      {
        id: 'projects',
        title: 'Projects',
        href: '/projects',
        icon: FolderIcon,
        routeIds: ['/projects'],
        testId: 'sidebar-nav-projects'
      },
      {
        id: 'chat',
        title: 'Chat',
        href: '/chat',
        icon: MessageSquareIcon,
        routeIds: ['/chat'],
        testId: 'sidebar-nav-chat'
      }
    ]
  },
  {
    title: 'Tools',
    items: [
      {
        id: 'prompts',
        title: 'Prompts',
        href: '/prompts',
        icon: LightbulbIcon,
        routeIds: ['/prompts'],
        testId: 'sidebar-nav-prompts'
      },
      {
        id: 'providers',
        title: 'Providers',
        href: '/providers',
        icon: Cloud,
        routeIds: ['/providers'],
        testId: 'sidebar-nav-providers'
      }
    ]
  }
]

export function AppSidebar({ ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const [openProjectListDialog, setOpenProjectListDialog] = useState(false)
  const [projectFormDialogOpen, setProjectFormDialogOpen] = useState(false)
  const [editProjectId, setEditProjectId] = useState<number | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)

  const matches = useMatches()
  const navigate = useNavigate()

  const theme = useSelectSetting('theme')
  const updateActiveProjectTab = useUpdateActiveProjectTab()
  const [activeProjectTabState] = useActiveProjectTab()
  const selectedProjectId = activeProjectTabState?.selectedProjectId
  const { data: projectData, isLoading: projectsLoading } = useProjects()
  const { mutate: deleteProject } = useDeleteProject()
  const { recentProjects, addRecentProject } = useRecentProjects()
  const [settings] = useAppSettings()
  const devToolsEnabled = settings?.devToolsEnabled || {
    tanstackQuery: false,
    tanstackRouter: false,
    reactScan: false,
    drizzleStudio: false,
    swaggerUI: false,
    mcpInspector: false,
    aiSdk: false
  }

  const globalTheme = theme || 'dark'

  // Create dynamic navigation sections based on dev tools enabled
  const navigationSections = React.useMemo(() => {
    const sections = [...baseNavigationSections]

    // Add dev tools section if any dev tools are enabled
    const enabledDevTools = []

    if (devToolsEnabled.drizzleStudio) {
      enabledDevTools.push({
        id: 'dev-drizzle',
        title: 'Drizzle Studio',
        href: '/dev-drizzle',
        icon: Database,
        routeIds: ['/dev-drizzle'],
        testId: 'sidebar-nav-dev-drizzle'
      })
    }

    if (devToolsEnabled.swaggerUI) {
      enabledDevTools.push({
        id: 'dev-swagger',
        title: 'Swagger UI',
        href: '/dev-swagger',
        icon: FileJson,
        routeIds: ['/dev-swagger'],
        testId: 'sidebar-nav-dev-swagger'
      })
    }

    if (devToolsEnabled.mcpInspector) {
      enabledDevTools.push({
        id: 'dev-mcp',
        title: 'MCP Inspector',
        href: '/dev-mcp',
        icon: Terminal,
        routeIds: ['/dev-mcp'],
        testId: 'sidebar-nav-dev-mcp'
      })
    }

    if (enabledDevTools.length > 0) {
      sections.push({
        title: 'Dev Tools',
        items: enabledDevTools
      })
    }

    return sections
  }, [devToolsEnabled])

  useEffect(() => {
    if (globalTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [globalTheme])

  // Hotkeys
  useHotkeys('mod+o', (e: any) => {
    e.preventDefault()
    setOpenProjectListDialog(true)
  })

  useHotkeys('mod+n', (e: any) => {
    // Assuming this was for new project, redirecting to project form
    e.preventDefault()
    handleOpenNewProject()
  })

  const handleSelectProjectInDialog = (id: number) => {
    updateActiveProjectTab((prev) => ({
      ...(prev || {}), // Ensure prev is not null
      selectedProjectId: id,
      selectedFiles: [],
      selectedPrompts: []
    }))
    setOpenProjectListDialog(false)
    navigate({ to: '/projects' })
  }

  const handleOpenNewProject = () => {
    setEditProjectId(null)
    setProjectFormDialogOpen(true)
    setOpenProjectListDialog(false) // Close project list if it was open
  }

  const handleEditProjectInDialog = (id: number) => {
    setEditProjectId(id)
    setProjectFormDialogOpen(true)
    setOpenProjectListDialog(false)
  }

  // The sidebar state (open/collapsed) is managed by SidebarProvider
  const { open } = useSidebar()

  // Auth for logout functionality
  const { logout, user } = useAuth()

  return (
    <ErrorBoundary>
      <>
        <Sidebar collapsible='icon' side='left' variant='sidebar' data-testid='sidebar-container' {...props}>
          <SidebarHeader className='p-2 flex-shrink-0' data-testid='sidebar-header'>
            <div className='flex items-center justify-center relative group-data-[collapsible=icon]:justify-center'>
              <Logo
                size='sm'
                className='absolute left-0 group-data-[collapsible=icon]:relative group-data-[collapsible=icon]:left-auto'
              />
              <span className='text-lg font-semibold group-data-[collapsible=icon]:hidden'>Promptliano</span>
            </div>
          </SidebarHeader>

          <SidebarContent className='p-2 group-data-[collapsible=icon]:p-1 flex flex-col min-h-0'>
            {/* Main Navigation - Always visible */}
            <div className='flex-shrink-0'>
              <SectionedSidebarNav
                activeItem={
                  matches.find((match) =>
                    navigationSections.some((section) =>
                      section.items.some((item) => item.routeIds.includes(match.routeId))
                    )
                  )?.routeId || ''
                }
                sections={navigationSections.map((section) => ({
                  ...section,
                  items: section.items.map((item) => ({
                    ...item,
                    label: item.title,
                    isActive: matches.some((match) => item.routeIds.includes(match.routeId)),
                    'data-testid': item.testId
                  }))
                }))}
                onItemClick={(item: any) => {
                  navigate({ to: item.href })
                }}
              />
            </div>

            {/* Recent Projects Section - Scrollable if needed */}
            {open && recentProjects.length > 0 && projectData && (
              <div className='flex flex-col min-h-0 flex-1' data-testid='sidebar-recent-projects'>
                <div className='px-3 py-2 mt-4 flex-shrink-0'>
                  <p className='text-xs font-medium text-muted-foreground'>Recent Projects</p>
                </div>
                <div className='min-h-0 overflow-y-auto'>
                  <SidebarMenu>
                    {recentProjects
                      .map((id) => projectData?.find((p: any) => p.id === id))
                      .filter(Boolean)
                      .slice(0, 3)
                      .map((project: any) => {
                        const isActive = selectedProjectId === project?.id
                        return (
                          <SidebarMenuItem key={project!.id} className='flex items-center w-full justify-center gap-2'>
                            <SidebarMenuButton asChild isActive={isActive} tooltip={project!.name}>
                              <a
                                className='flex items-center gap-2 cursor-pointer'
                                onClick={() => {
                                  if (project) {
                                    handleSelectProjectInDialog(project.id)
                                  }
                                }}
                              >
                                <FolderIcon className='h-4 w-4 flex-shrink-0' />
                                <span className='truncate'>{project!.name}</span>
                              </a>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        )
                      })}
                  </SidebarMenu>
                </div>
              </div>
            )}

            {/* Spacer to push footer to bottom */}
            <div className='flex-1' />
          </SidebarContent>

          <SidebarFooter className='flex-shrink-0 border-t border-sidebar-border/50'>
            {/* Footer content with proper overflow handling */}
            <div className='max-h-[40vh] overflow-y-auto'>
              <SidebarMenu>
                <SidebarMenuItem className='flex items-center w-full justify-center gap-2 group-data-[collapsible=icon]:hidden'>
                  <ServerStatusIndicator />
                </SidebarMenuItem>
                {user && (
                  <SidebarMenuItem className='flex items-center w-full justify-center gap-2 px-3 py-2 group-data-[collapsible=icon]:hidden'>
                    <div className='flex items-center gap-2 w-full'>
                      <div className='flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 flex-shrink-0'>
                        <User className='h-4 w-4 text-primary' />
                      </div>
                      <div className='flex flex-col min-w-0'>
                        <span className='text-sm font-medium truncate'>{user.username}</span>
                        <span className='text-xs text-muted-foreground capitalize'>{user.role}</span>
                      </div>
                    </div>
                  </SidebarMenuItem>
                )}
                <SidebarMenuItem className='flex items-center w-full justify-center gap-2'>
                  <SidebarMenuButton
                    onClick={() => setOpenProjectListDialog(true)}
                    tooltip='Manage Projects'
                    data-testid='sidebar-manage-projects'
                  >
                    <FolderTreeIcon className='h-4 w-4 flex-shrink-0' />
                    <span className='truncate'>Manage Projects</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem className='flex items-center w-full justify-center gap-2'>
                  <SidebarMenuButton asChild tooltip='Settings'>
                    <Link to='/settings' data-testid='sidebar-nav-settings'>
                      <SettingsIcon className='h-4 w-4 flex-shrink-0' />
                      <span className='truncate'>Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem className='flex items-center w-full justify-center gap-2'>
                  <SidebarMenuButton onClick={() => setHelpOpen(true)} tooltip='Help'>
                    <HelpCircleIcon className='h-4 w-4 flex-shrink-0' />
                    <span className='truncate'>Help</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {user && (
                  <SidebarMenuItem className='flex items-center w-full justify-center gap-2'>
                    <SidebarMenuButton
                      onClick={() => logout()}
                      tooltip='Logout'
                      data-testid='sidebar-logout'
                      className='text-destructive hover:text-destructive hover:bg-destructive/10'
                    >
                      <LogOut className='h-4 w-4 flex-shrink-0' />
                      <span className='truncate'>Logout</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                <SidebarMenuItem className='flex items-center w-full justify-center gap-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden'>
                  <span className='px-3'>v{packageJson.version}</span>
                </SidebarMenuItem>
              </SidebarMenu>
            </div>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        {/* Dialogs remain, controlled by this component's state */}
        <Dialog open={openProjectListDialog} onOpenChange={setOpenProjectListDialog}>
          <DialogContent className='sm:max-w-[425px]'>
            <DialogHeader>
              <DialogTitle>Open Project</DialogTitle>
            </DialogHeader>
            <div className='mt-4'>
              <ProjectList
                loading={projectsLoading}
                projects={projectData ?? []}
                selectedProjectId={selectedProjectId ?? null}
                onSelectProject={handleSelectProjectInDialog}
                onEditProject={handleEditProjectInDialog}
                onDeleteProject={(id) => {
                  deleteProject(id)
                  // Optionally, close dialog or handle UI update
                  // setOpenProjectListDialog(false);
                }}
                onCreateProject={handleOpenNewProject}
              />
            </div>
          </DialogContent>
        </Dialog>

        <ProjectDialog open={projectFormDialogOpen} projectId={editProjectId} onOpenChange={setProjectFormDialogOpen} />
        <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      </>
    </ErrorBoundary>
  )
}
