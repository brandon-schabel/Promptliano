import type { GitFileStatus } from '@promptliano/schemas'

export const getGitStatusColor = (gitFileStatus?: GitFileStatus) => {
  if (!gitFileStatus || gitFileStatus.status === 'unchanged' || gitFileStatus.status === 'ignored') {
    return undefined
  }

  const isStaged = gitFileStatus.staged

  if (gitFileStatus.status === 'added' || gitFileStatus.status === 'untracked') {
    return isStaged ? 'text-green-500' : 'text-green-700'
  }

  if (gitFileStatus.status === 'modified') {
    return isStaged ? 'text-yellow-500' : 'text-yellow-700'
  }

  if (gitFileStatus.status === 'deleted') {
    return isStaged ? 'text-red-500' : 'text-red-700'
  }

  if (gitFileStatus.status === 'renamed' || gitFileStatus.status === 'copied') {
    return isStaged ? 'text-blue-500' : 'text-blue-700'
  }

  return 'text-gray-500'
}
