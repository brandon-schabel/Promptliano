import { describe, expect, it } from 'bun:test'
import { app } from './app'

describe('Route param naming', () => {
  it('OpenAPI uses {id} for /api/projects/{id}', async () => {
    const res = await app.request('/doc')
    expect(res.status).toBe(200)
    const doc = await res.json()

    // Ensure the correct path exists and the old variant does not
    expect(doc.paths['/api/projects/{id}']).toBeTruthy()
    expect(doc.paths['/api/projects/{projectId}']).toBeUndefined()
  })

  it('GET /api/projects/1 does not return 400 validation error', async () => {
    const res = await app.request('/api/projects/1')
    // With correct param mapping, this should be 200 (exists) or 404 (not found), but not 400
    expect(res.status).not.toBe(400)
  })
})
