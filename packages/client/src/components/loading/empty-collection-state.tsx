import React from 'react'
import { cn } from '@promptliano/ui/utils'
import { EmptyState, type EmptyStateAction } from '@promptliano/ui'
import { 
  Plus, 
  Upload, 
  Download, 
  FileText, 
  Users, 
  Calendar, 
  Tag, 
  Folder,
  Settings,
  Sparkles,
  BookOpen,
  Layers
} from 'lucide-react'

export interface EmptyCollectionStateProps {
  collectionType: 'project' | 'ticket' | 'chat' | 'file' | 'user' | 'tag' | 'category' | 'workspace' | 'template'
  onCreateItem?: () => void
  onImportItems?: () => void
  onBrowseTemplates?: () => void
  onGetStarted?: () => void
  showWelcome?: boolean
  isFirstTime?: boolean
  className?: string
}

export function EmptyCollectionState({
  collectionType,
  onCreateItem,
  onImportItems,
  onBrowseTemplates,
  onGetStarted,
  showWelcome = false,
  isFirstTime = false,
  className
}: EmptyCollectionStateProps) {
  const getCollectionContent = () => {
    switch (collectionType) {
      case 'project':
        return {
          icon: Folder,
          title: isFirstTime ? 'Welcome to Promptliano!' : 'No projects yet',
          description: isFirstTime 
            ? 'Create your first project to start organizing your work, tracking progress, and collaborating with AI assistants.'
            : 'Projects help you organize tickets, files, and conversations. Create your first project to get started.',
          tip: 'Projects are the foundation of your workspace - they contain all your tickets, files, and AI conversations',
          primaryAction: {
            label: isFirstTime ? 'Create Your First Project' : 'Create Project',
            onClick: onCreateItem || (() => {}),
            icon: Plus,
            variant: 'default' as const
          },
          secondaryActions: [
            ...(onBrowseTemplates ? [{
              label: 'Browse Templates',
              onClick: onBrowseTemplates,
              icon: BookOpen,
              variant: 'outline' as const
            }] : []),
            ...(onImportItems ? [{
              label: 'Import Project',
              onClick: onImportItems,
              icon: Upload,
              variant: 'outline' as const
            }] : [])
          ]
        }

      case 'ticket':
        return {
          icon: FileText,
          title: 'No tickets in this project',
          description: 'Tickets help you track tasks, bugs, and features. Break down your project work into manageable pieces.',
          tip: 'Good tickets are specific, actionable, and have clear success criteria',
          primaryAction: {
            label: 'Create First Ticket',
            onClick: onCreateItem || (() => {}),
            icon: Plus,
            variant: 'default' as const
          },
          secondaryActions: [
            ...(onBrowseTemplates ? [{
              label: 'Use Template',
              onClick: onBrowseTemplates,
              icon: Layers,
              variant: 'outline' as const
            }] : []),
            ...(onImportItems ? [{
              label: 'Import from CSV',
              onClick: onImportItems,
              icon: Upload,
              variant: 'outline' as const
            }] : [])
          ]
        }

      case 'chat':
        return {
          icon: Users,
          title: 'No AI conversations yet',
          description: 'Start conversations with AI assistants to get help with coding, planning, problem-solving, and more.',
          tip: 'AI assistants can help with code reviews, architecture decisions, and creative problem-solving',
          primaryAction: {
            label: 'Start AI Chat',
            onClick: onCreateItem || (() => {}),
            icon: Sparkles,
            variant: 'default' as const
          },
          secondaryActions: [
            ...(onBrowseTemplates ? [{
              label: 'Browse Assistants',
              onClick: onBrowseTemplates,
              icon: Users,
              variant: 'outline' as const
            }] : [])
          ]
        }

      case 'file':
        return {
          icon: FileText,
          title: 'No files in this project',
          description: 'Upload project files, documentation, or create new files to organize your work.',
          tip: 'Keep your files organized with clear naming and folder structure',
          primaryAction: {
            label: 'Upload Files',
            onClick: onCreateItem || (() => {}),
            icon: Upload,
            variant: 'default' as const
          },
          secondaryActions: [
            ...(onCreateItem ? [{
              label: 'Create File',
              onClick: onCreateItem,
              icon: Plus,
              variant: 'outline' as const
            }] : []),
            ...(onImportItems ? [{
              label: 'Import from Git',
              onClick: onImportItems,
              icon: Download,
              variant: 'outline' as const
            }] : [])
          ]
        }

      case 'user':
        return {
          icon: Users,
          title: 'No team members yet',
          description: 'Invite team members to collaborate on projects and share work.',
          tip: 'Collaboration makes projects more successful and helps share knowledge',
          primaryAction: {
            label: 'Invite Members',
            onClick: onCreateItem || (() => {}),
            icon: Plus,
            variant: 'default' as const
          },
          secondaryActions: [
            ...(onImportItems ? [{
              label: 'Import from CSV',
              onClick: onImportItems,
              icon: Upload,
              variant: 'outline' as const
            }] : [])
          ]
        }

      case 'tag':
        return {
          icon: Tag,
          title: 'No tags created',
          description: 'Create tags to organize and categorize your tickets, files, and other content.',
          tip: 'Good tags are consistent and help you find content quickly',
          primaryAction: {
            label: 'Create Tag',
            onClick: onCreateItem || (() => {}),
            icon: Plus,
            variant: 'default' as const
          },
          secondaryActions: [
            ...(onBrowseTemplates ? [{
              label: 'Use Presets',
              onClick: onBrowseTemplates,
              icon: Layers,
              variant: 'outline' as const
            }] : [])
          ]
        }

      case 'category':
        return {
          icon: Folder,
          title: 'No categories defined',
          description: 'Create categories to organize your content into logical groups.',
          tip: 'Categories help structure your workspace and make navigation easier',
          primaryAction: {
            label: 'Create Category',
            onClick: onCreateItem || (() => {}),
            icon: Plus,
            variant: 'default' as const
          },
          secondaryActions: []
        }

      case 'workspace':
        return {
          icon: Layers,
          title: isFirstTime ? 'Welcome to your workspace!' : 'Empty workspace',
          description: isFirstTime 
            ? 'Your workspace is where all your projects, conversations, and collaboration happen. Let\'s get you started!'
            : 'Create projects and organize your work in this dedicated workspace.',
          tip: 'Workspaces help separate different contexts like work, personal, or client projects',
          primaryAction: {
            label: 'Set Up Workspace',
            onClick: onGetStarted || onCreateItem || (() => {}),
            icon: Settings,
            variant: 'default' as const
          },
          secondaryActions: [
            ...(onBrowseTemplates ? [{
              label: 'Browse Templates',
              onClick: onBrowseTemplates,
              icon: BookOpen,
              variant: 'outline' as const
            }] : [])
          ]
        }

      case 'template':
        return {
          icon: Layers,
          title: 'No templates available',
          description: 'Create reusable templates to speed up project setup and ensure consistency.',
          tip: 'Templates save time and help maintain consistent project structures',
          primaryAction: {
            label: 'Create Template',
            onClick: onCreateItem || (() => {}),
            icon: Plus,
            variant: 'default' as const
          },
          secondaryActions: [
            ...(onImportItems ? [{
              label: 'Import Template',
              onClick: onImportItems,
              icon: Upload,
              variant: 'outline' as const
            }] : [])
          ]
        }

      default:
        return {
          icon: FileText,
          title: 'Nothing here yet',
          description: 'Get started by creating your first item.',
          tip: 'This collection will fill up as you add content',
          primaryAction: {
            label: 'Get Started',
            onClick: onCreateItem || (() => {}),
            icon: Plus,
            variant: 'default' as const
          },
          secondaryActions: []
        }
    }
  }

  const content = getCollectionContent()
  const variant = isFirstTime || showWelcome ? 'decorated' : 'card'

  return (
    <EmptyState
      icon={content.icon}
      title={content.title}
      description={content.description}
      actions={[content.primaryAction, ...content.secondaryActions]}
      tip={content.tip}
      variant={variant}
      className={cn(
        isFirstTime && 'min-h-[500px]',
        className
      )}
    />
  )
}

// Convenience components for specific collection types
export interface EmptyProjectCollectionProps {
  onCreateProject?: () => void
  onImportProject?: () => void
  onBrowseTemplates?: () => void
  isFirstTime?: boolean
  className?: string
}

export function EmptyProjectCollection({ 
  onCreateProject, 
  onImportProject, 
  onBrowseTemplates,
  isFirstTime = false,
  className 
}: EmptyProjectCollectionProps) {
  return (
    <EmptyCollectionState
      collectionType='project'
      onCreateItem={onCreateProject}
      onImportItems={onImportProject}
      onBrowseTemplates={onBrowseTemplates}
      isFirstTime={isFirstTime}
      showWelcome={isFirstTime}
      className={className}
    />
  )
}

export interface EmptyTicketCollectionProps {
  onCreateTicket?: () => void
  onImportTickets?: () => void
  onBrowseTemplates?: () => void
  className?: string
}

export function EmptyTicketCollection({ 
  onCreateTicket, 
  onImportTickets, 
  onBrowseTemplates,
  className 
}: EmptyTicketCollectionProps) {
  return (
    <EmptyCollectionState
      collectionType='ticket'
      onCreateItem={onCreateTicket}
      onImportItems={onImportTickets}
      onBrowseTemplates={onBrowseTemplates}
      className={className}
    />
  )
}

export interface EmptyChatCollectionProps {
  onStartChat?: () => void
  onBrowseAssistants?: () => void
  className?: string
}

export function EmptyChatCollection({ 
  onStartChat, 
  onBrowseAssistants,
  className 
}: EmptyChatCollectionProps) {
  return (
    <EmptyCollectionState
      collectionType='chat'
      onCreateItem={onStartChat}
      onBrowseTemplates={onBrowseAssistants}
      className={className}
    />
  )
}