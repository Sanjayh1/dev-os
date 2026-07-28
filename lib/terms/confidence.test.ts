import { describe, expect, it } from 'vitest'
import { enforceConfidenceFloor, getConfidenceColor, getConfidenceTier } from './confidence'

describe('getConfidenceTier', () => {
  it('classifies 90-100 as high', () => {
    expect(getConfidenceTier(90)).toBe('high')
    expect(getConfidenceTier(100)).toBe('high')
  })
  it('classifies 70-89 as medium', () => {
    expect(getConfidenceTier(70)).toBe('medium')
    expect(getConfidenceTier(89)).toBe('medium')
  })
  it('classifies 50-69 as low', () => {
    expect(getConfidenceTier(50)).toBe('low')
    expect(getConfidenceTier(69)).toBe('low')
  })
  it('classifies below 50 as critical', () => {
    expect(getConfidenceTier(49.9)).toBe('critical')
    expect(getConfidenceTier(0)).toBe('critical')
  })
})

describe('getConfidenceColor', () => {
  it('matches the design-system hex per tier', () => {
    expect(getConfidenceColor(95)).toBe('#16A34A')
    expect(getConfidenceColor(80)).toBe('#84CC16')
    expect(getConfidenceColor(60)).toBe('#F59E0B')
    expect(getConfidenceColor(10)).toBe('#DC2626')
  })
})

describe('enforceConfidenceFloor', () => {
  it('leaves the score untouched when a source sentence is present', () => {
    const term = { confidence_score: 95, source_sentence: 'The term is here.' }
    expect(enforceConfidenceFloor(term).confidence_score).toBe(95)
  })

  it('caps the score at 49 when source_sentence is empty', () => {
    const term = { confidence_score: 95, source_sentence: '' }
    expect(enforceConfidenceFloor(term).confidence_score).toBe(49)
  })

  it('caps the score at 49 when source_sentence is whitespace-only', () => {
    const term = { confidence_score: 95, source_sentence: '   ' }
    expect(enforceConfidenceFloor(term).confidence_score).toBe(49)
  })

  it('caps the score at 49 when source_sentence is null', () => {
    const term = { confidence_score: 95, source_sentence: null }
    expect(enforceConfidenceFloor(term).confidence_score).toBe(49)
  })

  it('does not raise an already-low score to 49', () => {
    const term = { confidence_score: 10, source_sentence: null }
    expect(enforceConfidenceFloor(term).confidence_score).toBe(10)
  })

  it('preserves other fields on the term', () => {
    const term = { confidence_score: 95, source_sentence: '', term_name: 'Governing Law' }
    expect(enforceConfidenceFloor(term)).toMatchObject({ term_name: 'Governing Law' })
  })
})
