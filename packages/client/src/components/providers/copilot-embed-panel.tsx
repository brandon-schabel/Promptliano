import React, { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Separator,
  Badge
} from '@promptliano/ui'
import { usePromptlianoClient } from '@/context/promptliano-client-context'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { PROVIDERS_ENHANCED_KEYS } from '@/hooks/generated/providers-hooks'

type Health = { success: boolean; upstream: string; checked?: boolean; status?: number; error?: string }

export function CopilotEmbedPanel() {
  const { serverUrl } = usePromptlianoClient()
  const apiBase = useMemo(() => (serverUrl || 'http://localhost:3147').replace(/\/$/, ''), [serverUrl])
  const [embedEnabled, setEmbedEnabled] = useState<boolean>(false)
  const [accountType, setAccountType] = useState<'individual' | 'business' | 'enterprise'>('individual')
  const [rateLimitSeconds, setRateLimitSeconds] = useState<number | ''>('')
  const [rateLimitWait, setRateLimitWait] = useState<boolean>(false)
  const [manualApprove, setManualApprove] = useState<boolean>(false)
  const [showTokens, setShowTokens] = useState<boolean>(false)
  const [health, setHealth] = useState<Health | null>(null)
  const [auth, setAuth] = useState<{ userCode: string; verificationUri: string; device?: any } | null>(null)
  const [modelsCount, setModelsCount] = useState<number | null>(null)
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [hasProvider, setHasProvider] = useState<boolean>(false)
  const { copyToClipboard } = useCopyClipboard()
  const queryClient = useQueryClient()

  useEffect(() => {
    // Load initial status
    fetch(`${apiBase}/api/copilot/embed/status`)
      .then((r) => r.json())
      .then((json) => {
        setAccountType(json.accountType || 'individual')
        if (typeof json.authorized === 'boolean') setAuthorized(json.authorized)
      })
      .catch(() => {})
    fetch(`${apiBase}/api/proxy/copilot/_health`)
      .then((r) => r.json())
      .then((j) => {
        setHealth(j)
        if (typeof j?.upstream === 'string') {
          setEmbedEnabled(j.upstream.includes('/api/upstream/copilot/'))
        }
      })
      .catch(() => setHealth(null))
    // Load provider keys
    refreshProviderPresence().catch(() => {})
  }, [apiBase])

  const refreshProviderPresence = async () => {
    try {
      const r = await fetch(`${apiBase}/api/keys`)
      if (!r.ok) return
      const j = await r.json()
      const list = Array.isArray(j?.data) ? j.data : []
      const exists = list.some((k: any) => String(k.provider).toLowerCase() === 'copilot')
      setHasProvider(exists)
      return exists
    } catch {
      // ignore
      return undefined
    }
  }

  const saveSettings = async () => {
    await fetch(`${apiBase}/api/copilot/embed/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountType,
        rateLimitSeconds: rateLimitSeconds === '' ? undefined : Number(rateLimitSeconds),
        rateLimitWait,
        manualApprove,
        showTokens
      })
    })
  }

  const toggleEmbed = async (enabled: boolean) => {
    setEmbedEnabled(enabled)
    const res = await fetch(`${apiBase}/api/copilot/embed/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    })
    if (!res.ok) {
      // revert UI if failed
      setEmbedEnabled((prev) => !prev)
    }
    // refresh health to reflect upstream selection
    try {
      const r = await fetch(`${apiBase}/api/proxy/copilot/_health`)
      setHealth(await r.json())
    } catch {}
  }

  const startLogin = async () => {
    const r = await fetch(`${apiBase}/api/copilot/embed/auth/start`, { method: 'POST' })
    if (!r.ok) return
    const j = await r.json()
    setAuth({ userCode: j.userCode, verificationUri: j.verificationUri, device: j.device })
  }

  const completeLogin = async () => {
    if (!auth?.device) return
    await fetch(`${apiBase}/api/copilot/embed/auth/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device: auth.device })
    })
    setAuth(null)
    try {
      const s = await fetch(`${apiBase}/api/copilot/embed/status`)
      if (s.ok) {
        const sj = await s.json()
        if (typeof sj.authorized === 'boolean') setAuthorized(sj.authorized)
      }
    } catch {}
    // refresh models and health
    try {
      const r = await fetch(`${apiBase}/api/models?provider=copilot`)
      const j = await r.json()
      setModelsCount(Array.isArray(j?.data) ? j.data.length : null)
    } catch {}
    try {
      const r = await fetch(`${apiBase}/api/proxy/copilot/_health`)
      setHealth(await r.json())
    } catch {}
    // refresh provider presence and notify
    try {
      const prev = hasProvider
      const now = await refreshProviderPresence()
      if (prev === false && now === true) {
        toast.success('Added GitHub Copilot provider')
        // Refresh provider lists in overview/API sections
        queryClient.invalidateQueries({ queryKey: PROVIDERS_ENHANCED_KEYS.lists() })
        queryClient.invalidateQueries({ queryKey: PROVIDERS_ENHANCED_KEYS.health() })
      }
    } catch {}
  }

  const listModels = async () => {
    try {
      const r = await fetch(`${apiBase}/api/models?provider=copilot`)
      const j = await r.json()
      setModelsCount(Array.isArray(j?.data) ? j.data.length : null)
    } catch {
      setModelsCount(null)
    }
  }

  return (
    <div className='p-4 space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>GitHub Copilot</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex items-center gap-2 text-sm'>
            <div>Provider entry:</div>
            <Badge variant={hasProvider ? 'default' : 'secondary'}>{hasProvider ? 'Added' : 'Not added yet'}</Badge>
          </div>
          <div className='flex items-center justify-between'>
            <div>
              <div className='font-medium'>Embedded proxy</div>
              <div className='text-sm text-muted-foreground'>Run copilot-api inside Promptliano (no extra server)</div>
            </div>
            <div className='flex items-center gap-3'>
              <Badge variant={health?.upstream?.includes('/api/upstream/copilot/') ? 'default' : 'outline'}>
                {health?.upstream?.includes('/api/upstream/copilot/') ? 'Embedded' : 'External/Direct'}
              </Badge>
              <Switch checked={embedEnabled} onCheckedChange={toggleEmbed} />
            </div>
          </div>

          <Separator />

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label>Account type</Label>
              <Select value={accountType} onValueChange={(v) => setAccountType(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder='Select account type' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='individual'>Individual</SelectItem>
                  <SelectItem value='business'>Business</SelectItem>
                  <SelectItem value='enterprise'>Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'>
              <Label>Rate limit (seconds)</Label>
              <Input
                type='number'
                min={0}
                value={rateLimitSeconds}
                onChange={(e) => setRateLimitSeconds(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder='30'
              />
            </div>
            <div className='flex items-center justify-between border rounded-md p-3'>
              <div>
                <div className='font-medium'>Wait on limit</div>
                <div className='text-sm text-muted-foreground'>Queue instead of error when limited</div>
              </div>
              <Switch checked={rateLimitWait} onCheckedChange={setRateLimitWait} />
            </div>
            <div className='flex items-center justify-between border rounded-md p-3'>
              <div>
                <div className='font-medium'>Manual approval</div>
                <div className='text-sm text-muted-foreground'>Approve requests before sending upstream</div>
              </div>
              <Switch checked={manualApprove} onCheckedChange={setManualApprove} />
            </div>
            <div className='flex items-center justify-between border rounded-md p-3'>
              <div>
                <div className='font-medium'>Show tokens in logs</div>
                <div className='text-sm text-muted-foreground'>Debugging only; do not enable in production</div>
              </div>
              <Switch checked={showTokens} onCheckedChange={setShowTokens} />
            </div>
          </div>

          <div className='flex gap-2'>
            <Button onClick={saveSettings}>Save Settings</Button>
            <Button variant='outline' onClick={listModels}>
              List Models
            </Button>
            <Button
              variant='outline'
              onClick={async () => {
                try {
                  const r = await fetch(`${apiBase}/api/proxy/copilot/_health`)
                  const j = await r.json()
                  setHealth(j)
                } catch {}
              }}
            >
              Refresh Health
            </Button>
          </div>

          {modelsCount !== null && <div className='text-sm text-muted-foreground'>Models: {modelsCount}</div>}
          {authorized === false && (
            <div className='text-sm text-amber-500'>Not authorized yet — click Start Login and follow the link.</div>
          )}
          {modelsCount === 0 && (
            <div className='text-sm text-amber-500'>
              No models returned. Set COPILOT_API_KEY (e.g., 'dummy') or add a GitHub Copilot provider key with
              secretRef COPILOT_API_KEY.
            </div>
          )}
          {health && (
            <div className='text-sm'>
              <div>Upstream: {health.upstream}</div>
              {typeof health.status === 'number' && <div>Status: {health.status}</div>}
              {health.error && <div className='text-red-500'>Error: {health.error}</div>}
            </div>
          )}

          <Separator />

          <div className='space-y-3'>
            <div className='font-medium'>Authentication</div>
            {!auth ? (
              <Button onClick={startLogin}>Start Login</Button>
            ) : (
              <div className='space-y-2'>
                <div className='text-sm'>Code: {auth.userCode}</div>
                <div className='flex items-center gap-2 text-sm'>
                  <a
                    className='text-primary underline'
                    href={auth.verificationUri}
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    {auth.verificationUri}
                  </a>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => copyToClipboard(auth.userCode, { successMessage: 'Code copied' })}
                  >
                    Copy Code
                  </Button>
                </div>
                <div className='flex gap-2'>
                  <Button onClick={completeLogin}>I’ve Completed Verification</Button>
                  <Button variant='outline' onClick={() => setAuth(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
