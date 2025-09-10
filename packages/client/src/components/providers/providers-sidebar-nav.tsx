import React from 'react'
import { SectionedSidebarNav } from '@promptliano/ui'
import { Grid3x3, Cloud, Monitor, Sliders, Sparkles, Activity } from 'lucide-react'

export type ProvidersView = 'overview' | 'api' | 'local' | 'presets' | 'copilot' | 'health'

interface ProvidersSidebarNavProps {
  activeView: ProvidersView
  onViewChange: (view: ProvidersView) => void
  className?: string
}

export function ProvidersSidebarNav({ activeView, onViewChange, className }: ProvidersSidebarNavProps) {
  const sections = [
    {
      title: 'Providers',
      items: [
        { id: 'overview', title: 'Overview', description: 'At-a-glance provider status', icon: Grid3x3 },
        { id: 'api', title: 'API Providers', description: 'Cloud providers and keys', icon: Cloud },
        { id: 'local', title: 'Local Providers', description: 'Ollama and LM Studio', icon: Monitor },
        { id: 'presets', title: 'Presets', description: 'Model presets and defaults', icon: Sliders }
      ]
    },
    {
      title: 'Integrations',
      items: [
        { id: 'copilot', title: 'GitHub Copilot', description: 'Embedded proxy and auth', icon: Sparkles },
        { id: 'health', title: 'Health', description: 'Connectivity diagnostics', icon: Activity }
      ]
    }
  ]

  return (
    <div className={className}>
      <SectionedSidebarNav
        sections={sections.map((section) => ({
          ...section,
          items: section.items.map((item) => ({ ...item, label: item.title, isActive: item.id === activeView }))
        }))}
        activeItem={activeView}
        onItemClick={(item: any) => onViewChange(item.id as ProvidersView)}
      />
    </div>
  )
}
