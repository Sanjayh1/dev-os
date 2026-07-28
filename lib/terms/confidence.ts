// Spec: docs/specs/key-term-extraction.md
// Confidence tier thresholds and colors match skills/design-system/SKILL.md exactly.

export type ConfidenceTier = 'high' | 'medium' | 'low' | 'critical'

const TIER_COLORS: Record<ConfidenceTier, string> = {
  high: '#16A34A',
  medium: '#84CC16',
  low: '#F59E0B',
  critical: '#DC2626',
}

export function getConfidenceTier(score: number): ConfidenceTier {
  if (score >= 90) return 'high'
  if (score >= 70) return 'medium'
  if (score >= 50) return 'low'
  return 'critical'
}

export function getConfidenceColor(score: number): string {
  return TIER_COLORS[getConfidenceTier(score)]
}

interface ExtractedTermLike {
  confidence_score: number
  source_sentence: string | null | undefined
}

/**
 * A term with no traceable source sentence is never displayed as reliable,
 * regardless of what confidence the model self-reported.
 */
export function enforceConfidenceFloor<T extends ExtractedTermLike>(term: T): T {
  if (!term.source_sentence || term.source_sentence.trim().length === 0) {
    return { ...term, confidence_score: Math.min(term.confidence_score, 49) }
  }
  return term
}
