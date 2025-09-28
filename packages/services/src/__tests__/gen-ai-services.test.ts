import { describe, expect, it } from 'bun:test'
import { extractString } from '../gen-ai-services'

describe('extractString', () => {
  it('returns empty string for nullish values', () => {
    expect(extractString(null)).toBe('')
    expect(extractString(undefined)).toBe('')
  })

  it('returns string values unchanged', () => {
    expect(extractString('hello')).toBe('hello')
  })

  it('extracts text from delta fields', () => {
    const result = extractString({ delta: 'streamed text', ignored: 'value' })
    expect(result).toBe('streamed text')
  })

  it('aggregates delta strings from arrays', () => {
    const value = [
      { delta: 'hello ' },
      { text: 'world' },
      '!' ]
    expect(extractString(value)).toBe('hello world!')
  })
})
