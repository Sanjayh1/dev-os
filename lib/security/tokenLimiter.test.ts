import { describe, expect, it } from 'vitest'
import {
  MAX_FILE_SIZE_BYTES,
  MAX_MESSAGE_LENGTH,
  MAX_PAGE_COUNT,
  isFileSizeAllowed,
  isMessageLengthAllowed,
  isPageCountAllowed,
} from './tokenLimiter'

describe('tokenLimiter', () => {
  it('kept the product MVP scope rather than the skill template defaults', () => {
    // 20 pages / 2000 chars are this product's real, spec'd, DB-constrained
    // limits — not the skill's generic 200 pages / 5000 chars.
    expect(MAX_PAGE_COUNT).toBe(20)
    expect(MAX_MESSAGE_LENGTH).toBe(2000)
  })

  it('isFileSizeAllowed rejects zero, negative, and over-limit sizes', () => {
    expect(isFileSizeAllowed(0)).toBe(false)
    expect(isFileSizeAllowed(-1)).toBe(false)
    expect(isFileSizeAllowed(1024)).toBe(true)
    expect(isFileSizeAllowed(MAX_FILE_SIZE_BYTES)).toBe(true)
    expect(isFileSizeAllowed(MAX_FILE_SIZE_BYTES + 1)).toBe(false)
  })

  it('isPageCountAllowed enforces the 20-page ceiling', () => {
    expect(isPageCountAllowed(20)).toBe(true)
    expect(isPageCountAllowed(21)).toBe(false)
  })

  it('isMessageLengthAllowed rejects empty and over-limit messages', () => {
    expect(isMessageLengthAllowed(0)).toBe(false)
    expect(isMessageLengthAllowed(1)).toBe(true)
    expect(isMessageLengthAllowed(MAX_MESSAGE_LENGTH)).toBe(true)
    expect(isMessageLengthAllowed(MAX_MESSAGE_LENGTH + 1)).toBe(false)
  })
})
