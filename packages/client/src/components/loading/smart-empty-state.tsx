import React from 'react'
import { cn } from '@promptliano/ui/utils'
import { EmptyState, type EmptyStateAction } from '@promptliano/ui'
import { 
  Plus, 
  Search, 
  Filter, 
  RefreshCw, 
  Upload, 
  Download,
  Settings,
  HelpCircle,
  Zap,
  FileText,
  Users,
  Database,
  Globe,
  Lightbulb
} from 'lucide-react'

export interface SmartEmptyStateProps {
  context: 'project' | 'ticket' | 'chat' | 'file' | 'user' | 'data' | 'search' | 'filter' | 'error' | 'permission'
  title?: string
  description?: string
  variant?: 'simple' | 'card' | 'decorated' | 'minimal'
  primaryAction?: EmptyStateAction
  secondaryActions?: EmptyStateAction[]
  searchTerm?: string
  filterCount?: number
  showHelp?: boolean
  className?: string
}

export function SmartEmptyState({
  context,
  title,
  description,
  variant = 'simple',
  primaryAction,
  secondaryActions = [],
  searchTerm,
  filterCount,
  showHelp = true,
  className
}: SmartEmptyStateProps) {
  const getContextualContent = () => {
    switch (context) {
      case 'project':
        return {
          icon: FileText,
          defaultTitle: 'No projects yet',
          defaultDescription: 'Create your first project to start organizing your work and collaborating with your team.',
          tip: 'Projects help organize tickets, files, and team collaboration',
          suggestedActions: [
            {
              label: 'Create Project',
              onClick: primaryAction?.onClick || (() => {}),
              icon: Plus,
              variant: 'default' as const
            },
            {
              label: 'Import Project',
              onClick: () => {},
              icon: Upload,
              variant: 'outline' as const
            },
            {
              label: 'Browse Templates',
              onClick: () => {},
              icon: Globe,
              variant: 'outline' as const
            }
          ]
        }

      case 'ticket':
        return {
          icon: FileText,
          defaultTitle: 'No tickets found',
          defaultDescription: 'Create tickets to track tasks, bugs, features, and collaborate on project work.',
          tip: 'Break down work into manageable tickets for better tracking',
          suggestedActions: [
            {
              label: 'Create Ticket',
              onClick: primaryAction?.onClick || (() => {}),
              icon: Plus,
              variant: 'default' as const
            },
            {
              label: 'Import from CSV',
              onClick: () => {},
              icon: Upload,
              variant: 'outline' as const
            }
          ]
        }

      case 'chat':
        return {
          icon: Users,
          defaultTitle: 'No conversations yet',
          defaultDescription: 'Start a conversation with AI assistants to get help with your projects and tasks.',
          tip: 'AI assistants can help with code, planning, and problem-solving',
          suggestedActions: [
            {
              label: 'Start Chat',
              onClick: primaryAction?.onClick || (() => {}),
              icon: Plus,
              variant: 'default' as const
            },
            {
              label: 'Browse Assistants',
              onClick: () => {},
              icon: Users,
              variant: 'outline' as const
            }
          ]
        }

      case 'file':
        return {
          icon: FileText,
          defaultTitle: 'No files found',
          defaultDescription: 'Upload or create files to start working on your project.',
          tip: 'Organize files by type and keep them up to date',
          suggestedActions: [
            {
              label: 'Upload Files',
              onClick: primaryAction?.onClick || (() => {}),
              icon: Upload,
              variant: 'default' as const
            },
            {
              label: 'Create File',
              onClick: () => {},
              icon: Plus,
              variant: 'outline' as const
            }
          ]
        }

      case 'search':
        return {
          icon: Search,
          defaultTitle: 'No results found',
          defaultDescription: searchTerm 
            ? `No results found for "${searchTerm}". Try adjusting your search terms.`
            : 'Try different search terms or browse all items.',
          tip: 'Use keywords, file types, or date ranges to refine your search',
          suggestedActions: [
            {
              label: 'Clear Search',
              onClick: primaryAction?.onClick || (() => {}),
              icon: RefreshCw,
              variant: 'outline' as const
            },
            {
              label: 'Browse All',
              onClick: () => {},
              icon: Database,
              variant: 'outline' as const
            }
          ]
        }

      case 'filter':
        return {
          icon: Filter,
          defaultTitle: 'No matches found',
          defaultDescription: filterCount 
            ? `No items match your ${filterCount} active filter${filterCount > 1 ? 's' : ''}. Try adjusting or removing some filters.`
            : 'No items match the current filters. Try adjusting your criteria.',
          tip: 'Remove filters one by one to find the items you\'re looking for',
          suggestedActions: [
            {
              label: 'Clear Filters',
              onClick: primaryAction?.onClick || (() => {}),
              icon: RefreshCw,
              variant: 'outline' as const
            },
            {
              label: 'Reset View',
              onClick: () => {},
              icon: Database,
              variant: 'outline' as const
            }
          ]
        }

      case 'error':
        return {
          icon: RefreshCw,
          defaultTitle: 'Something went wrong',
          defaultDescription: 'We encountered an error while loading the data. Please try again.',
          tip: 'If the problem persists, check your connection or contact support',
          suggestedActions: [
            {
              label: 'Try Again',
              onClick: primaryAction?.onClick || (() => {}),
              icon: RefreshCw,
              variant: 'default' as const
            },
            {
              label: 'Report Issue',
              onClick: () => {},
              icon: HelpCircle,
              variant: 'outline' as const
            }
          ]
        }

      case 'permission':
        return {
          icon: Settings,
          defaultTitle: 'Access restricted',
          defaultDescription: 'You don\'t have permission to view this content. Contact an administrator for access.',
          tip: 'Check with your team lead or project owner for the right permissions',
          suggestedActions: [
            {
              label: 'Request Access',
              onClick: primaryAction?.onClick || (() => {}),
              icon: HelpCircle,
              variant: 'default' as const
            },
            {
              label: 'Go Back',
              onClick: () => {},
              icon: RefreshCw,
              variant: 'outline' as const
            }
          ]
        }

      case 'data':
        return {
          icon: Database,
          defaultTitle: 'No data available',
          defaultDescription: 'There\'s no data to display right now. Create some content or check back later.',
          tip: 'Data will appear here once you start creating content',
          suggestedActions: [
            {
              label: 'Add Data',
              onClick: primaryAction?.onClick || (() => {}),
              icon: Plus,
              variant: 'default' as const
            },
            {
              label: 'Import Data',
              onClick: () => {},
              icon: Upload,
              variant: 'outline' as const
            }
          ]
        }

      default:
        return {
          icon: Lightbulb,
          defaultTitle: 'Nothing here yet',
          defaultDescription: 'Get started by creating your first item.',
          tip: 'This area will fill up as you add content',
          suggestedActions: [
            {
              label: 'Get Started',
              onClick: primaryAction?.onClick || (() => {}),
              icon: Zap,
              variant: 'default' as const
            }
          ]
        }
    }
  }

  const contextualContent = getContextualContent()
  
  // Merge provided actions with contextual suggestions
  const allActions = [
    ...(primaryAction ? [primaryAction] : contextualContent.suggestedActions.slice(0, 1)),
    ...secondaryActions,
    ...contextualContent.suggestedActions.slice(primaryAction ? 1 : 1)
  ].slice(0, 3) // Limit to 3 actions for clean UX

  const helpAction = showHelp ? {
    label: 'Get Help',
    onClick: () => {},
    icon: HelpCircle,
    variant: 'ghost' as const
  } : undefined

  return (
    <EmptyState
      icon={contextualContent.icon}
      title={title || contextualContent.defaultTitle}
      description={description || contextualContent.defaultDescription}
      actions={[...allActions, ...(helpAction ? [helpAction] : [])]}
      tip={contextualContent.tip}
      variant={variant}
      className={className}
    />
  )
}

// Specialized smart empty states for common scenarios
export interface ProjectEmptyStateProps {
  onCreateProject?: () => void
  onImportProject?: () => void
  className?: string
}

export function ProjectEmptyState({ 
  onCreateProject, 
  onImportProject, 
  className 
}: ProjectEmptyStateProps) {
  return (
    <SmartEmptyState
      context='project'
      variant='decorated'
      primaryAction={onCreateProject ? {
        label: 'Create Project',
        onClick: onCreateProject,
        icon: Plus,
        variant: 'default'
      } : undefined}
      secondaryActions={onImportProject ? [{
        label: 'Import Project',
        onClick: onImportProject,
        icon: Upload,
        variant: 'outline'
      }] : []}
      className={className}
    />
  )
}

export interface SearchEmptyStateProps {
  searchTerm?: string
  onClearSearch?: () => void
  onBrowseAll?: () => void
  className?: string
}

export function SearchEmptyState({ 
  searchTerm, 
  onClearSearch, 
  onBrowseAll,
  className 
}: SearchEmptyStateProps) {
  return (
    <SmartEmptyState
      context='search'
      variant='minimal'
      searchTerm={searchTerm}
      primaryAction={onClearSearch ? {
        label: 'Clear Search',
        onClick: onClearSearch,
        icon: RefreshCw,
        variant: 'outline'
      } : undefined}
      secondaryActions={onBrowseAll ? [{
        label: 'Browse All',
        onClick: onBrowseAll,
        icon: Database,
        variant: 'outline'
      }] : []}
      showHelp={false}
      className={className}
    />
  )
}

export interface FilterEmptyStateProps {
  filterCount?: number
  onClearFilters?: () => void
  onResetView?: () => void
  className?: string
}

export function FilterEmptyState({ 
  filterCount, 
  onClearFilters, 
  onResetView,
  className 
}: FilterEmptyStateProps) {
  return (
    <SmartEmptyState
      context='filter'
      variant='minimal'
      filterCount={filterCount}
      primaryAction={onClearFilters ? {
        label: 'Clear Filters',
        onClick: onClearFilters,
        icon: RefreshCw,
        variant: 'outline'
      } : undefined}
      secondaryActions={onResetView ? [{
        label: 'Reset View',
        onClick: onResetView,
        icon: Database,
        variant: 'outline'
      }] : []}
      showHelp={false}
      className={className}
    />
  )
}