import { describe, it, expect, afterEach } from 'bun:test'
import { OpenAPIHono } from '@hono/zod-openapi'

const origFetch = globalThis.fetch
const origEnv = { ...process.env }

afterEach(() => {
  globalThis.fetch = origFetch
  process.env = { ...origEnv }
})

describe('Copilot Proxy Routes', () => {
  it('proxies /v1/models with Authorization injection and preserves query', async () => {
    process.env.COPILOT_PROXY_UPSTREAM = 'http://mock-upstream.local/v1'
    process.env.COPILOT_API_KEY = 'dummy'

    let capturedUrl: string | URL | Request | undefined
    let capturedAuth: string | null = null
    globalThis.fetch = async (url, init) => {
      capturedUrl = url
      const h = new Headers(init?.headers)
      capturedAuth = h.get('authorization')
      return new Response(JSON.stringify({ data: [{ id: 'copilot-code', name: 'Copilot Code' }] }), {
        headers: { 'content-type': 'application/json' }
      })
    }

    const mod = await import('./copilot-proxy-routes')
    const app = new OpenAPIHono().route('/', mod.copilotProxyRoutes)

    const res = await app.request('/api/proxy/copilot/v1/models?foo=bar')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json?.data?.[0]?.id).toBe('copilot-code')
    expect(String(capturedUrl)).toBe('http://mock-upstream.local/v1/models?foo=bar')
    expect(capturedAuth).toBe('Bearer dummy')
  })

  it('health endpoint reports upstream and status', async () => {
    process.env.COPILOT_PROXY_UPSTREAM = 'http://mock-upstream.local/v1'
    process.env.COPILOT_API_KEY = 'dummy'

    globalThis.fetch = async () => new Response('{}', { status: 200 })

    const mod = await import('./copilot-proxy-routes')
    const app = new OpenAPIHono().route('/', mod.copilotProxyRoutes)

    const res = await app.request('/api/proxy/copilot/_health')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.upstream).toBe('http://mock-upstream.local/v1')
    expect(typeof json.status).toBe('number')
  })
})
