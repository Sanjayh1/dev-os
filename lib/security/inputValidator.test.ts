import { describe, expect, it } from 'vitest'
import {
  chatMessageBodySchema,
  contractTypeSchema,
  customTermsBodySchema,
  feedbackBodySchema,
  keyTermPatchBodySchema,
  loginCredentialsSchema,
  signupCredentialsSchema,
  uploadBodySchema,
  validateBody,
  validateFileUpload,
} from './inputValidator'

describe('validateBody', () => {
  it('accepts a valid upload body', () => {
    const result = validateBody(uploadBodySchema, { contract_type: 'NDA' })
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ contract_type: 'NDA' })
  })

  it('rejects an invalid contract_type', () => {
    const result = validateBody(uploadBodySchema, { contract_type: 'LEASE' })
    expect(result.success).toBe(false)
  })

  it('accepts a valid chat message body', () => {
    expect(validateBody(chatMessageBodySchema, { message: 'hi' }).success).toBe(true)
  })

  it('rejects a chat message over the max length', () => {
    const result = validateBody(chatMessageBodySchema, { message: 'x'.repeat(2001) })
    expect(result.success).toBe(false)
  })

  it('accepts a valid feedback body with an optional comment omitted', () => {
    const result = validateBody(feedbackBodySchema, {
      contract_id: '11111111-1111-4111-8111-111111111111',
      rating: 'up',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a feedback body with a non-UUID contract_id', () => {
    const result = validateBody(feedbackBodySchema, { contract_id: 'not-a-uuid', rating: 'up' })
    expect(result.success).toBe(false)
  })

  it('rejects a feedback body with an invalid rating', () => {
    const result = validateBody(feedbackBodySchema, {
      contract_id: '11111111-1111-4111-8111-111111111111',
      rating: 'sideways',
    })
    expect(result.success).toBe(false)
  })

  it('accepts a valid key term patch body', () => {
    expect(validateBody(keyTermPatchBodySchema, { value: 'Delaware' }).success).toBe(true)
  })

  it('accepts up to 5 custom terms', () => {
    const result = validateBody(customTermsBodySchema, { terms: ['a', 'b', 'c', 'd', 'e'] })
    expect(result.success).toBe(true)
  })

  it('rejects more than 5 custom terms', () => {
    const result = validateBody(customTermsBodySchema, { terms: ['a', 'b', 'c', 'd', 'e', 'f'] })
    expect(result.success).toBe(false)
  })

  it('enforces signup password policy (min 8 chars)', () => {
    expect(validateBody(signupCredentialsSchema, { email: 'a@b.com', password: 'short' }).success).toBe(false)
    expect(validateBody(signupCredentialsSchema, { email: 'a@b.com', password: 'longenough' }).success).toBe(true)
  })

  it('does not enforce a password length policy on login', () => {
    // A real, already-set password might be short if it predates the policy —
    // login must not reject it before Supabase Auth even gets a chance to
    // say whether it's actually correct.
    expect(validateBody(loginCredentialsSchema, { email: 'a@b.com', password: 'short' }).success).toBe(true)
  })

  it('rejects an empty password on login', () => {
    expect(validateBody(loginCredentialsSchema, { email: 'a@b.com', password: '' }).success).toBe(false)
  })

  it('rejects a malformed email on both login and signup', () => {
    expect(validateBody(loginCredentialsSchema, { email: 'not-an-email', password: 'whatever' }).success).toBe(false)
    expect(validateBody(signupCredentialsSchema, { email: 'not-an-email', password: 'longenough' }).success).toBe(
      false
    )
  })
})

describe('contractTypeSchema', () => {
  it('only accepts NDA or MSA', () => {
    expect(contractTypeSchema.safeParse('NDA').success).toBe(true)
    expect(contractTypeSchema.safeParse('MSA').success).toBe(true)
    expect(contractTypeSchema.safeParse('LEASE').success).toBe(false)
  })
})

describe('validateFileUpload', () => {
  function file(overrides: Partial<{ name: string; type: string; size: number }> = {}) {
    return { name: 'contract.pdf', type: 'application/pdf', size: 1024, ...overrides }
  }

  it('accepts a well-formed PDF', () => {
    expect(validateFileUpload(file()).valid).toBe(true)
  })

  it('blocks a blocklisted extension even with a spoofed PDF-adjacent name', () => {
    const result = validateFileUpload(file({ name: 'invoice.pdf.exe' }))
    expect(result.valid).toBe(false)
    expect(result.code).toBe('blocked_extension')
  })

  it('rejects .docx — not supported by the extraction pipeline despite being a common office format', () => {
    const result = validateFileUpload(file({ name: 'contract.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))
    expect(result.valid).toBe(false)
    expect(result.code).toBe('invalid_file_type')
  })

  it('rejects a PDF-extension file whose MIME type does not match', () => {
    const result = validateFileUpload(file({ type: 'text/plain' }))
    expect(result.valid).toBe(false)
    expect(result.code).toBe('invalid_file_type')
  })

  it('rejects a file over the size limit', () => {
    const result = validateFileUpload(file({ size: 11 * 1024 * 1024 }))
    expect(result.valid).toBe(false)
    expect(result.code).toBe('file_too_large')
  })

  it('checks extension/MIME before size, so a too-large disguised executable reports blocked_extension', () => {
    const result = validateFileUpload(file({ name: 'payload.exe', size: 50 * 1024 * 1024 }))
    expect(result.code).toBe('blocked_extension')
  })
})

