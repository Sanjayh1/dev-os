'use client'

import { useState } from 'react'
import { Disclaimer } from '@/components/ui/Disclaimer'
import { ContractViewerPanel } from './components/ContractViewerPanel'
import { KeyTermsPanel } from './components/KeyTermsPanel'
import { ChatPanel } from './components/ChatPanel'
import { FeedbackWidget } from './components/FeedbackWidget'
import { useContractResults } from './components/useContractResults'

export default function ContractResultsPage({ params }: { params: { id: string } }) {
  const { data, isLoading, isError, error, refetch } = useContractResults(params.id)
  const [targetPage, setTargetPage] = useState<number | null>(null)

  if (isLoading) {
    return (
      <main className="min-h-screen bg-bg-subtle px-lg py-lg">
        <p className="text-body text-text-secondary">Loading contract…</p>
      </main>
    )
  }

  if (isError || !data) {
    return (
      <main className="min-h-screen bg-bg-subtle px-lg py-lg">
        <p className="text-body text-error">
          {error instanceof Error ? error.message : 'Failed to load this contract.'}
        </p>
      </main>
    )
  }

  if (data.contract.status !== 'completed') {
    return (
      <main className="min-h-screen bg-bg-subtle px-lg py-lg">
        <h1 className="text-h1 text-text-primary">
          {data.contract.status === 'error' ? 'Processing failed' : 'Still processing'}
        </h1>
        <p className="mt-xs text-body text-text-secondary">
          {data.contract.status === 'error'
            ? 'Key term extraction failed for this contract. Try processing it again from the upload screen.'
            : 'This contract is still being processed. Refresh in a moment.'}
        </p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-bg-subtle px-lg py-lg">
      <h1 className="text-h1 text-text-primary">{data.contract.file_name}</h1>
      <div className="mt-md">
        <Disclaimer />
      </div>
      <div className="mt-lg grid grid-cols-1 gap-md md:h-[75vh] md:grid-cols-2">
        <ContractViewerPanel
          signedUrl={data.signed_url}
          contractText={data.contract.contract_text ?? ''}
          targetPage={targetPage}
          onRefreshSignedUrl={() => refetch()}
        />
        <KeyTermsPanel keyTerms={data.key_terms} contractId={params.id} onPageClick={setTargetPage} />
      </div>
      <div className="mt-lg">
        <FeedbackWidget contractId={params.id} />
      </div>
      <ChatPanel contractId={params.id} onCitationClick={setTargetPage} />
    </main>
  )
}
