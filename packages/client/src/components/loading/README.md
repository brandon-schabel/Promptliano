# Intelligent Loading State Components

A comprehensive loading state system designed to improve perceived performance and provide a polished user experience. Built on @promptliano/ui primitives with smart orchestration and accessibility features.

## Features

- **Content-Aware Skeletons**: Specialized skeleton components for different content types
- **Smart Empty States**: Contextual empty states with appropriate actions
- **Loading Orchestration**: Intelligent coordination of multiple loading states
- **Smooth Transitions**: Performant animations with reduced motion support
- **Progressive Loading**: Multi-stage loading with dependency management
- **TanStack Query Integration**: Seamless integration with existing query hooks
- **Accessibility First**: Full screen reader support and keyboard navigation

## Quick Start

### Basic Loading Orchestration

```tsx
import { LoadingOrchestrator } from '@/components/loading'

function ProjectList() {
  const { data: projects, isLoading, error } = useProjects()
  
  return (
    <LoadingOrchestrator
      isLoading={isLoading}
      hasData={!!projects?.length}
      hasError={!!error}
      error={error}
      contentType="table"
      onRetry={() => window.location.reload()}
      onCreateItem={() => navigate('/projects/new')}
    >
      <ProjectTable projects={projects} />
    </LoadingOrchestrator>
  )
}
```

### Progressive Loading

```tsx
import { ProgressiveLoader, useDataProgressiveLoading } from '@/components/loading'

function ProjectDetail({ projectId }: { projectId: string }) {
  const { data: project, isLoading: isLoadingProject } = useProject(projectId)
  const { data: tickets, isLoading: isLoadingTickets } = useTickets(projectId)
  const { data: files, isLoading: isLoadingFiles } = useProjectFiles(projectId)
  
  const progressiveState = useDataProgressiveLoading({
    loadSchema: false, // Skip schema loading for this example
    loadInitialData: isLoadingProject,
    loadRelatedData: isLoadingTickets || isLoadingFiles,
    loadMetadata: false
  })
  
  if (!progressiveState.isComplete) {
    return (
      <DataProgressiveLoader
        isLoadingData={isLoadingProject}
        isLoadingRelated={isLoadingTickets || isLoadingFiles}
        hasData={!!project}
        hasRelated={!!tickets && !!files}
      />
    )
  }
  
  return (
    <ProjectDetailView 
      project={project} 
      tickets={tickets} 
      files={files} 
    />
  )
}
```

### Smart Empty States

```tsx
import { SmartEmptyState, NoDataState } from '@/components/loading'

function TicketList({ searchTerm, filterCount }: Props) {
  const { data: tickets, isLoading } = useTickets()
  
  if (isLoading) {
    return <TicketTableSkeleton />
  }
  
  if (!tickets?.length) {
    if (searchTerm || filterCount > 0) {
      return (
        <NoDataState
          reason={searchTerm ? "searched" : "filtered"}
          entityType="tickets"
          searchTerm={searchTerm}
          filterCount={filterCount}
          onClearSearch={() => setSearchTerm('')}
          onClearFilters={() => clearFilters()}
        />
      )
    }
    
    return (
      <SmartEmptyState
        context="ticket"
        primaryAction={{
          label: 'Create Ticket',
          onClick: () => navigate('/tickets/new')
        }}
      />
    )
  }
  
  return <TicketTable tickets={tickets} />
}
```

## Component Categories

### Skeleton Components

Content-aware skeleton components that match the structure of your actual content:

- **TableSkeleton**: For data tables with configurable columns and rows
- **CardSkeleton**: For card layouts with different variants
- **ListSkeleton**: For list items with various styles
- **TextSkeleton**: For text content with realistic line variations
- **FormSkeleton**: For form layouts with different field types
- **DetailSkeleton**: For complex detail pages with sidebars and tabs

### Empty State Components

Contextual empty states that provide appropriate actions:

- **SmartEmptyState**: Context-aware empty states with suggested actions
- **NoDataState**: Specialized states for search/filter scenarios
- **EmptyCollectionState**: First-time user experience states
- **LoadingFailedState**: Error states with recovery options

### Loading Orchestration

Intelligent coordination of loading states:

- **LoadingOrchestrator**: Main orchestration component
- **ProgressiveLoader**: Multi-stage loading with dependencies
- **useLoadingState**: Hook for loading state management
- **useProgressiveLoading**: Hook for complex loading workflows

### Transition Components

Smooth animations and transitions:

- **LoadingTransition**: Transition between loading and content states
- **ContentTransition**: Advanced content state transitions
- **StaggeredTransition**: Animated list items with stagger effect

## Hooks

### useLoadingState

Manages loading states with intelligent timing:

```tsx
const loadingState = useLoadingState({
  minLoadingTime: 300,    // Prevent flashing
  loadingDelay: 150,      // Delay before showing loading
  queryKeys: ['projects'] // Monitor specific queries
})

if (loadingState.isLoading) {
  return <ProjectTableSkeleton />
}
```

### useSkeletonDelay

Prevents skeleton flashing for fast operations:

```tsx
const skeletonState = useSkeletonDelay({
  delay: 150,           // Delay before showing skeleton
  minShowTime: 300,     // Minimum time to show skeleton
  isLoading: isLoading
})

if (skeletonState.showSkeleton) {
  return <ProjectCardSkeleton />
}
```

### useProgressiveLoading

Manages multi-stage loading workflows:

```tsx
const progressiveState = useProgressiveLoading({
  stages: [
    { id: 'auth', name: 'Authenticating', isRequired: true },
    { id: 'data', name: 'Loading Data', dependencies: ['auth'] },
    { id: 'cache', name: 'Updating Cache', isRequired: false }
  ],
  onStageComplete: (stage) => console.log(`${stage.name} complete`),
  onAllComplete: () => console.log('All loading complete')
})
```

## Integration with TanStack Query

The loading system integrates seamlessly with TanStack Query:

```tsx
import { useLoadingState, TableOrchestrator } from '@/components/loading'

function ProjectsPage() {
  const { 
    data: projects, 
    isLoading, 
    isRefetching, 
    error,
    refetch 
  } = useProjects()
  
  // Intelligent loading state management
  const loadingState = useLoadingState({
    queryKeys: ['projects'],
    showRefetchLoading: false, // Don't show skeleton for refetches
    minLoadingTime: 300
  })
  
  return (
    <TableOrchestrator
      isLoading={loadingState.isLoading}
      hasData={!!projects?.length}
      hasError={!!error}
      error={error}
      totalItems={projects?.length || 0}
      onRetry={refetch}
      onCreateItem={() => navigate('/projects/new')}
      rows={10}
      columns={5}
    >
      <ProjectTable projects={projects} />
    </TableOrchestrator>
  )
}
```

## Accessibility Features

All components include comprehensive accessibility support:

- **Screen Reader Support**: Proper ARIA labels and live regions
- **Keyboard Navigation**: Full keyboard accessibility
- **Reduced Motion**: Respects `prefers-reduced-motion` setting
- **Loading Announcements**: Screen readers announce loading state changes
- **Focus Management**: Proper focus handling during transitions

Example with accessibility:

```tsx
<LoadingOrchestrator
  isLoading={isLoading}
  hasData={hasData}
  contentType="table"
  className="min-h-[400px]" // Prevent layout shift
  aria-label="Project list"
  aria-live="polite" // Announce state changes
>
  <ProjectTable projects={projects} />
</LoadingOrchestrator>
```

## Performance Considerations

The loading system is optimized for performance:

- **Efficient Re-renders**: Minimal re-renders using React.memo and useMemo
- **Transition Optimization**: CSS-based transitions with fallbacks
- **Bundle Size**: Tree-shakeable exports and lazy loading
- **Memory Management**: Proper cleanup of timers and effects

## Customization

### Custom Skeleton Components

```tsx
const CustomSkeleton = () => (
  <div className="space-y-4">
    <Skeleton className="h-8 w-1/3" />
    <div className="grid grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-32 w-full" />
      ))}
    </div>
  </div>
)

<LoadingOrchestrator
  customSkeleton={<CustomSkeleton />}
  contentType="custom"
  // ... other props
>
  {children}
</LoadingOrchestrator>
```

### Custom Empty States

```tsx
const CustomEmptyState = () => (
  <SmartEmptyState
    context="custom"
    title="No data available"
    description="Custom description for your specific use case"
    primaryAction={{
      label: 'Custom Action',
      onClick: handleCustomAction
    }}
  />
)
```

## Best Practices

1. **Choose the Right Component**: Use the most specific skeleton for your content type
2. **Configure Delays**: Adjust delays based on your API response times
3. **Progressive Enhancement**: Start with basic loading, add progressive features
4. **Test Accessibility**: Always test with screen readers and keyboard navigation
5. **Monitor Performance**: Use React DevTools to optimize re-renders
6. **Consistent Timing**: Use consistent loading delays across your app

## Examples

See the `examples/` directory for complete implementation examples:

- Basic data loading
- Progressive loading workflows
- Search and filter scenarios
- Error handling patterns
- Accessibility implementations