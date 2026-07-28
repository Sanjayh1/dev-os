import type { KeyTermData } from './useContractResults'
import { KeyTermRow } from './KeyTermRow'

// Spec: docs/specs/results-display.md — table: Key Term · Value · Page Number
// · Confidence Score · Status.

interface KeyTermsPanelProps {
  keyTerms: KeyTermData[]
  contractId: string
  onPageClick: (page: number) => void
}

export function KeyTermsPanel({ keyTerms, contractId, onPageClick }: KeyTermsPanelProps) {
  return (
    <div className="h-full overflow-y-auto rounded-card border border-border bg-white">
      <table className="w-full border-collapse text-left">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-border-strong text-small font-semibold text-text-secondary">
            <th className="px-md py-sm">Key Term</th>
            <th className="px-md py-sm">Value</th>
            <th className="px-md py-sm">Page</th>
            <th className="px-md py-sm">Confidence</th>
            <th className="px-md py-sm">Status</th>
          </tr>
        </thead>
        <tbody>
          {keyTerms.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-md py-lg text-center text-body text-text-muted">
                No key terms extracted yet.
              </td>
            </tr>
          ) : (
            keyTerms.map((term) => (
              <KeyTermRow key={term.id} term={term} contractId={contractId} onPageClick={onPageClick} />
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
