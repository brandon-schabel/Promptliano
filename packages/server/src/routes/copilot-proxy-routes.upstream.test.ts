import { describe, it, expect, afterEach } from 'bun:test'
import { getUpstreamBase } from './copilot-proxy-routes'

const origEnv = { ...process.env }

afterEach(() => {
  process.env = { ...origEnv }
})

describe('getUpstreamBase precedence', () => {
  it('uses COPILOT_PROXY_UPSTREAM if set', () => {
    process.env.COPILOT_PROXY_UPSTREAM = 'http://x:1/v1/'
    expect(getUpstreamBase()).toBe('http://x:1/v1')
  })

  it('falls back to COPILOT_UPSTREAM_URL', () => {
    delete process.env.COPILOT_PROXY_UPSTREAM
    process.env.COPILOT_UPSTREAM_URL = 'http://y:2/v1/'
    expect(getUpstreamBase()).toBe('http://y:2/v1')
  })

  it('uses embedded upstream when enabled', () => {
    delete process.env.COPILOT_PROXY_UPSTREAM
    delete process.env.COPILOT_UPSTREAM_URL
    process.env.COPILOT_EMBED_ENABLED = 'true'
    const base = getUpstreamBase()
    expect(base.endsWith('/api/upstream/copilot/v1')).toBe(true)
  })

  it('uses COPILOT_BASE_URL when no embed/explicit upstream', () => {
    delete process.env.COPILOT_PROXY_UPSTREAM
    delete process.env.COPILOT_UPSTREAM_URL
    delete process.env.COPILOT_EMBED_ENABLED
    process.env.COPILOT_BASE_URL = 'http://z:3/v1/'
    expect(getUpstreamBase()).toBe('http://z:3/v1')
  })

  it('defaults to copilot-api standard', () => {
    delete process.env.COPILOT_PROXY_UPSTREAM
    delete process.env.COPILOT_UPSTREAM_URL
    delete process.env.COPILOT_EMBED_ENABLED
    delete process.env.COPILOT_BASE_URL
    expect(getUpstreamBase()).toBe('http://127.0.0.1:4141/v1')
  })
})

