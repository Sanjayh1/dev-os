'use client'

import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import type { RecentContract } from './useDashboardSummary'
import type { HistorySortColumn, HistorySortDirection } from './useContractHistory'
import { getStatusBadge } from './statusBadge'

// Spec: docs/specs/dashboard.md — sortable columns (name, type, date, status);
// row click navigates to /contracts/{id}/results.

interface ContractHistoryTableProps {
  contracts: RecentContract[]
  sortColumn: HistorySortColumn
  sortDirection: HistorySortDirection
  onSortChange: (column: HistorySortColumn) => void
}

const COLUMNS: Array<{ key: HistorySortColumn; label: string }> = [
  { key: 'file_name', label: 'Name' },
  { key: 'contract_type', label: 'Type' },
  { key: 'created_at', label: 'Date' },
]

export function ContractHistoryTable({
  contracts,
  sortColumn,
  sortDirection,
  onSortChange,
}: ContractHistoryTableProps) {
  const router = useRouter()

  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-border-strong text-small font-semibold text-text-secondary">
          {COLUMNS.map((column) => (
            <th key={column.key} className="px-md py-sm">
              <button
                type="button"
                onClick={() => onSortChange(column.key)}
                className="flex items-center gap-xs hover:text-text-primary"
              >
                {column.label}
                {sortColumn === column.key && <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>}
              </button>
            </th>
          ))}
          <th className="px-md py-sm">Status</th>
        </tr>
      </thead>
      <tbody>
        {contracts.map((contract) => {
          const badge = getStatusBadge(contract.status)
          return (
            <tr
              key={contract.id}
              onClick={() => router.push(`/contracts/${contract.id}/results`)}
              className="cursor-pointer border-b border-border hover:bg-bg-subtle"
            >
              <td className="px-md py-sm text-body text-text-primary">{contract.file_name}</td>
              <td className="px-md py-sm text-body text-text-primary">{contract.contract_type}</td>
              <td className="px-md py-sm text-body text-text-secondary">
                {new Date(contract.created_at).toLocaleDateString()}
              </td>
              <td className="px-md py-sm">
                <Badge variant={badge.variant}>{badge.label}</Badge>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
