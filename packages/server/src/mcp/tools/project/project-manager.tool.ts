import { z } from '@hono/zod-openapi'
import * as path from 'path'
import { promises as fs } from 'fs'
import type { MCPToolDefinition, MCPToolResponse } from '../../tools-registry'
import {
  createTrackedHandler,
  validateRequiredParam,
  validateDataField,
  createMCPError,
  MCPError,
  MCPErrorCode,
  formatMCPErrorResponse,
  ProjectManagerAction,
  ProjectManagerSchema
} from '../shared'
import {
  listProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getProjectFiles,
  updateFileContent,
  insertFileAtLine,
  replaceFileLines,
  applyFilePatch,
  suggestFilesForProject,
  suggestFiles,
  syncProject,
  getProjectFileTree,
  getProjectOverview
} from '@promptliano/services'
import { createFileSearchService } from '@promptliano/services'
import type { CreateProjectBody, UpdateProjectBody } from '@promptliano/services'
// Removed summary options schema usage
import { ApiError } from '@promptliano/shared'

export const projectManagerTool: MCPToolDefinition = {
  name: 'project_manager',
  description:
    'Manage projects, files, and project-related operations. Actions: list, get, create, update, delete (requires confirmDelete:true), delete_file (delete single file), browse_files, get_file_content, update_file_content (supports modes: replace, insert, replace-lines, patch), search, create_file, get_file_content_partial, get_file_tree (paginated file tree; options: maxDepth, includeHidden, fileTypes, maxFilesPerDir, limit, offset, excludePatterns, includeContent=false), overview (get essential project context - recommended first tool). File editing modes: (1) replace: full file replacement (default), (2) insert: insert content at lineNumber with position (before/after), line numbers are 1-indexed with valid range based on file length, (3) replace-lines: replace from startLine to endLine, (4) patch: apply unified diff patch (requires valid unified diff format with --- / +++ headers and @@ hunk markers)',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The action to perform',
        enum: Object.values(ProjectManagerAction)
      },
      projectId: {
        type: 'number',
        description:
          'The project ID (required for all actions except "list" and "create"). Tip: Use project_manager(list) to get a valid ID.'
      },
      data: {
        type: 'object',
        description:
          'Action-specific data. For get_file_content: { path: "src/index.ts" }. For browse_files: { path: "src/" }. For create: { name: "My Project", path: "/path/to/project" }. For delete_file: { path: "src/file.ts" }. For update_file_content: { path: "src/file.ts", content: "new content", mode?: "replace" (default) | "insert" | "replace-lines" | "patch", lineNumber?: number (insert mode), position?: "before" | "after" (insert mode), startLine?: number (replace-lines mode), endLine?: number (replace-lines mode) }. For overview: no data required',
        additionalProperties: true
      }
    },
    required: ['action']
  },
  handler: createTrackedHandler(
    'project_manager',
    async (args: z.infer<typeof ProjectManagerSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, projectId, data } = args

        switch (action) {
          case ProjectManagerAction.LIST: {
            const projects = await listProjects()
            const projectList = projects.map((p) => `${p.id}: ${p.name} (${p.path})`).join('\n')
            return {
              content: [{ type: 'text', text: projectList || 'No projects found' }]
            }
          }

          case ProjectManagerAction.GET: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '<PROJECT_ID>')
            const project = await getProjectById(validProjectId)
            const details = `Project: ${project.name}\nPath: ${project.path}\nDescription: ${project.description}\nCreated: ${new Date(project.createdAt).toLocaleString()}\nUpdated: ${new Date(project.updatedAt).toLocaleString()}`
            return {
              content: [{ type: 'text', text: details }]
            }
          }

          case ProjectManagerAction.CREATE: {
            const createData = data as CreateProjectBody
            const name = validateDataField<string>(createData, 'name', 'string', '"My Project"')
            const path = validateDataField<string>(createData, 'path', 'string', '"/Users/me/projects/myproject"')
            const project = await createProject(createData)
            return {
              content: [{ type: 'text', text: `Project created successfully: ${project.name} (ID: ${project.id})` }]
            }
          }

          case ProjectManagerAction.UPDATE: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number')
            const updateData = data as UpdateProjectBody
            const project = await updateProject(validProjectId, updateData)
            return {
              content: [
                { type: 'text', text: `Project updated successfully: ${project?.name} (ID: ${validProjectId})` }
              ]
            }
          }

          case ProjectManagerAction.DELETE: {
            // WARNING: This action deletes the ENTIRE PROJECT, not just a file!
            // Use DELETE_FILE to delete individual files
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number')

            // Add extra validation to prevent accidental deletion
            if (!data || !data.confirmDelete) {
              throw createMCPError(MCPErrorCode.VALIDATION_FAILED, 'Project deletion requires explicit confirmation', {
                parameter: 'data.confirmDelete',
                validationErrors: {
                  confirmDelete: 'Must be set to true to confirm project deletion'
                },
                relatedResources: [`project:${validProjectId}`]
              })
            }

            if (!deleteProject)
              throw createMCPError(MCPErrorCode.OPERATION_FAILED, 'Delete project service unavailable')
            const success = await deleteProject(validProjectId)
            return {
              content: [
                {
                  type: 'text',
                  text: success
                    ? `⚠️ ENTIRE PROJECT ${validProjectId} has been permanently deleted`
                    : `Failed to delete project ${validProjectId}`
                }
              ]
            }
          }

          // Project summary actions removed

          case ProjectManagerAction.BROWSE_FILES: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number')
            const project = await getProjectById(validProjectId)
            const files = await getProjectFiles(validProjectId)
            if (!files) {
              throw createMCPError(MCPErrorCode.SERVICE_ERROR, 'Failed to retrieve project files', {
                projectId: validProjectId
              })
            }

            const browsePath = data?.path as string | undefined
            let result = `Project: ${project.name}\n`
            result += `Path: ${project.path}\n`
            result += `Total files: ${files.length}\n\n`

            if (browsePath) {
              const filteredFiles = files
                .filter((file) => file.path.startsWith(browsePath))
                .sort((a, b) => a.path.localeCompare(b.path))

              result += `Files under ${browsePath}:\n`
              for (const file of filteredFiles) {
                const relativePath = file.path.substring(browsePath.length).replace(/^\//, '')
                result += `  ${relativePath}\n`
              }
            } else {
              const dirs = new Set<string>()
              const rootFiles: string[] = []

              files.forEach((file) => {
                const parts = file.path.split('/')
                if (parts.length > 1 && parts[0]) {
                  dirs.add(parts[0])
                } else {
                  rootFiles.push(file.path)
                }
              })

              result += 'Directories:\n'
              Array.from(dirs)
                .sort()
                .forEach((dir) => {
                  result += `  ${dir}/\n`
                })

              if (rootFiles.length > 0) {
                result += '\nRoot files:\n'
                rootFiles.sort().forEach((file) => {
                  result += `  ${file}\n`
                })
              }
            }

            return {
              content: [{ type: 'text', text: result }]
            }
          }

          case ProjectManagerAction.GET_FILE_CONTENT: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '<PROJECT_ID>')
            const filePath = validateDataField<string>(data, 'path', 'string', '"src/index.ts" or "README.md"')

            const project = await getProjectById(validProjectId)
            const files = await getProjectFiles(validProjectId)
            if (!files) {
              throw createMCPError(MCPErrorCode.SERVICE_ERROR, 'Failed to retrieve project files', {
                projectId: validProjectId
              })
            }

            const file = files.find((f) => f.path === filePath)
            if (!file) {
              // Provide helpful error with available files hint
              const availablePaths = files.slice(0, 5).map((f) => f.path)
              throw createMCPError(
                MCPErrorCode.FILE_NOT_FOUND,
                `File not found: ${filePath}. Available files: ${availablePaths.join(', ')} (${files.length} total files). Use browse_files action to explore available files`,
                {
                  requestedPath: filePath,
                  projectId: validProjectId,
                  tool: 'project_manager',
                  value: filePath
                }
              )
            }

            // Check if it's an image file
            const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']
            const ext = path.extname(filePath).toLowerCase()

            if (imageExtensions.includes(ext)) {
              const fullPath = path.join(project.path, filePath)
              try {
                const fileData = await fs.readFile(fullPath)
                const base64 = fileData.toString('base64')
                return {
                  content: [
                    {
                      type: 'image',
                      data: base64,
                      mimeType: `image/${ext.substring(1)}`
                    } as any
                  ]
                }
              } catch (error) {
                throw new Error(`Failed to read image file: ${error instanceof Error ? error.message : String(error)}`)
              }
            }

            return {
              content: [{ type: 'text', text: file.content || '' }]
            }
          }

          case ProjectManagerAction.UPDATE_FILE_CONTENT: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '<PROJECT_ID>')
            const filePath = validateDataField<string>(data, 'path', 'string', '"src/index.ts"')
            const content = validateDataField<string>(data, 'content', 'string', '"// Updated content"')

            // Get edit mode (default to 'replace' for backward compatibility)
            const mode = (data?.mode as string) || 'replace'
            const validModes = ['replace', 'insert', 'replace-lines', 'patch']

            if (!validModes.includes(mode)) {
              throw createMCPError(
                MCPErrorCode.VALIDATION_FAILED,
                `Invalid edit mode: ${mode}. Valid modes: ${validModes.join(', ')}`,
                {
                  parameter: 'data.mode',
                  value: mode,
                  validValues: validModes
                }
              )
            }

            const files = await getProjectFiles(validProjectId)
            if (!files) {
              throw createMCPError(MCPErrorCode.SERVICE_ERROR, 'Failed to retrieve project files', {
                projectId: validProjectId
              })
            }

            const file = files.find((f) => f.path === filePath)
            if (!file) {
              const availablePaths = files.slice(0, 5).map((f) => f.path)
              throw createMCPError(
                MCPErrorCode.FILE_NOT_FOUND,
                `File not found: ${filePath}. Available files: ${availablePaths.join(', ')} (${files.length} total files)`,
                {
                  requestedPath: filePath,
                  projectId: validProjectId,
                  tool: 'project_manager',
                  value: filePath
                }
              )
            }

            // Execute edit based on mode
            try {
              switch (mode) {
                case 'replace': {
                  // Full file replacement (backward compatible)
                  await updateFileContent(validProjectId, file.id, content)
                  return {
                    content: [{ type: 'text', text: `File ${filePath} updated successfully (full replacement)` }]
                  }
                }

                case 'insert': {
                  // Insert at specific line
                  const lineNumber = data?.lineNumber as number | undefined
                  if (!lineNumber || lineNumber < 1) {
                    throw createMCPError(
                      MCPErrorCode.VALIDATION_FAILED,
                      'Insert mode requires valid lineNumber >= 1',
                      {
                        parameter: 'data.lineNumber',
                        value: lineNumber,
                        example: '{ mode: "insert", lineNumber: 10, position: "after", content: "..." }'
                      }
                    )
                  }

                  const position = (data?.position as 'before' | 'after') || 'after'
                  if (position !== 'before' && position !== 'after') {
                    throw createMCPError(
                      MCPErrorCode.VALIDATION_FAILED,
                      'Insert position must be "before" or "after"',
                      {
                        parameter: 'data.position',
                        value: position,
                        validValues: ['before', 'after']
                      }
                    )
                  }

                  await insertFileAtLine(validProjectId, file.id, lineNumber, content, position)
                  return {
                    content: [
                      {
                        type: 'text',
                        text: `File ${filePath} updated successfully (inserted ${position} line ${lineNumber})`
                      }
                    ]
                  }
                }

                case 'replace-lines': {
                  // Replace line range
                  const startLine = data?.startLine as number | undefined
                  const endLine = data?.endLine as number | undefined

                  if (!startLine || startLine < 1) {
                    throw createMCPError(
                      MCPErrorCode.VALIDATION_FAILED,
                      'Replace-lines mode requires valid startLine >= 1',
                      {
                        parameter: 'data.startLine',
                        value: startLine,
                        example: '{ mode: "replace-lines", startLine: 5, endLine: 10, content: "..." }'
                      }
                    )
                  }

                  if (!endLine || endLine < 1) {
                    throw createMCPError(
                      MCPErrorCode.VALIDATION_FAILED,
                      'Replace-lines mode requires valid endLine >= 1',
                      {
                        parameter: 'data.endLine',
                        value: endLine,
                        example: '{ mode: "replace-lines", startLine: 5, endLine: 10, content: "..." }'
                      }
                    )
                  }

                  if (startLine > endLine) {
                    throw createMCPError(
                      MCPErrorCode.VALIDATION_FAILED,
                      `Start line ${startLine} must be <= end line ${endLine}`,
                      {
                        parameter: 'data.startLine',
                        value: startLine,
                        endLine
                      }
                    )
                  }

                  await replaceFileLines(validProjectId, file.id, startLine, endLine, content)
                  return {
                    content: [
                      {
                        type: 'text',
                        text: `File ${filePath} updated successfully (replaced lines ${startLine}-${endLine})`
                      }
                    ]
                  }
                }

                case 'patch': {
                  // Apply unified diff patch
                  await applyFilePatch(validProjectId, file.id, content)
                  return {
                    content: [{ type: 'text', text: `File ${filePath} updated successfully (patch applied)` }]
                  }
                }

                default:
                  throw createMCPError(
                    MCPErrorCode.OPERATION_FAILED,
                    `Unhandled edit mode: ${mode}`,
                    { mode }
                  )
              }
            } catch (error) {
              // If it's already an MCP error, re-throw it
              if (error instanceof MCPError) {
                throw error
              }

              // Convert service errors to MCP errors
              const errorMessage = error instanceof Error ? error.message : String(error)
              throw createMCPError(
                MCPErrorCode.OPERATION_FAILED,
                `Failed to update file: ${errorMessage}`,
                {
                  filePath,
                  mode,
                  originalError: errorMessage
                }
              )
            }
          }

          case ProjectManagerAction.SEARCH: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number')
            const query = validateDataField<string>(data, 'query', 'string', '"function handleSubmit"')
            const fileTypes = (data?.fileTypes as string[] | undefined) || undefined
            const limit = (data?.limit as number) || (data?.maxResults as number) || 20
            const offset = (data?.offset as number) || 0
            const includeContext = (data?.includeContext as boolean) || false
            const contextLines = (data?.contextLines as number) || 3
            const caseSensitive = (data?.caseSensitive as boolean) || false
            const searchType = (data?.searchType as 'ast' | 'exact' | 'fuzzy' | 'semantic' | 'regex') || 'ast'
            const scoringMethod = (data?.scoringMethod as 'relevance' | 'recency' | 'frequency') || 'relevance'
            const output = (data?.output as 'text' | 'json') || 'text'

            const searchService = createFileSearchService()
            const { results: rawResults, stats } = await searchService.search(validProjectId, {
              query,
              searchType,
              fileTypes,
              limit,
              offset,
              includeContext,
              contextLines,
              scoringMethod,
              caseSensitive
            })

            const results = rawResults.map((r) => ({
              file: r.file,
              score: r.score,
              matches: (r.matches || []).map((m: any) => ({
                lineNumber: m.line ?? m.lineNumber ?? 0,
                line: (m.text ?? m.line ?? '').toString()
              }))
            }))

            if (!results || results.length === 0) {
              return {
                content: [{ type: 'text', text: 'No search results found' }]
              }
            }

            if (output === 'json') {
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(
                      {
                        query,
                        stats,
                        results: rawResults
                      },
                      null,
                      2
                    )
                  }
                ]
              }
            }

            let resultText = `Search results for "${query}" (showing ${results.length} / ${stats.totalResults}):\n\n`
            results.forEach((result, index) => {
              resultText += `${index + 1}. ${result.file.path} (score: ${result.score.toFixed(2)})\n`
              result.matches.forEach((match: { lineNumber: number; line: string }) => {
                resultText += `   Line ${match.lineNumber}: ${match.line.trim()}\n`
              })
              resultText += '\n'
            })

            return {
              content: [{ type: 'text', text: resultText }]
            }
          }

          case ProjectManagerAction.CREATE_FILE: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '<PROJECT_ID>')
            const filePath = validateDataField<string>(data, 'path', 'string', '"src/new-file.ts"')
            const content = (data?.content as string) || ''

            // First get project and sync to ensure we have latest files
            const project = await getProjectById(validProjectId)
            await syncProject(project)
            const fullPath = path.join(project.path, filePath)

            // Create directory if it doesn't exist
            const dir = path.dirname(fullPath)
            await fs.mkdir(dir, { recursive: true })

            // Write the file
            await fs.writeFile(fullPath, content, 'utf-8')

            // Sync again to pick up the new file
            await syncProject(project)

            return {
              content: [{ type: 'text', text: `File created: ${filePath}` }]
            }
          }

          case ProjectManagerAction.GET_FILE_CONTENT_PARTIAL: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '<PROJECT_ID>')
            const filePath = validateDataField<string>(data, 'path', 'string', '"src/index.ts"')
            const startLine = data?.startLine as number | undefined
            const endLine = data?.endLine as number | undefined

            const project = await getProjectById(validProjectId)
            const files = await getProjectFiles(validProjectId)
            if (!files) {
              throw createMCPError(MCPErrorCode.SERVICE_ERROR, 'Failed to retrieve project files', {
                projectId: validProjectId
              })
            }

            const file = files.find((f) => f.path === filePath)
            if (!file) {
              throw createMCPError(MCPErrorCode.FILE_NOT_FOUND, `File not found: ${filePath}`, {
                requestedPath: filePath,
                projectId: validProjectId
              })
            }

            const content = file.content || ''
            const lines = content.split('\n')

            // If no line numbers specified, return full content
            if (!startLine && !endLine) {
              return {
                content: [{ type: 'text', text: content }]
              }
            }

            // Extract partial content
            const start = Math.max(0, (startLine || 1) - 1)
            const end = Math.min(lines.length, endLine || lines.length)
            const partialLines = lines.slice(start, end)

            // Add line numbers
            const numberedContent = partialLines.map((line, index) => `${start + index + 1}: ${line}`).join('\n')

            return {
              content: [{ type: 'text', text: numberedContent }]
            }
          }

          case ProjectManagerAction.DELETE_FILE: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '<PROJECT_ID>')
            const filePath = validateDataField<string>(data, 'path', 'string', '"src/file-to-delete.ts"')

            const project = await getProjectById(validProjectId)
            const fullPath = path.join(project.path, filePath)

            try {
              await fs.unlink(fullPath)
              // Sync to update the file list
              await syncProject(project)
              return {
                content: [{ type: 'text', text: `File deleted: ${filePath}` }]
              }
            } catch (error) {
              throw createMCPError(MCPErrorCode.FILE_NOT_FOUND, `Failed to delete file: ${filePath}`, {
                error: error instanceof Error ? error.message : String(error),
                projectId: validProjectId
              })
            }
          }

          case ProjectManagerAction.GET_FILE_TREE: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '<PROJECT_ID>')
            const maxDepth = (data?.maxDepth as number) || 10
            const includeHidden = (data?.includeHidden as boolean) || false
            const fileTypes = data?.fileTypes as string[] | undefined
            const maxFilesPerDir = (data?.maxFilesPerDir as number) || 500
            const limit = (data?.limit as number) || undefined
            const offset = (data?.offset as number) || 0
            const excludePatterns = (data?.excludePatterns as string[] | undefined) || undefined
            const includeContent = (data?.includeContent as boolean) || false
            const output = (data?.output as 'text' | 'json') || 'json'

            const { tree, meta } = await getProjectFileTree(validProjectId, {
              maxDepth,
              includeHidden,
              fileTypes,
              maxFilesPerDir,
              limit,
              offset,
              excludePatterns,
              includeContent
            })

            if (output === 'text') {
              const header = `File Tree (files ${meta.offset}-${meta.offset + (meta.returnedFiles || 0)} of ${meta.totalFiles})\n`
              return {
                content: [{ type: 'text', text: header + JSON.stringify(tree, null, 2) }]
              }
            }

            return {
              content: [{ type: 'text', text: JSON.stringify({ tree, meta }, null, 2) }]
            }
          }

          case ProjectManagerAction.OVERVIEW: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '<PROJECT_ID>')
            const context = await getProjectOverview(validProjectId)
            return {
              content: [{ type: 'text', text: context }]
            }
          }

          default:
            throw createMCPError(MCPErrorCode.UNKNOWN_ACTION, `Unknown action: ${action}`, {
              action,
              validActions: Object.values(ProjectManagerAction)
            })
        }
      } catch (error) {
        // Convert API errors to MCP errors
        if (error instanceof ApiError) {
          throw createMCPError(
            error.code === 'NOT_FOUND' ? MCPErrorCode.FILE_NOT_FOUND : MCPErrorCode.SERVICE_ERROR,
            error.message,
            {
              statusCode: error.status,
              originalError: error.message
            }
          )
        }

        // Convert to MCPError if not already
        const mcpError =
          error instanceof MCPError
            ? error
            : MCPError.fromError(error, {
                tool: 'project_manager',
                action: args.action,
                projectId: args.projectId
              })

        // Return formatted error response with recovery suggestions
        return await formatMCPErrorResponse(mcpError)
      }
    }
  )
}
