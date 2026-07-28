import { describe, expect, it } from 'vitest'
import { buildExtractionPrompt } from './extraction'

describe('buildExtractionPrompt', () => {
  it('includes few-shot examples for both NDA and MSA in the system prompt', () => {
    const { system } = buildExtractionPrompt({ contractText: 'text', contractType: 'NDA', customTerms: [] })
    expect(system).toContain('Example 1 (NDA)')
    expect(system).toContain('Example 4 (MSA)')
  })

  it('instructs a single top-level "terms" JSON key', () => {
    const { system } = buildExtractionPrompt({ contractText: 'text', contractType: 'NDA', customTerms: [] })
    expect(system).toMatch(/single top-level key "terms"/)
  })

  it('never fabricates rule is present', () => {
    const { system } = buildExtractionPrompt({ contractText: 'text', contractType: 'MSA', customTerms: [] })
    expect(system).toMatch(/Never fabricate a value/)
  })

  it('lists the NDA standard terms in the user prompt', () => {
    const { user } = buildExtractionPrompt({ contractText: 'text', contractType: 'NDA', customTerms: [] })
    expect(user).toContain('Disclosing Party')
    expect(user).toContain('Termination Conditions')
    expect(user).not.toContain('Payment Terms') // MSA-only term
  })

  it('lists the MSA standard terms in the user prompt', () => {
    const { user } = buildExtractionPrompt({ contractText: 'text', contractType: 'MSA', customTerms: [] })
    expect(user).toContain('Payment Terms')
    expect(user).toContain('Dispute Resolution Mechanism')
  })

  it('appends custom terms marked as custom', () => {
    const { user } = buildExtractionPrompt({
      contractText: 'text',
      contractType: 'NDA',
      customTerms: ['Non-compete radius'],
    })
    expect(user).toContain('- Non-compete radius (custom)')
  })

  it('includes the full contract text with page markers intact', () => {
    const contractText = '[PAGE 1]\nSome clause text.'
    const { user } = buildExtractionPrompt({ contractText, contractType: 'NDA', customTerms: [] })
    expect(user).toContain(contractText)
  })
})
