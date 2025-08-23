/**
 * Intelligent Loading State Components
 * 
 * Comprehensive loading state system for improved perceived performance.
 * Built on @promptliano/ui primitives with smart orchestration.
 */

// Content-aware skeleton components
export { 
  TableSkeleton, 
  ProjectTableSkeleton, 
  TicketTableSkeleton, 
  CompactTableSkeleton 
} from './table-skeleton'

export { 
  CardSkeleton, 
  ProjectCardSkeleton, 
  TicketCardSkeleton, 
  StatCardSkeleton, 
  CompactCardSkeleton 
} from './card-skeleton'

export { 
  ListSkeleton, 
  FileListSkeleton, 
  ChatListSkeleton, 
  NotificationListSkeleton, 
  SearchResultsSkeleton 
} from './list-skeleton'

export { 
  TextSkeleton, 
  TitleSkeleton, 
  ParagraphSkeleton, 
  CodeBlockSkeleton, 
  MetadataSkeleton, 
  BreadcrumbSkeleton, 
  ArticleSkeleton 
} from './text-skeleton'

export { 
  FormSkeleton, 
  LoginFormSkeleton, 
  ProjectFormSkeleton, 
  SettingsFormSkeleton 
} from './form-skeleton'

export { 
  DetailSkeleton, 
  ProjectDetailSkeleton, 
  TicketDetailSkeleton, 
  DashboardSkeleton, 
  SettingsDetailSkeleton 
} from './detail-skeleton'

// Enhanced empty states
export { 
  SmartEmptyState, 
  ProjectEmptyState, 
  SearchEmptyState, 
  FilterEmptyState 
} from './smart-empty-state'

export { 
  NoDataState, 
  NoProjectsState, 
  NoTicketsState, 
  NoChatsState, 
  NoFilesState 
} from './no-data-state'

export { 
  EmptyCollectionState, 
  EmptyProjectCollection, 
  EmptyTicketCollection, 
  EmptyChatCollection 
} from './empty-collection-state'

export { 
  LoadingFailedState, 
  NetworkErrorState, 
  ServerErrorState, 
  PermissionErrorState 
} from './loading-failed-state'

// Loading orchestration hooks
export { 
  useLoadingState, 
  useEntityLoadingState, 
  useMultiQueryLoadingState, 
  useProgressiveLoadingState 
} from './use-loading-state'

export { 
  useProgressiveLoading, 
  useDataProgressiveLoading 
} from './use-progressive-loading'

export { 
  useSkeletonDelay, 
  useMultiSkeletonDelay, 
  useConditionalSkeleton, 
  useSkeletonTransition 
} from './use-skeleton-delay'

export { 
  useLoadingTransition, 
  useStaggeredLoadingTransition, 
  useContentTransition 
} from './use-loading-transition'

// Progressive loading components
export { 
  ProgressiveLoader, 
  DataProgressiveLoader, 
  SimpleProgressiveLoader 
} from './progressive-loader'

export { 
  LoadingOrchestrator, 
  TableOrchestrator, 
  CardGridOrchestrator 
} from './loading-orchestrator'

// Transition components
export { 
  LoadingTransition, 
  StaggeredTransition, 
  CrossFadeTransition, 
  SlideTransition, 
  ScaleTransition 
} from './loading-transition'

export { 
  ContentTransition, 
  SmartContentTransition, 
  ProgressiveContentTransition, 
  ConditionalTransition 
} from './content-transition'

// Type exports
export type { 
  LoadingStateConfig,
  LoadingState,
  EntityLoadingConfig,
  MultiQueryLoadingConfig,
  ProgressiveLoadingConfig
} from './use-loading-state'

export type { 
  ProgressiveLoadingStage,
  ProgressiveLoadingState
} from './use-progressive-loading'

export type { 
  SkeletonDelayConfig,
  SkeletonDelayState
} from './use-skeleton-delay'

export type { 
  TransitionState,
  LoadingTransitionConfig,
  LoadingTransitionState
} from './use-loading-transition'