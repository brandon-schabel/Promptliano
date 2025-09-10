import React, { useMemo } from 'react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent
} from '@promptliano/ui'
import { useProjectScripts, useRunScript } from '@/hooks/api/processes-hooks'
import { Loader2, Play } from 'lucide-react'

type ProcessesScriptsPanelProps = {
  projectId: number
  projectName?: string
  className?: string
}

export function ProcessesScriptsPanel({ projectId, projectName, className }: ProcessesScriptsPanelProps) {
  const { data: scripts = [], isLoading: loadingScripts } = useProjectScripts(projectId)
  const runScriptMutation = useRunScript(projectId)

  const groupedScripts = useMemo(() => {
    const groups: Record<string, { packageName: string; packagePath: string; packageManager: string; workspace: boolean; scripts: { scriptName: string; command: string }[] }> = {}
    for (const s of scripts as any[]) {
      if (!groups[s.packagePath]) {
        groups[s.packagePath] = {
          packageName: s.packageName,
          packagePath: s.packagePath,
          packageManager: s.packageManager,
          workspace: !!s.workspace,
          scripts: []
        }
      }
      groups[s.packagePath].scripts.push({ scriptName: s.scriptName, command: s.command })
    }
    // Sort scripts within each group alphabetically
    Object.values(groups).forEach((g) => g.scripts.sort((a, b) => a.scriptName.localeCompare(b.scriptName)))
    // Order groups: root (workspace=false) first, then by packageName
    return Object.values(groups).sort((a, b) => {
      if (a.workspace !== b.workspace) return a.workspace ? 1 : -1
      return a.packageName.localeCompare(b.packageName)
    })
  }, [scripts])

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle>Quick Scripts</CardTitle>
          <CardDescription>
            Scripts discovered in this project{projectName ? ` (${projectName})` : ''} — root and workspaces
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-3'>
          {loadingScripts ? (
            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
              <Loader2 className='h-4 w-4 animate-spin' /> Scanning package.json scripts...
            </div>
          ) : (scripts as any[]).length === 0 ? (
            <div className='text-sm text-muted-foreground'>No scripts found in package.json files.</div>
          ) : (
            <Accordion type='single' collapsible defaultValue={groupedScripts.find((g) => !g.workspace)?.packagePath}>
              {groupedScripts.map((g, gi) => (
                <AccordionItem key={`${g.packagePath}:${gi}`} value={g.packagePath}>
                  <AccordionTrigger>
                    <div className='flex items-center gap-2 w-full pr-2'>
                      <div className='flex-1 min-w-0'>
                        <div className='text-sm font-medium truncate'>
                          {g.packageName} {g.workspace ? '' : '(root)'}
                        </div>
                        <div className='text-xs text-muted-foreground truncate'>{g.packagePath}</div>
                      </div>
                      <div className='flex items-center gap-2'>
                        <div className='text-xs text-muted-foreground'>PM: {g.packageManager}</div>
                        <div className='text-xs text-muted-foreground whitespace-nowrap'>
                          {g.scripts.length} {g.scripts.length === 1 ? 'script' : 'scripts'}
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className='p-2 grid grid-cols-1 gap-2'>
                      {g.scripts.map((s) => (
                        <div
                          key={`${g.packagePath}:${s.scriptName}`}
                          className='flex items-center justify-between gap-3 rounded border p-2'
                        >
                          <div className='min-w-0'>
                            <div className='text-sm font-medium truncate'>{s.scriptName}</div>
                            <div className='text-xs text-muted-foreground truncate'>{s.command}</div>
                          </div>
                          <Button
                            size='sm'
                            onClick={() =>
                              runScriptMutation.mutate({
                                scriptName: s.scriptName,
                                packageManager: g.packageManager as any,
                                packagePath: g.packagePath
                              })
                            }
                            disabled={runScriptMutation.isPending}
                          >
                            {runScriptMutation.isPending ? (
                              <Loader2 className='h-3.5 w-3.5 mr-1 animate-spin' />
                            ) : (
                              <Play className='h-3.5 w-3.5 mr-1' />
                            )}
                            Run
                          </Button>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  )
}