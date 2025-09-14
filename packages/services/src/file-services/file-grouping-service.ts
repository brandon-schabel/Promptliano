import type { File, FileGroup, FileRelationship, FileRelationshipType, GroupingStrategy } from '@promptliano/database'
import ErrorFactory, { withErrorContext } from '@promptliano/shared/src/error/error-factory'
import { createFileService, createFileFilter, type FileServiceConfig } from './file-service-factory'

export interface FileRelationshipGraph {
  nodes: Map<string, File>
  edges: FileRelationship[]
}

export interface GroupingOptions {
  maxGroupSize?: number
  minRelationshipStrength?: number
  priorityThreshold?: number
}

export interface FileGroupingServiceDeps {
  config?: FileServiceConfig
}

export function createFileGroupingService(deps: FileGroupingServiceDeps = {}) {
  const service = createFileService('FileGroupingService', deps.config)
  const fileFilter = createFileFilter()

  const DEFAULT_MAX_GROUP_SIZE = 10
  const DEFAULT_MIN_RELATIONSHIP_STRENGTH = 0.3

  function createFileGroup(
    id: string,
    name: string,
    strategy: GroupingStrategy,
    fileIds: string[],
    priority: number,
    projectId: number,
    relationships: FileRelationship[] = [],
    estimatedTokens?: number,
    metadata: { directory?: string; primaryFile?: string; semanticCategory?: string } = {}
  ): FileGroup {
    const now = Date.now()
    return {
      id,
      name,
      strategy,
      fileIds,
      priority,
      projectId,
      relationships,
      estimatedTokens: estimatedTokens || null,
      metadata,
      createdAt: now,
      updatedAt: now
    }
  }

  async function detectFileRelationships(files: File[]): Promise<FileRelationshipGraph> {
    return service.withErrorContext(
      async () => {
        const nodes = new Map<string, File>()
        const edges: FileRelationship[] = []

        // Build nodes map
        files.forEach((file) => nodes.set(file.id, file))

        // Detect import/export relationships
        for (const file of files) {
          if (file.imports && file.imports.length > 0) {
            for (const imp of file.imports) {
              // Find files that match the import source
              const targetFile = files.find(
                (f) => f.path.endsWith(imp.source) || f.path.includes(imp.source.replace(/\.\//g, ''))
              )

              if (targetFile) {
                edges.push({
                  sourceFileId: file.id,
                  targetFileId: targetFile.id,
                  type: 'imports' as FileRelationshipType,
                  strength: 0.9,
                  metadata: { importPath: imp.source }
                })
              }
            }
          }
        }

        // Detect sibling relationships (files in same directory)
        const filesByDir = groupFilesByDirectory(files)
        for (const dirFiles of filesByDir.values()) {
          if (dirFiles.length > 1) {
            for (let i = 0; i < dirFiles.length; i++) {
              for (let j = i + 1; j < dirFiles.length; j++) {
                const file1 = dirFiles[i]
                const file2 = dirFiles[j]
                if (file1 && file2) {
                  edges.push({
                    sourceFileId: file1.id,
                    targetFileId: file2.id,
                    type: 'sibling' as FileRelationshipType,
                    strength: 0.5,
                    metadata: { directory: file1.path.substring(0, file1.path.lastIndexOf('/')) }
                  })
                }
              }
            }
          }
        }

        // Detect semantic relationships based on content similarity
        for (let i = 0; i < files.length; i++) {
          for (let j = i + 1; j < files.length; j++) {
            const file1 = files[i]
            const file2 = files[j]

            if (!file1 || !file2) continue

            // Skip if already have a stronger relationship
            const existingRelation = edges.find(
              (e) =>
                (e.sourceFileId === file1.id && e.targetFileId === file2.id) ||
                (e.sourceFileId === file2.id && e.targetFileId === file1.id)
            )

            if (!existingRelation) {
              const content1 = `${file1.name} ${file1.content?.slice(0, 500) || ''}`
              const content2 = `${file2.name} ${file2.content?.slice(0, 500) || ''}`

              const similarity = calculateTextRelevance(content1, content2)
              if (similarity > 0.3) {
                edges.push({
                  sourceFileId: file1.id,
                  targetFileId: file2.id,
                  type: 'semantic' as FileRelationshipType,
                  strength: similarity,
                  metadata: { similarity }
                })
              }
            }
          }
        }

        return { nodes, edges }
      },
      { action: 'detect-relationships' }
    )
  }

  async function groupFilesByStrategy(
    files: File[],
    strategy: GroupingStrategy,
    projectId: number,
    options: GroupingOptions = {}
  ): Promise<FileGroup[]> {
    return service.withErrorContext(
      async () => {
        const {
          maxGroupSize = DEFAULT_MAX_GROUP_SIZE,
          minRelationshipStrength = DEFAULT_MIN_RELATIONSHIP_STRENGTH,
          priorityThreshold = 3
        } = options

        switch (strategy) {
          case 'imports':
            return await groupByImports(files, maxGroupSize, minRelationshipStrength, projectId)

          case 'directory':
            return groupByDirectory(files, maxGroupSize, projectId)

          case 'semantic':
            return await groupBySemantic(files, maxGroupSize, minRelationshipStrength, projectId)

          case 'mixed':
            return await groupByMixed(files, maxGroupSize, minRelationshipStrength, priorityThreshold, projectId)

          default:
            throw ErrorFactory.invalidParam('strategy', 'imports|directory|semantic|mixed', strategy)
        }
      },
      { action: 'group-by-strategy', id: strategy }
    )
  }

  async function groupByImports(
    files: File[],
    maxGroupSize: number,
    minStrength: number,
    projectId: number
  ): Promise<FileGroup[]> {
    const graph = await detectFileRelationships(files)
    const groups: FileGroup[] = []
    const assigned = new Set<string>()

    // Find strongly connected components via imports
    const importEdges = graph.edges.filter((e) => e.type === 'imports' && e.strength >= minStrength)

    for (const file of files) {
      if (assigned.has(file.id)) continue

      const group = createFileGroup(
        `import-group-${groups.length + 1}`,
        `Import cluster around ${file.name}`,
        'imports',
        [file.id],
        getFileImportance(file).score,
        projectId
      )

      // Find all files connected by imports
      const toProcess = [file.id]
      const processed = new Set<string>()

      while (toProcess.length > 0 && group.fileIds.length < maxGroupSize) {
        const currentId = toProcess.pop()!
        if (processed.has(currentId)) continue
        processed.add(currentId)

        const relatedEdges = importEdges.filter((e) => e.sourceFileId === currentId || e.targetFileId === currentId)

        for (const edge of relatedEdges) {
          const otherId = edge.sourceFileId === currentId ? edge.targetFileId : edge.sourceFileId

          if (!assigned.has(otherId) && group.fileIds.length < maxGroupSize) {
            group.fileIds.push(otherId)
            group.relationships.push(edge)
            assigned.add(otherId)
            toProcess.push(otherId)
          }
        }
      }

      if (group.fileIds.length > 1) {
        assigned.add(file.id)
        groups.push(group)
      }
    }

    // Add ungrouped files as single-file groups
    for (const file of files) {
      if (!assigned.has(file.id)) {
        groups.push(
          createFileGroup(
            `import-single-${file.id}`,
            file.name,
            'imports',
            [file.id],
            getFileImportance(file).score,
            projectId
          )
        )
      }
    }

    return groups
  }

  function groupByDirectory(files: File[], maxGroupSize: number, projectId: number): FileGroup[] {
    const groups: FileGroup[] = []
    const dirGroups = groupFilesByDirectory(files)

    let groupIndex = 0
    for (const [dir, dirFiles] of dirGroups) {
      // Split large directories into smaller groups
      for (let i = 0; i < dirFiles.length; i += maxGroupSize) {
        const groupFiles = dirFiles.slice(i, i + maxGroupSize)
        const avgPriority = groupFiles.reduce((sum, f) => sum + getFileImportance(f).score, 0) / groupFiles.length

        groups.push(
          createFileGroup(
            `dir-group-${++groupIndex}`,
            `${dir || 'Root'} (${groupFiles.length} files)`,
            'directory',
            groupFiles.map((f) => f.id),
            avgPriority,
            projectId,
            [],
            undefined,
            { directory: dir }
          )
        )
      }
    }

    return groups
  }

  async function groupBySemantic(
    files: File[],
    maxGroupSize: number,
    minStrength: number,
    projectId: number
  ): Promise<FileGroup[]> {
    const graph = await detectFileRelationships(files)
    const groups: FileGroup[] = []
    const assigned = new Set<string>()

    // Filter semantic edges
    const semanticEdges = graph.edges.filter((e) => e.type === 'semantic' && e.strength >= minStrength)

    // Sort files by importance to start with high-priority files
    const sortedFiles = [...files].sort((a, b) => getFileImportance(b).score - getFileImportance(a).score)

    for (const file of sortedFiles) {
      if (assigned.has(file.id)) continue

      const group = createFileGroup(
        `semantic-group-${groups.length + 1}`,
        `Semantic cluster: ${fileFilter.getFileCategory(file)}`,
        'semantic',
        [file.id],
        getFileImportance(file).score,
        projectId,
        [],
        undefined,
        { semanticCategory: fileFilter.getFileCategory(file) }
      )

      // Find semantically similar files
      const similarities = semanticEdges
        .filter((e) => e.sourceFileId === file.id || e.targetFileId === file.id)
        .sort((a, b) => b.strength - a.strength)

      for (const edge of similarities) {
        if (group.fileIds.length >= maxGroupSize) break

        const otherId = edge.sourceFileId === file.id ? edge.targetFileId : edge.sourceFileId
        if (!assigned.has(otherId)) {
          group.fileIds.push(otherId)
          group.relationships.push(edge)
          assigned.add(otherId)
        }
      }

      if (group.fileIds.length > 1) {
        assigned.add(file.id)
        groups.push(group)
      }
    }

    // Add remaining files
    for (const file of files) {
      if (!assigned.has(file.id)) {
        groups.push(
          createFileGroup(
            `semantic-single-${file.id}`,
            file.name,
            'semantic',
            [file.id],
            getFileImportance(file).score,
            projectId,
            [],
            undefined,
            { semanticCategory: fileFilter.getFileCategory(file) }
          )
        )
      }
    }

    return groups
  }

  async function groupByMixed(
    files: File[],
    maxGroupSize: number,
    minStrength: number,
    priorityThreshold: number,
    projectId: number
  ): Promise<FileGroup[]> {
    const graph = await detectFileRelationships(files)
    const groups: FileGroup[] = []
    const assigned = new Set<string>()

    // Calculate composite scores for each file
    const fileScores = new Map<string, number>()
    for (const file of files) {
      fileScores.set(file.id, getFileImportance(file).score)
    }

    // Sort files by composite score
    const sortedFiles = [...files].sort((a, b) => (fileScores.get(b.id) || 0) - (fileScores.get(a.id) || 0))

    // Group high-priority files first
    for (const file of sortedFiles) {
      if (assigned.has(file.id)) continue
      if ((fileScores.get(file.id) || 0) < priorityThreshold) break

      const group = createFileGroup(
        `mixed-group-${groups.length + 1}`,
        `Mixed cluster: ${file.name}`,
        'mixed',
        [file.id],
        fileScores.get(file.id) || 0,
        projectId
      )

      // Get all relationships for this file
      const fileEdges = graph.edges
        .filter((e) => (e.sourceFileId === file.id || e.targetFileId === file.id) && e.strength >= minStrength)
        .sort((a, b) => {
          // Prioritize by relationship type: imports > sibling > semantic
          const typeOrder = { imports: 3, exports: 2, sibling: 1, semantic: 0 }
          const aOrder = typeOrder[a.type as keyof typeof typeOrder] || 0
          const bOrder = typeOrder[b.type as keyof typeof typeOrder] || 0
          if (aOrder !== bOrder) return bOrder - aOrder
          return b.strength - a.strength
        })

      // Add related files to group
      for (const edge of fileEdges) {
        if (group.fileIds.length >= maxGroupSize) break

        const otherId = edge.sourceFileId === file.id ? edge.targetFileId : edge.sourceFileId
        if (!assigned.has(otherId)) {
          group.fileIds.push(otherId)
          group.relationships.push(edge)
          assigned.add(otherId)
        }
      }

      assigned.add(file.id)
      groups.push(group)
    }

    // Group remaining files by directory
    const remainingFiles = files.filter((f) => !assigned.has(f.id))
    if (remainingFiles.length > 0) {
      const dirGroups = groupByDirectory(remainingFiles, maxGroupSize, projectId)
      groups.push(
        ...dirGroups.map((g) => ({
          ...g,
          id: g.id.replace('dir-', 'mixed-dir-'),
          strategy: 'mixed' as GroupingStrategy
        }))
      )
    }

    return groups
  }

  function optimizeGroupsForTokenLimit(groups: FileGroup[], files: File[], tokenLimit: number): FileGroup[] {
    const fileMap = new Map(files.map((f) => [f.id, f]))
    const optimizedGroups: FileGroup[] = []

    for (const group of groups) {
      const groupFiles = group.fileIds.map((id) => fileMap.get(id)).filter((f): f is File => f !== undefined)

      // Estimate tokens for group
      const estimatedTokens = estimateGroupTokens(groupFiles)

      if (estimatedTokens <= tokenLimit) {
        // Group is within limit
        group.estimatedTokens = estimatedTokens
        optimizedGroups.push(group)
      } else {
        // Split group into smaller chunks
        const chunks = splitGroupByTokens(group, groupFiles, tokenLimit)
        optimizedGroups.push(...chunks)
      }
    }

    // Try to merge small groups if possible
    return mergeSmallGroups(optimizedGroups, files, tokenLimit)
  }

  // Helper functions
  function groupFilesByDirectory(files: File[]): Map<string, File[]> {
    const groups = new Map<string, File[]>()

    for (const file of files) {
      const dir = file.path.substring(0, file.path.lastIndexOf('/')) || ''
      if (!groups.has(dir)) {
        groups.set(dir, [])
      }
      groups.get(dir)!.push(file)
    }

    return groups
  }

  function calculateTextRelevance(text1: string, text2: string): number {
    // Simple text similarity based on common words
    const words1 = new Set(
      text1
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2)
    )
    const words2 = new Set(
      text2
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2)
    )

    const intersection = new Set([...words1].filter((w) => words2.has(w)))
    const union = new Set([...words1, ...words2])

    return union.size > 0 ? intersection.size / union.size : 0
  }

  function getFileImportance(file: File): { score: number; reasons: string[] } {
    let score = 1
    const reasons: string[] = []

    // Recent files are more important
    const daysSinceUpdate = (Date.now() - file.updatedAt) / (24 * 60 * 60 * 1000)
    if (daysSinceUpdate < 7) {
      score += 2
      reasons.push('recently updated')
    }

    // Files with imports/exports are likely more important
    if (file.imports && file.imports.length > 0) {
      score += 1
      reasons.push('has imports')
    }
    if (file.exports && file.exports.length > 0) {
      score += 1
      reasons.push('has exports')
    }

    // Configuration files are important
    const configExtensions = ['json', 'yaml', 'yml', 'toml', 'env', 'config.js', 'config.ts']
    const ext = file.path.split('.').pop()?.toLowerCase()
    if (ext && configExtensions.includes(ext)) {
      score += 1
      reasons.push('configuration file')
    }

    // Root level files are often more important
    const pathDepth = file.path.split('/').length - 1
    if (pathDepth <= 2) {
      score += 1
      reasons.push('root level file')
    }

    return { score, reasons }
  }

  function estimateGroupTokens(files: File[]): number {
    // Rough estimation: 1 token ≈ 4 characters
    let totalChars = 0

    for (const file of files) {
      // Include file metadata
      totalChars += file.path.length + file.name.length + 50

      // Summary removed

      // Include partial content for context
      if (file.content) {
        totalChars += Math.min(file.content.length, 1000)
      }

      // Include imports/exports
      if (file.imports) {
        totalChars += file.imports.length * 50
      }
      if (file.exports) {
        totalChars += file.exports.length * 30
      }
    }

    return Math.ceil(totalChars / 4)
  }

  function splitGroupByTokens(group: FileGroup, files: File[], tokenLimit: number): FileGroup[] {
    const chunks: FileGroup[] = []
    let currentChunk: File[] = []
    let currentTokens = 0
    let chunkIndex = 0

    // Sort files by importance within group
    const sortedFiles = files.sort((a, b) => getFileImportance(b).score - getFileImportance(a).score)

    for (const file of sortedFiles) {
      const fileTokens = estimateGroupTokens([file])

      if (currentTokens + fileTokens > tokenLimit && currentChunk.length > 0) {
        // Create new chunk
        chunks.push({
          ...group,
          id: `${group.id}-chunk-${++chunkIndex}`,
          name: `${group.name} (part ${chunkIndex})`,
          fileIds: currentChunk.map((f) => f.id),
          estimatedTokens: currentTokens
        })

        currentChunk = []
        currentTokens = 0
      }

      currentChunk.push(file)
      currentTokens += fileTokens
    }

    // Add final chunk
    if (currentChunk.length > 0) {
      chunks.push({
        ...group,
        id: `${group.id}-chunk-${++chunkIndex}`,
        name: `${group.name} (part ${chunkIndex})`,
        fileIds: currentChunk.map((f) => f.id),
        estimatedTokens: currentTokens
      })
    }

    return chunks
  }

  function mergeSmallGroups(groups: FileGroup[], files: File[], tokenLimit: number): FileGroup[] {
    const fileMap = new Map(files.map((f) => [f.id, f]))
    const merged: FileGroup[] = []
    let i = 0

    while (i < groups.length) {
      const currentGroup = groups[i]
      if (!currentGroup) {
        i++
        continue
      }

      if (!currentGroup.estimatedTokens || currentGroup.estimatedTokens >= tokenLimit * 0.7) {
        // Group is already large enough
        merged.push(currentGroup)
        i++
        continue
      }

      // Try to merge with next compatible group
      let j = i + 1
      let mergedGroup = { ...currentGroup }

      while (j < groups.length && (mergedGroup.estimatedTokens || 0) < tokenLimit * 0.7) {
        const candidateGroup = groups[j]
        if (!candidateGroup) {
          j++
          continue
        }

        // Check if groups are compatible
        if (
          candidateGroup.strategy === mergedGroup.strategy ||
          candidateGroup.strategy === 'mixed' ||
          mergedGroup.strategy === 'mixed'
        ) {
          const combinedTokens = (mergedGroup.estimatedTokens || 0) + (candidateGroup.estimatedTokens || 0)

          if (combinedTokens <= tokenLimit) {
            // Merge groups
            const now = Date.now()
            mergedGroup = {
              id: `merged-${merged.length + 1}`,
              name: `Merged: ${mergedGroup.name} + ${candidateGroup.name}`,
              strategy: 'mixed',
              fileIds: [...mergedGroup.fileIds, ...candidateGroup.fileIds],
              relationships: [...mergedGroup.relationships, ...candidateGroup.relationships],
              estimatedTokens: combinedTokens,
              priority: Math.max(mergedGroup.priority, candidateGroup.priority),
              projectId: mergedGroup.projectId,
              metadata: {},
              createdAt: now,
              updatedAt: now
            }

            // Remove the merged group from future consideration
            groups.splice(j, 1)
          } else {
            j++
          }
        } else {
          j++
        }
      }

      merged.push(mergedGroup)
      i++
    }

    return merged
  }

  return {
    // Core functionality
    detectFileRelationships,
    groupFilesByStrategy,
    optimizeGroupsForTokenLimit,

    // Service metadata
    serviceName: service.serviceName,
    config: service.config,

    // Cleanup
    destroy: service.destroy
  }
}

// Export types
export type FileGroupingService = ReturnType<typeof createFileGroupingService>

// Export singleton for backward compatibility
export const fileGroupingService = createFileGroupingService()

// Export individual functions for tree-shaking
export const { detectFileRelationships, groupFilesByStrategy, optimizeGroupsForTokenLimit } = fileGroupingService
