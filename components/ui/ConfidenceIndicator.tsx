import { AlertTriangle } from 'lucide-react'
import { getConfidenceColor, getConfidenceTier } from '@/lib/terms/confidence'
import { Tooltip } from './Tooltip'

interface ConfidenceIndicatorProps {
  score: number
}

// Spec: docs/specs/key-term-extraction.md — <50% always shows a non-dismissible
// warning icon + tooltip; the term itself is never hidden, only flagged.
export function ConfidenceIndicator({ score }: ConfidenceIndicatorProps) {
  const tier = getConfidenceTier(score)
  const color = getConfidenceColor(score)
  const label = `${Math.round(score)}%`

  if (tier === 'critical') {
    return (
      <Tooltip content="Low confidence — verify this value against the source document">
        <span className="inline-flex items-center gap-xs text-body font-semibold" style={{ color }}>
          <AlertTriangle size={18} strokeWidth={1.5} />
          {label}
        </span>
      </Tooltip>
    )
  }

  return (
    <span className="text-body font-semibold" style={{ color }}>
      {label}
    </span>
  )
}
