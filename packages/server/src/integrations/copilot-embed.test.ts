import { describe, it, expect } from 'bun:test'
import { parseCopilotEmbedConfig, getEmbeddedUpstreamBase } from './copilot-embed'

describe('parseCopilotEmbedConfig', () => {
  it('returns sensible defaults', () => {
    const cfg = parseCopilotEmbedConfig({})
    expect(cfg.enabled).toBe(false)
    expect(cfg.accountType).toBe('individual')
    expect(cfg.rateLimitSeconds).toBeUndefined()
    expect(cfg.rateLimitWait).toBe(false)
    expect(cfg.manualApprove).toBe(false)
    expect(cfg.showTokens).toBe(false)
    expect(typeof cfg.serverHost).toBe('string')
    expect(typeof cfg.serverPort).toBe('string')
  })

  it('parses booleans and integers', () => {
    const cfg = parseCopilotEmbedConfig({
      COPILOT_EMBED_ENABLED: 'true',
      COPILOT_ACCOUNT_TYPE: 'business',
      COPILOT_RATE_LIMIT_SECONDS: '30',
      COPILOT_RATE_LIMIT_WAIT: '1',
      COPILOT_MANUAL_APPROVE: 'yes',
      COPILOT_SHOW_TOKENS: 'on',
      SERVER_HOST: '0.0.0.0',
      SERVER_PORT: '9999'
    })
    expect(cfg.enabled).toBe(true)
    expect(cfg.accountType).toBe('business')
    expect(cfg.rateLimitSeconds).toBe(30)
    expect(cfg.rateLimitWait).toBe(true)
    expect(cfg.manualApprove).toBe(true)
    expect(cfg.showTokens).toBe(true)
    expect(cfg.serverHost).toBe('0.0.0.0')
    expect(cfg.serverPort).toBe('9999')
  })

  it('handles invalid account type and negative integers gracefully', () => {
    const cfg = parseCopilotEmbedConfig({ COPILOT_ACCOUNT_TYPE: 'weird', COPILOT_RATE_LIMIT_SECONDS: '-10' })
    expect(cfg.accountType).toBe('individual')
    expect(cfg.rateLimitSeconds).toBeUndefined()
  })
})

describe('getEmbeddedUpstreamBase', () => {
  it('computes an internal upstream URL', () => {
    const url = getEmbeddedUpstreamBase({ serverHost: '0.0.0.0', serverPort: '4242' })
    expect(url).toBe('http://127.0.0.1:4242/api/upstream/copilot/v1')
  })
})
