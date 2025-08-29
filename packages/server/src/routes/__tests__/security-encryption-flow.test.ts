import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import { app } from '../../app'
import { rawDb, encryptionKeyRepository } from '@promptliano/database'

async function deleteAll(table: string) {
  try {
    await rawDb.exec(`DELETE FROM ${table}`)
  } catch (e) {
    // ignore if table doesn't exist in test env
  }
}

function ensureCoreTables() {
  // encryption_keys table
  rawDb.exec(`CREATE TABLE IF NOT EXISTS encryption_keys (
    id INTEGER PRIMARY KEY,
    key TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`)

  // provider_keys table
  rawDb.exec(`CREATE TABLE IF NOT EXISTS provider_keys (
    id INTEGER PRIMARY KEY,
    provider TEXT NOT NULL,
    key_name TEXT NOT NULL,
    name TEXT,
    encrypted_value TEXT NOT NULL,
    key TEXT,
    encrypted INTEGER NOT NULL DEFAULT 1,
    iv TEXT,
    tag TEXT,
    salt TEXT,
    base_url TEXT,
    custom_headers TEXT DEFAULT '{}',
    is_default INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    environment TEXT NOT NULL DEFAULT 'production',
    description TEXT,
    expires_at INTEGER,
    last_used INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`)
}

describe('Encryption key rotation and provider keys', () => {
  const originalEnv = { ...process.env }

  beforeEach(async () => {
    ensureCoreTables()
    await deleteAll('provider_keys')
    await deleteAll('encryption_keys')
    encryptionKeyRepository.clearCache()
    delete process.env.PROMPTLIANO_ENCRYPTION_KEY
    delete process.env.OPENROUTER_API_KEY
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  test('rotate with re-encryption preserves existing provider keys', async () => {
    // Create a provider key (encrypted with the current key)
    const createRes = await app.request('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'openrouter',
        name: 'OpenRouter',
        key: 'openrouter-test-key-123',
        isDefault: true
      })
    })
    expect(createRes.status).toBe(201)
    const created = await createRes.json()
    const keyId = created.data.id as number
    expect(keyId).toBeGreaterThan(0)

    // Verify secret can be retrieved before rotation
    const getBefore = await app.request(`/api/keys/${keyId}`)
    expect(getBefore.status).toBe(200)
    const beforeData = await getBefore.json()
    expect(beforeData?.data?.key).toBe('openrouter-test-key-123')

    // Rotate encryption key with re-encryption enabled
    const rotateRes = await app.request('/api/security/encryption-key/rotate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ generate: true, reencryptExisting: true })
    })
    expect(rotateRes.status).toBe(200)
    const rotateBody = await rotateRes.json()
    expect(rotateBody?.success).toBe(true)
    expect(rotateBody?.data?.reencrypted).toBeGreaterThanOrEqual(1)

    // Verify secret is still retrievable after rotation
    const getAfter = await app.request(`/api/keys/${keyId}`)
    expect(getAfter.status).toBe(200)
    const afterData = await getAfter.json()
    expect(afterData?.data?.key).toBe('openrouter-test-key-123')
  })

  test('rotate without re-encryption invalidates existing encrypted keys', async () => {
    const createRes = await app.request('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'openai', name: 'OpenAI', key: 'sk-live-abc', isDefault: true })
    })
    expect(createRes.status).toBe(201)
    const created = await createRes.json()
    const keyId = created.data.id as number

    // Rotate with reencryptExisting = false
    const rotateRes = await app.request('/api/security/encryption-key/rotate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ generate: true, reencryptExisting: false })
    })
    expect(rotateRes.status).toBe(200)
    const rotateBody = await rotateRes.json()
    expect(rotateBody?.data?.skipped).toBeGreaterThanOrEqual(0)

    // Existing key should no longer decrypt (service returns null for key)
    const getAfter = await app.request(`/api/keys/${keyId}`)
    expect(getAfter.status).toBe(200)
    const afterData = await getAfter.json()
    expect(afterData?.data?.key === null || afterData?.data?.key === undefined).toBe(true)
  })

  test('models: missing provider key returns an empty list (no error)', async () => {
    // Ensure no keys or env fallback
    delete process.env.OPENROUTER_API_KEY

    const res = await app.request('/api/models?provider=openrouter')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body?.success).toBe(true)
    expect(Array.isArray(body?.data)).toBe(true)
    expect(body.data.length).toBe(0)
  })

  test('models: env fallback key + stubbed OpenRouter returns models', async () => {
    // Provide env fallback key
    process.env.OPENROUTER_API_KEY = 'env-fallback-test-key'

    // Stub fetch for OpenRouter models endpoint
    const originalFetch = global.fetch
    const stubbed = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      // Only intercept OpenRouter URL; default to empty list for any other
      const url = typeof input === 'string' ? input : (input as URL).toString()
      if (url.includes('openrouter.ai') && url.endsWith('/models')) {
        const payload = {
          data: [
            {
              id: 'anthropic/claude-3-sonnet',
              name: 'Claude 3 Sonnet',
              description: 'Stubbed model',
              context: { tokens: 100000 },
              pricing: { prompt: 0.0001, completion: 0.0002 }
            }
          ]
        }
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 })
    })
    // @ts-ignore
    global.fetch = stubbed

    const res = await app.request('/api/models?provider=openrouter')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body?.success).toBe(true)
    expect(Array.isArray(body?.data)).toBe(true)
    expect(body.data.length).toBeGreaterThan(0)
    expect(body.data[0].id).toBe('anthropic/claude-3-sonnet')
    expect(body.data[0].provider).toBe('openrouter')

    // Restore original fetch
    global.fetch = originalFetch as any
  })
})
