import { describe, expect, it } from 'bun:test'
import { z } from 'zod'

import {
  buildExampleJsonStructure,
  createJsonOnlyPrompt,
  extractJsonStringFromResponse
} from '../structured-output-helpers'

describe('buildExampleJsonStructure', () => {
  it('creates placeholder values for various primitive types', () => {
    const schema = z.object({
      title: z.string(),
      count: z.number(),
      enabled: z.boolean(),
      tags: z.array(z.string()),
      metadata: z.object({}).optional()
    })

    const example = buildExampleJsonStructure(schema)

    expect(example).toMatchObject({
      title: 'string value here',
      count: 0,
      enabled: false,
      tags: []
    })
    expect(example).not.toHaveProperty('metadata')
  })

  it('returns an empty object when schema introspection fails', () => {
    const schema = z.never()
    expect(buildExampleJsonStructure(schema)).toEqual({})
  })
})

describe('extractJsonStringFromResponse', () => {
  it('removes markdown code fences', () => {
    const raw = '```json\n{"foo":"bar"}\n```'
    expect(extractJsonStringFromResponse(raw)).toBe('{"foo":"bar"}')
  })

  it('extracts the first valid JSON object from noisy output', () => {
    const raw = 'Here you go:\n```\n{"valid":true}\n```\nSome trailing text.'
    expect(extractJsonStringFromResponse(raw)).toBe('{"valid":true}')
  })

  it('prefers object matches over arrays when both are present', () => {
    const raw = 'Summary: [1,2,3]\nDetails: {"acceptable":true}'
    expect(extractJsonStringFromResponse(raw)).toBe('{"acceptable":true}')
  })

  it('falls back to trimmed text when no valid JSON is found', () => {
    const raw = 'No structured data available.'
    expect(extractJsonStringFromResponse(raw)).toBe('No structured data available.')
  })
})

describe('createJsonOnlyPrompt', () => {
  it('builds instruction prompt with example JSON and system message', () => {
    const schema = z.object({
      result: z.string(),
      success: z.boolean()
    })

    const prompt = createJsonOnlyPrompt('Summarise.', schema, 'You are a helpful assistant.')

    expect(prompt).toContain('You are a helpful assistant.')
    expect(prompt).toContain('Summarise.')
    expect(prompt).toContain('"result"')
    expect(prompt).toContain('"success"')
    expect(prompt).toContain('Return ONLY valid JSON')
  })
})
