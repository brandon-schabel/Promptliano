/**
 * Hook for managing intelligence-based model selection
 * Provides intelligent model recommendations based on task type and context
 */

import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { promptlianoClient } from '@/lib/api-client'
import type { IntelligenceLevel } from '@promptliano/services'

export interface UseIntelligenceModelOptions {
  defaultLevel?: IntelligenceLevel
  taskType?: string
  contextSize?: number
}

export interface IntelligenceLevelInfo {
  level: IntelligenceLevel
  name: string
  description: string
  useCases: string[]
  contextWindow: number
  speed: string
  cost: number
  recommended?: boolean
}

const INTELLIGENCE_LEVELS: Record<IntelligenceLevel, IntelligenceLevelInfo> = {
  low: {
    level: 'low',
    name: 'Low Intelligence',
    description: 'Fast responses for simple tasks',
    useCases: ['Summaries', 'Quick searches', 'Basic Q&A'],
    contextWindow: 32000,
    speed: 'Very Fast',
    cost: 0.05
  },
  medium: {
    level: 'medium',
    name: 'Medium Intelligence',
    description: 'Balanced quality for most tasks',
    useCases: ['Code generation', 'Documentation', 'Analysis'],
    contextWindow: 25000,
    speed: 'Fast',
    cost: 0.15
  },
  high: {
    level: 'high',
    name: 'High Intelligence',
    description: 'Maximum quality for complex reasoning',
    useCases: ['File suggestions', 'Architecture', 'Complex refactoring'],
    contextWindow: 200000,
    speed: 'Moderate',
    cost: 1.25
  },
  planning: {
    level: 'planning',
    name: 'Planning Intelligence',
    description: 'Optimized for project planning',
    useCases: ['Task breakdown', 'Project planning', 'Ticket management'],
    contextWindow: 25000,
    speed: 'Fast',
    cost: 0.15
  }
}

export function useIntelligenceModel(options: UseIntelligenceModelOptions = {}) {
  const { defaultLevel = 'medium', taskType, contextSize = 0 } = options

  const [selectedLevel, setSelectedLevel] = useState<IntelligenceLevel>(defaultLevel)
  const [autoSelectEnabled, setAutoSelectEnabled] = useState(true)

  // Fetch model configurations from server
  const { data: modelConfigs, isLoading } = useQuery({
    queryKey: ['model-configs', 'intelligence'],
    queryFn: async () => {
      try {
        const response = await promptlianoClient.modelConfigs.list()
        return response.data.filter((config: any) => config.name?.includes('intelligence'))
      } catch (error) {
        console.error('Failed to fetch model configs:', error)
        return []
      }
    },
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  })

  // Recommend intelligence level based on task characteristics
  const recommendLevel = useCallback((characteristics: {
    taskType?: string
    contextSize?: number
    complexity?: 'simple' | 'moderate' | 'complex'
    requiresPlanning?: boolean
  }): IntelligenceLevel => {
    const { 
      taskType: task, 
      contextSize: size = 0, 
      complexity = 'moderate', 
      requiresPlanning = false 
    } = characteristics

    // Planning tasks always use planning level
    if (requiresPlanning || task?.toLowerCase().includes('planning') || task?.toLowerCase().includes('ticket')) {
      return 'planning'
    }

    // Large context requires high intelligence
    if (size > 50000) {
      return 'high'
    }

    // File suggestions require high intelligence
    if (task?.toLowerCase().includes('file') || task?.toLowerCase().includes('suggest')) {
      return 'high'
    }

    // Simple tasks use low intelligence
    if (complexity === 'simple' || task?.toLowerCase().includes('summar') || size < 5000) {
      return 'low'
    }

    // Complex tasks require high intelligence
    if (complexity === 'complex' || task?.toLowerCase().includes('architect') || task?.toLowerCase().includes('refactor')) {
      return 'high'
    }

    // Default to medium
    return 'medium'
  }, [])

  // Get recommended level based on current context
  const recommendedLevel = useMemo(() => {
    if (!autoSelectEnabled) return null

    return recommendLevel({
      taskType,
      contextSize,
      complexity: contextSize > 100000 ? 'complex' : contextSize > 20000 ? 'moderate' : 'simple'
    })
  }, [taskType, contextSize, autoSelectEnabled, recommendLevel])

  // Auto-select recommended level
  const autoSelectLevel = useCallback(() => {
    if (recommendedLevel) {
      setSelectedLevel(recommendedLevel)
    }
  }, [recommendedLevel])

  // Get level info with recommendation flag
  const getLevelInfo = useCallback((level: IntelligenceLevel): IntelligenceLevelInfo => {
    return {
      ...INTELLIGENCE_LEVELS[level],
      recommended: level === recommendedLevel
    }
  }, [recommendedLevel])

  // Check if task fits within context window
  const validateContextSize = useCallback((level: IntelligenceLevel, size: number): boolean => {
    return size <= INTELLIGENCE_LEVELS[level].contextWindow
  }, [])

  // Estimate cost for task
  const estimateCost = useCallback((level: IntelligenceLevel, estimatedTokens: number): number => {
    const costPerMillion = INTELLIGENCE_LEVELS[level].cost
    return (estimatedTokens / 1000000) * costPerMillion
  }, [])

  // Get appropriate use cases for level
  const getUseCases = useCallback((level: IntelligenceLevel): string[] => {
    return INTELLIGENCE_LEVELS[level].useCases
  }, [])

  // Check if a level is suitable for task
  const isLevelSuitable = useCallback((level: IntelligenceLevel, task?: string): boolean => {
    if (!task) return true

    const taskLower = task.toLowerCase()
    const useCases = INTELLIGENCE_LEVELS[level].useCases.map(uc => uc.toLowerCase())

    return useCases.some(useCase => 
      useCase.includes(taskLower) || taskLower.includes(useCase.split(' ')[0])
    )
  }, [])

  return {
    // State
    selectedLevel,
    recommendedLevel,
    autoSelectEnabled,
    isLoading,
    modelConfigs,

    // Actions
    setSelectedLevel,
    setAutoSelectEnabled,
    autoSelectLevel,
    recommendLevel,

    // Info getters
    getLevelInfo,
    getUseCases,
    isLevelSuitable,

    // Validation
    validateContextSize,
    estimateCost,

    // Constants
    levels: INTELLIGENCE_LEVELS,
    availableLevels: Object.keys(INTELLIGENCE_LEVELS) as IntelligenceLevel[]
  }
}

// Export types
export type { IntelligenceLevel }