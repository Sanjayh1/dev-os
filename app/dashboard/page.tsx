'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { SummaryCard } from './components/SummaryCard'
import { ContractHistoryTable } from './components/ContractHistoryTable'
import { useDashboardSummary } from './components/useDashboardSummary'
import { useContractHistory, type HistorySortColumn, type HistorySortDirection } from './components/useContractHistory'

export default function DashboardPage() {
  const router = useRouter()
  const [sortColumn, setSortColumn] = useState<HistorySortColumn>('created_at')
  const [sortDirection, setSortDirection] = useState<HistorySortDirection>('desc')

  const summary = useDashboardSummary()
  const history = useContractHistory(sortColumn, sortDirection)

  function handleSortChange(column: HistorySortColumn) {
    if (column === sortColumn) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-bg-subtle px-lg py-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 text-text-primary">Dashboard</h1>
        <div className="flex items-center gap-sm">
          <Link href="/contracts/new">
            <Button>Review a Contract</Button>
          </Link>
          <Button variant="ghost" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </div>

      {summary.isLoading ? (
        <p className="mt-lg text-body text-text-secondary">Loading…</p>
      ) : summary.isError ? (
        <p className="mt-lg text-body text-error">
          {summary.error instanceof Error ? summary.error.message : 'Failed to load dashboard.'}
        </p>
      ) : summary.data && summary.data.total === 0 ? (
        <p className="mt-lg text-body text-text-secondary">
          No contracts reviewed yet — upload your first contract to begin.
        </p>
      ) : (
        summary.data && (
          <>
            <div className="mt-lg">
              <SummaryCard
                total={summary.data.total}
                ndaCount={summary.data.ndaCount}
                msaCount={summary.data.msaCount}
                recent={summary.data.recent}
              />
            </div>

            <div className="mt-lg overflow-x-auto rounded-card border border-border bg-white">
              {history.isLoading ? (
                <p className="p-md text-body text-text-secondary">Loading history…</p>
              ) : history.isError ? (
                <p className="p-md text-body text-error">
                  {history.error instanceof Error ? history.error.message : 'Failed to load history.'}
                </p>
              ) : (
                <ContractHistoryTable
                  contracts={history.data ?? []}
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSortChange={handleSortChange}
                />
              )}
            </div>
          </>
        )
      )}
    </main>
  )
}
