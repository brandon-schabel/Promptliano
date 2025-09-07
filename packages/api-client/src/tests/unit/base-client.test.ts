import { describe, test, expect } from 'bun:test'
import { z } from 'zod'
import { BaseApiClient, PromptlianoError, type ApiConfig } from '../../base-client'

// Helper to build a client with a mocked fetch
function createClient(mockFetch: typeof fetch, baseUrl = 'http://localhost:12345'): BaseApiClient {
  const cfg: ApiConfig = { baseUrl, customFetch: mockFetch }
  // @ts-ignore accessing protected for testing via subclass
  return new (class extends BaseApiClient {
    // Expose protected helpers for testing
    public _request = this.request.bind(this)
    public _get = this.get.bind(this)
    public _post = this.post.bind(this)
    public _put = this.put.bind(this)
    public _patch = this.patch.bind(this)
    public _delete = this.delete.bind(this)
  })(cfg)
}

describe('BaseApiClient request()', () => {
  test('parses and validates JSON response', async () => {
    const schema = z.object({ success: z.literal(true), data: z.object({ value: z.string() }) })
    const mockFetch: typeof fetch = async (_input, _init) =>
      new Response(JSON.stringify({ success: true, data: { value: 'ok' } }), { status: 200 })

    const client = createClient(mockFetch)
    // @ts-ignore
    const res = await client._get('/health', { responseSchema: schema })
    expect(res.data.value).toBe('ok')
  })

  test('returns text when expectTextResponse=true', async () => {
    const mockFetch: typeof fetch = async (_input, _init) => new Response('# hello', { status: 200 })
    const client = createClient(mockFetch)
    // @ts-ignore
    const res = await client._get<string>('/markdown', { expectTextResponse: true })
    expect(res).toBe('# hello')
  })

  test('throws on invalid JSON response', async () => {
    const mockFetch: typeof fetch = async (_input, _init) => new Response('not-json', { status: 200 })
    const client = createClient(mockFetch)
    await expect(
      // @ts-ignore
      client._get('/broken')
    ).rejects.toBeInstanceOf(PromptlianoError)
  })

  test('propagates server error response with details', async () => {
    const body = { success: false, error: { message: 'Bad', code: 'BAD_THING', details: { reason: 'x' } } }
    const mockFetch: typeof fetch = async () => new Response(JSON.stringify(body), { status: 400 })
    const client = createClient(mockFetch)
    await expect(
      // @ts-ignore
      client._get('/oops')
    ).rejects.toMatchObject({ statusCode: 400, code: 'BAD_THING' })
  })

  test('aborts on timeout and throws PromptlianoError TIMEOUT', async () => {
    const mockFetch: typeof fetch = async (_input, init) => {
      // Never resolve, simulate a hanging request that honors AbortSignal
      return await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('AbortError'), { name: 'AbortError' })))
      })
    }
    const client = createClient(mockFetch)
    await expect(
      // @ts-ignore
      client._get('/slow', { timeout: 10 })
    ).rejects.toMatchObject({ code: 'TIMEOUT' })
  })
})

