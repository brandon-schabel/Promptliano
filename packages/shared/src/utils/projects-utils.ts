import { estimateTokenCount } from './file-tree-utils/file-node-tree-utils'
import type { FileNode } from './file-tree-utils/file-node-tree-utils'
import type { ProjectFile, ProjectFileMap } from '@promptliano/schemas'
import type { Prompt } from '@promptliano/database'

export function buildPromptContent({
  fileMap,
  promptData,
  selectedFiles,
  selectedPrompts,
  userPrompt
}: {
  promptData: Prompt[]
  selectedPrompts: number[]
  userPrompt: string
  selectedFiles: number[]
  fileMap: ProjectFileMap
}): string {
  let contentToCopy = ''
  let promptCount = 1
  for (const prompt of promptData ?? []) {
    if (selectedPrompts.includes(prompt.id)) {
      // Using a more descriptive tag for clarity
      contentToCopy += `<system_prompt index="${promptCount}" name="${prompt.title}">\n<![CDATA[\n${prompt.content}\n]]>\n</system_prompt>\n\n`
      promptCount++
    }
  }

  const filesWithContent = selectedFiles
    .map((fileId) => fileMap.get(fileId))
    .filter((file): file is ProjectFile => !!file?.content)

  if (filesWithContent.length > 0) {
    contentToCopy += `<file_context>\n`
    for (const file of filesWithContent) {
      contentToCopy += `<file>\n  <path>${file.path}</path>\n  <content><![CDATA[\n${file.content}\n]]></content>\n</file>\n\n`
    }
    contentToCopy += `</file_context>\n`
  }

  const trimmedUserPrompt = userPrompt.trim()
  if (trimmedUserPrompt) {
    contentToCopy += `<user_instructions>\n<![CDATA[\n${trimmedUserPrompt}\n]]>\n</user_instructions>\n\n`
  }

  return contentToCopy.trimEnd() // Remove trailing newline
}

export function calculateTotalTokens(
  promptData: Prompt[] | null | undefined,
  selectedPrompts: number[],
  userPrompt: string,
  selectedFiles: number[],
  fileMap: ProjectFileMap
): number {
  let total = 0
  for (const prompt of promptData ?? []) {
    if (selectedPrompts.includes(prompt.id)) {
      total += estimateTokenCount(prompt.content)
    }
  }

  if (userPrompt.trim()) {
    total += estimateTokenCount(userPrompt)
  }

  for (const fileId of selectedFiles) {
    const file = fileMap.get(fileId)
    if (file?.content) {
      total += estimateTokenCount(file.content)
    }
  }

  return total
}

export const buildFileTree = <T extends Pick<ProjectFile, 'path'>>(files: T[]): Record<string, any> => {
  const root: Record<string, any> = {}
  for (const f of files) {
    const parts = f.path.split('/').filter(Boolean) // Remove empty strings
    let current = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (!part) continue // Skip undefined or empty parts
      if (!current[part]) {
        current[part] = {}
      }
      if (i === parts.length - 1) {
        current[part]._folder = false
        current[part].file = f
      } else {
        current[part]._folder = true
        if (!current[part].children) {
          current[part].children = {}
        }
        current = current[part].children
      }
    }
  }
  return root
}

export function buildNodeContent(node: FileNode, isFolder: boolean): string {
  let contentToCopy = ''

  if (isFolder) {
    contentToCopy += `<folder_context path="${node.file?.path ?? 'unknown'}">\n` // Add folder path if available
    const processNode = (currentNode: FileNode) => {
      if (!currentNode._folder && currentNode.file?.content) {
        contentToCopy += `  <file>\n    <path>${currentNode.file.path}</path>\n    <content><![CDATA[\n${currentNode.file.content}\n]]></content>\n  </file>\n`
      }
      if (currentNode.children) {
        Object.values(currentNode.children).forEach(processNode)
      }
    }
    processNode(node)
    contentToCopy += `</folder_context>\n`
  } else if (node.file?.content) {
    // Single file context uses file_context tag for consistency
    contentToCopy += `<file_context>\n`
    contentToCopy += `  <file>\n    <path>${node.file.path}</path>\n    <content><![CDATA[\n${node.file.content}\n]]></content>\n  </file>\n`
    contentToCopy += `</file_context>\n`
  }

  return contentToCopy.trimEnd() // Remove trailing newline
}

export const buildProjectFileMap = (files: ProjectFile[]): ProjectFileMap => {
  return new Map(files.map((file) => [file.id, file]))
}

export const buildProjectFileMapWithoutContent = <T extends Pick<ProjectFile, 'id'>>(files: T[]): Map<number, T> => {
  return new Map(files.map((file) => [file.id, file]))
}
