import { useMemo } from 'react'
import { useActiveProjectTab } from './use-kv-local-storage'
import { useGetProjectFilesWithoutContent } from '@/hooks/api-hooks'
import { buildFileTree } from '@promptliano/shared'

export const useProjectFileTree = () => {
  const [activeProjectTabState] = useActiveProjectTab()
  const projectId = activeProjectTabState?.selectedProjectId
  const { data: projectFiles } = useGetProjectFilesWithoutContent(projectId ?? -1)
  const fileTree = useMemo(() => buildFileTree((projectFiles as Array<{ path: string }>) ?? []), [projectFiles])
  return fileTree
}
