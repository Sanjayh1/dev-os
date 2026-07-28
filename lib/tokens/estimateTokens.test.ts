import { describe, expect, it } from 'vitest'
import { estimateTokenCount } from './estimateTokens'

describe('estimateTokenCount', () => {
  it('returns 0 for an empty string', () => {
    expect(estimateTokenCount('')).toBe(0)
  })

  it('estimates roughly 4 characters per token', () => {
    expect(estimateTokenCount('a'.repeat(400))).toBe(100)
  })

  it('rounds up for partial tokens', () => {
    expect(estimateTokenCount('abc')).toBe(1)
    expect(estimateTokenCount('abcde')).toBe(2)
  })
})
