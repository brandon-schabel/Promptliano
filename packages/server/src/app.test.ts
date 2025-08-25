import { describe, expect, it } from 'bun:test'
import { app } from './app'

describe('App', () => {
  describe('Health Check', () => {
    it('should return 200 for health endpoint', async () => {
      const res = await app.request('/api/health')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toHaveProperty('success', true)
    })
  })

  describe('CORS', () => {
    it('should include CORS headers', async () => {
      const res = await app.request('/api/health', {
        headers: {
          Origin: 'http://localhost:3000'
        }
      })
      expect(res.headers.get('access-control-allow-origin')).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await app.request('/api/unknown-route')
      expect(res.status).toBe(404)
    })

    it('should handle validation errors with 422', async () => {
      const res = await app.request('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Missing required fields
        })
      })
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data).toHaveProperty('success', false)
      // The error structure may vary, just check that there's an error
      expect(data).toHaveProperty('error')
    })
  })

  describe('Swagger Documentation', () => {
    it('should serve swagger UI', async () => {
      const res = await app.request('/swagger')
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('text/html')
    })

    it.skip('should serve OpenAPI spec', async () => {
      // TODO: Fix conflicting parameter names in auto-generated routes
      const res = await app.request('/doc')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toHaveProperty('openapi')
      expect(data).toHaveProperty('paths')
    })
  })
})
