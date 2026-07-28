import { X } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'

// Spec: docs/specs/upload-extraction.md + docs/specs/custom-terms.md
// Renders the static standard-term list for the chosen type while
// extraction/preview loads, plus any draft custom terms with a removable
// "Custom" badge (draft terms are batched and sent on "Process Contract",
// not incrementally — see custom-terms.md).

interface KeyTermPreviewListProps {
  standardTerms: string[]
  customTerms: string[]
  onRemoveCustomTerm: (term: string) => void
}

export function KeyTermPreviewList({ standardTerms, customTerms, onRemoveCustomTerm }: KeyTermPreviewListProps) {
  return (
    <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-white">
      {standardTerms.map((term) => (
        <li key={term} className="px-md py-sm text-body text-text-muted">
          {term}
        </li>
      ))}
      {customTerms.map((term) => (
        <li key={term} className="flex items-center justify-between px-md py-sm text-body text-text-muted">
          <span className="flex items-center gap-xs">
            {term}
            <Badge variant="custom">Custom</Badge>
          </span>
          <button
            type="button"
            onClick={() => onRemoveCustomTerm(term)}
            aria-label={`Remove ${term}`}
            className="text-text-muted hover:text-error"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </li>
      ))}
    </ul>
  )
}
