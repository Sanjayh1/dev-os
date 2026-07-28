'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { RecentContract } from './useDashboardSummary'

// Spec: docs/specs/dashboard.md
// No API route — direct Supabase client SDK reads, RLS-scoped. Query key
// includes sort state so changing it re-fetches.

export type HistorySortColumn = 'created_at' | 'file_name' | 'contract_type'
export type HistorySortDirection = 'asc' | 'desc'

async function fetchContractHistory(
  sortColumn: HistorySortColumn,
  sortDirection: HistorySortDirection
): Promise<RecentContract[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('contracts')
    .select('id, file_name, contract_type, status, created_at')
    .order(sortColumn, { ascending: sortDirection === 'asc' })

  if (error) throw new Error(error.message)
  return (data ?? []) as RecentContract[]
}

export function useContractHistory(sortColumn: HistorySortColumn, sortDirection: HistorySortDirection) {
  return useQuery({
    queryKey: ['contract-history', sortColumn, sortDirection],
    queryFn: () => fetchContractHistory(sortColumn, sortDirection),
  })
}
