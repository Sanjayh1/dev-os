import { describe, expect, it } from 'vitest'
import { buildChatPrompt, classifyQuestion } from './chat'

describe('classifyQuestion', () => {
  it('always classifies as contract when there is no prior history', () => {
    expect(classifyQuestion('What did we discuss earlier?', false)).toBe('contract')
    expect(classifyQuestion('What is the termination clause?', false)).toBe('contract')
  })

  it('classifies plain document questions as contract', () => {
    expect(classifyQuestion('What is the governing law?', true)).toBe('contract')
    expect(classifyQuestion('What is the payment term in this agreement?', true)).toBe('contract')
  })

  it('classifies pure conversation-recall questions as history', () => {
    expect(classifyQuestion('What did I just ask you?', true)).toBe('history')
    expect(classifyQuestion('Can you summarize our conversation so far?', true)).toBe('history')
  })

  it('classifies conversation-recall questions that also reference the document as both', () => {
    expect(classifyQuestion('Earlier you mentioned a clause — what page was that on?', true)).toBe('both')
    expect(classifyQuestion('What did we discuss about the contract term length?', true)).toBe('both')
  })

  it('classifies generic follow-up pronouns as both', () => {
    expect(classifyQuestion('Can you clarify that?', true)).toBe('both')
    expect(classifyQuestion('What about it?', true)).toBe('both')
  })
})

describe('buildChatPrompt', () => {
  it('uses the exact contract system prompt and includes contract text', () => {
    const { system } = buildChatPrompt({
      contextType: 'contract',
      contractText: '[PAGE 1]\nGoverning law is Delaware.',
      history: [],
      message: 'What is the governing law?',
    })
    expect(system).toContain('Answer only from the contract. Cite [Page X].')
    expect(system).toContain('Governing law is Delaware.')
  })

  it('uses the exact history system prompt and omits contract text entirely', () => {
    const { system } = buildChatPrompt({
      contextType: 'history',
      history: [{ role: 'user', content: 'hi' }],
      message: 'What did I just ask?',
    })
    expect(system).toBe('Answer only from the conversation. End with [From conversation].')
    expect(system).not.toContain('Contract text')
  })

  it('uses the exact both system prompt and includes contract text', () => {
    const { system } = buildChatPrompt({
      contextType: 'both',
      contractText: '[PAGE 1]\ntext',
      history: [{ role: 'user', content: 'hi' }],
      message: 'Earlier you mentioned a clause on this page — which one?',
    })
    expect(system).toContain('Answer from both. Attribute each fact to its source.')
    expect(system).toContain('Contract text')
  })

  it('appends the new user message after prior history, in order', () => {
    const history: Array<{ role: 'user' | 'assistant'; content: string }> = [
      { role: 'user', content: 'First question' },
      { role: 'assistant', content: 'First answer [Page 1]' },
    ]
    const { messages } = buildChatPrompt({
      contextType: 'contract',
      contractText: 'text',
      history,
      message: 'Follow-up',
    })
    expect(messages).toEqual([...history, { role: 'user', content: 'Follow-up' }])
  })
})
