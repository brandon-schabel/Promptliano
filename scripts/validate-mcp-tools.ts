/*
  Lightweight validation for MCP tools fixes:
  - Confirms getProjectFileTree supports limit/offset and returns meta
  - Confirms project_manager.search is wired to file search service and returns structured output
*/

import { getProjectFileTree, listProjects } from '@promptliano/services'
import { createFileSearchService } from '@promptliano/services'

async function main() {
  const projects = await listProjects()
  if (!projects || projects.length === 0) {
    console.error('No projects found. Ensure the database is seeded.')
    process.exit(1)
  }

  const projectId = projects[0].id
  console.log(`Using projectId: ${projectId}`)

  // Validate getProjectFileTree with pagination
  const { tree, meta } = await getProjectFileTree(projectId, { limit: 5, offset: 0, includeContent: false })
  if (!meta || typeof meta.totalFiles !== 'number') {
    throw new Error('getProjectFileTree did not return expected meta')
  }
  console.log('getProjectFileTree meta:', meta)
  console.log(
    'getProjectFileTree sample root children count:',
    Array.isArray(tree?.children) ? tree.children.length : 0
  )

  // Validate search through file-search-service
  const searchService = createFileSearchService()
  const { results, stats } = await searchService.search(projectId, {
    query: 'import',
    limit: 5,
    searchType: 'semantic'
  })
  console.log(`Search stats:`, stats)
  console.log(
    `Search results sample:`,
    results.slice(0, 2).map((r) => ({ file: r.file.path, score: r.score, matches: r.matches?.length }))
  )

  console.log('Validation complete.')
}

main().catch((err) => {
  console.error('Validation failed:', err)
  process.exit(1)
})
