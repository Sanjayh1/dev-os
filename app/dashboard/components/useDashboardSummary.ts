'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

// Spec: docs/specs/dashboard.md
// No API route — direct Supabase client SDK reads, RLS-scoped.

export interface RecentContract {
  id: string
  file_name: string
  contract_type: 'NDA' | 'MSA'
  status: string
  created_at: string
}

export interface DashboardSummary {
  total: number
  ndaCount: number
  msaCount: number
  recent: RecentContract[]
}

async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const supabase = createClient()

  const [totalResult, ndaResult, msaResult, recentResult] = await Promise.all([
    supabase.from('contracts').select('*', { count: 'exact', head: true }),
    supabase.from('contracts').select('*', { count: 'exact', head: true }).eq('contract_type', 'NDA'),
    supabase.from('contracts').select('*', { count: 'exact', head: true }).eq('contract_type', 'MSA'),
    supabase
      .from('contracts')
      .select('id, file_name, contract_type, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  if (recentResult.error) throw new Error(recentResult.error.message)

  return {
    total: totalResult.count ?? 0,
    ndaCount: ndaResult.count ?? 0,
    msaCount: msaResult.count ?? 0,
    recent: (recentResult.data ?? []) as RecentContract[],
  }
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: fetchDashboardSummary,
  })
}
