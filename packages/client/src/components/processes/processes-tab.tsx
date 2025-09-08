import { useMemo, useState } from 'react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent
} from '@promptliano/ui'
import { useListProcesses, useStartProcess, useStopProcess, useProjectScripts, useRunScript } from '@/hooks/api/processes-hooks'
import { Loader2, Play, Square, Terminal } from 'lucide-react'

type ProcessesTabProps = {
  projectId: number
  projectName?: string
}

export function ProcessesTab({ projectId, projectName }: ProcessesTabProps) {
  const { data: processes = [], isLoading, refetch } = useListProcesses(projectId)
  const { data: scripts = [], isLoading: loadingScripts } = useProjectScripts(projectId)
  const [command, setCommand] = useState('')
  const [args, setArgs] = useState('')
  const [name, setName] = useState('')
  const startMutation = useStartProcess(projectId)
  const stopMutation = useStopProcess(projectId)
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

  const start = async () => {
    if (!command.trim()) return
    const parsedArgs = args.trim()
      ? args.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map((s) => s.replace(/^['"]|['"]$/g, ''))
      : []
    await startMutation.mutateAsync({ command: command.trim(), args: parsedArgs || [], name: name.trim() || undefined })
    setName('')
    setArgs('')
    setCommand('')
    refetch()
  }

  return (
    <div className='p-4 md:p-6 space-y-6'>
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
                    <div className='p-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2'>
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

      <Card>
        <CardHeader>
          <CardTitle>Start Process</CardTitle>
          <CardDescription>
            Run a command in the project workspace{projectName ? ` (${projectName})` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-3'>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
            <div className='space-y-1'>
              <Label>Command</Label>
              <Input placeholder='bun run dev' value={command} onChange={(e) => setCommand(e.target.value)} />
            </div>
            <div className='space-y-1'>
              <Label>Args</Label>
              <Input placeholder='--port 3000' value={args} onChange={(e) => setArgs(e.target.value)} />
            </div>
            <div className='space-y-1'>
              <Label>Name (optional)</Label>
              <Input placeholder='web server' value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <div className='flex justify-end'>
            <Button onClick={start} disabled={startMutation.isPending || !command.trim()}>
              {startMutation.isPending ? (
                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
              ) : (
                <Play className='h-4 w-4 mr-2' />
              )}
              Start
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Running Processes</CardTitle>
          <CardDescription>Manage and monitor processes started from this project</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
              <Loader2 className='h-4 w-4 animate-spin' /> Loading processes...
            </div>
          ) : processes.length === 0 ? (
            <div className='text-sm text-muted-foreground'>No processes yet. Start one above.</div>
          ) : (
            <div className='space-y-3'>
              {processes.map((p: any) => (
                <div key={p.id} className='rounded-md border p-3'>
                  <div className='flex items-center justify-between gap-3'>
                    <div className='flex items-center gap-2'>
                      <Terminal className='h-4 w-4' />
                      <div className='font-medium'>{p.name || p.command}</div>
                      <div className='text-xs text-muted-foreground'>PID {p.pid ?? '—'}</div>
                      <div className='text-xs'>•</div>
                      <div className='text-xs capitalize'>{p.status}</div>
                    </div>
                    <div className='flex items-center gap-2'>
                      {p.status === 'running' ? (
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() => stopMutation.mutate(p.id)}
                          disabled={stopMutation.isPending}
                        >
                          {stopMutation.isPending ? (
                            <Loader2 className='h-3.5 w-3.5 mr-1 animate-spin' />
                          ) : (
                            <Square className='h-3.5 w-3.5 mr-1' />
                          )}
                          Stop
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {(p.lastOutput?.stdout?.length || p.lastOutput?.stderr?.length) && (
                    <pre className='mt-2 max-h-48 overflow-auto rounded bg-muted p-2 text-xs'>
                      {[...(p.lastOutput.stderr || []), ...(p.lastOutput.stdout || [])]
                        .slice(-20)
                        .map((line: string, idx: number) => (
                          <div key={idx}>{line}</div>
                        ))}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
