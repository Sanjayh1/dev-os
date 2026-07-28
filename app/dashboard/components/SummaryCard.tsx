'use client'

import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import type { RecentContract } from './useDashboardSummary'
import { getStatusBadge } from './statusBadge'

// Spec: docs/specs/dashboard.md — total count, NDA/MSA breakdown, last-5 mini list.

interface SummaryCardProps {
  total: number
  ndaCount: number
  msaCount: number
  recent: RecentContract[]
}

export function SummaryCard({ total, ndaCount, msaCount, recent }: SummaryCardProps) {
  const router = useRouter()

  return (
    <div className="rounded-card border border-border bg-white p-lg">
      <div className="flex flex-wrap gap-xl">
        <div>
          <p className="text-small text-text-muted">Total contracts</p>
          <p className="text-h2 text-text-primary">{total}</p>
        </div>
        <div>
          <p className="text-small text-text-muted">NDAs</p>
          <p className="text-h2 text-text-primary">{ndaCount}</p>
        </div>
        <div>
          <p className="text-small text-text-muted">MSAs</p>
          <p className="text-h2 text-text-primary">{msaCount}</p>
        </div>
      </div>

      {recent.length > 0 && (
        <div className="mt-lg">
          <p className="mb-sm text-small font-semibold text-text-secondary">Recently reviewed</p>
          <ul className="flex flex-col divide-y divide-border">
            {recent.map((contract) => {
              const badge = getStatusBadge(contract.status)
              return (
                <li
                  key={contract.id}
                  onClick={() => router.push(`/contracts/${contract.id}/results`)}
                  className="flex cursor-pointer items-center justify-between py-sm hover:bg-bg-subtle"
                >
                  <span className="text-body text-text-primary">{contract.file_name}</span>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
