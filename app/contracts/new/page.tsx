'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { ContractTypeSelector, type ContractType } from './components/ContractTypeSelector'
import { UploadDropzone } from './components/UploadDropzone'
import { KeyTermPreviewList } from './components/KeyTermPreviewList'
import { CustomTermInput } from './components/CustomTermInput'
import { useUploadContract } from './components/useUploadContract'
import { useAddCustomTerms } from './components/useAddCustomTerms'
import { ProcessingProgress } from './components/ProcessingProgress'
import { useProcessContract } from './components/useProcessContract'

const MAX_CUSTOM_TERMS = 5

export default function NewContractPage() {
  const router = useRouter()
  const [contractType, setContractType] = useState<ContractType>('NDA')
  const [file, setFile] = useState<File | null>(null)
  const [customTerms, setCustomTerms] = useState<string[]>([])
  const [customTermError, setCustomTermError] = useState<string | null>(null)
  const [customTermsSubmitted, setCustomTermsSubmitted] = useState(false)

  const upload = useUploadContract()
  const addCustomTerms = useAddCustomTerms()
  const process = useProcessContract()

  function handleSubmit() {
    if (!file) return
    upload.mutate({ file, contractType })
  }

  function handleAddCustomTerm(term: string) {
    if (customTerms.length >= MAX_CUSTOM_TERMS) {
      setCustomTermError('Maximum 5 custom terms')
      return
    }
    if (customTerms.some((t) => t.toLowerCase() === term.toLowerCase())) {
      setCustomTermError('This term has already been added')
      return
    }
    setCustomTermError(null)
    setCustomTerms((prev) => [...prev, term])
  }

  function handleRemoveCustomTerm(term: string) {
    setCustomTerms((prev) => prev.filter((t) => t !== term))
    setCustomTermError(null)
  }

  async function handleProcess() {
    if (!upload.data) return
    const contractId = upload.data.contract_id

    if (!customTermsSubmitted && customTerms.length > 0) {
      try {
        await addCustomTerms.mutateAsync({ contractId, terms: customTerms })
      } catch {
        return
      }
    }
    setCustomTermsSubmitted(true)

    process.mutate(contractId, {
      onSuccess: () => router.push(`/contracts/${contractId}/results`),
    })
  }

  if (upload.data) {
    const isProcessing = process.status !== 'idle'

    return (
      <main className="min-h-screen bg-bg-subtle px-lg py-lg">
        <h1 className="text-h1 text-text-primary">Standard terms for this {contractType}</h1>
        <p className="mt-xs text-body text-text-secondary">
          These will be extracted once processing starts. You can add up to 5 custom terms below.
        </p>
        <div className="mt-lg flex max-w-md flex-col gap-md">
          <KeyTermPreviewList
            standardTerms={upload.data.standard_terms_preview}
            customTerms={customTerms}
            onRemoveCustomTerm={handleRemoveCustomTerm}
          />

          {!isProcessing && (
            <CustomTermInput
              count={customTerms.length}
              onAdd={handleAddCustomTerm}
              error={customTermError}
            />
          )}

          {isProcessing ? (
            <ProcessingProgress
              state={process.isPending ? 'pending' : process.isError ? 'error' : 'success'}
              errorMessage={process.error instanceof Error ? process.error.message : null}
              onRetry={handleProcess}
            />
          ) : (
            <>
              {addCustomTerms.isError && (
                <p className="text-small text-error">
                  {addCustomTerms.error instanceof Error
                    ? addCustomTerms.error.message
                    : 'Failed to save custom terms.'}
                </p>
              )}
              <Button onClick={handleProcess} disabled={addCustomTerms.isPending}>
                {addCustomTerms.isPending ? 'Saving terms…' : 'Process Contract'}
              </Button>
            </>
          )}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-bg-subtle px-lg py-lg">
      <h1 className="text-h1 text-text-primary">Review a contract</h1>
      <p className="mt-xs text-body text-text-secondary">
        Upload a PDF (NDA or MSA, up to 20 pages) to extract its key terms.
      </p>

      <div className="mt-lg flex max-w-md flex-col gap-md">
        <ContractTypeSelector value={contractType} onChange={setContractType} />
        <UploadDropzone
          file={file}
          onSelect={setFile}
          error={upload.error instanceof Error ? upload.error.message : null}
        />
        <Button onClick={handleSubmit} disabled={!file || upload.isPending}>
          {upload.isPending ? 'Uploading…' : 'Upload'}
        </Button>
      </div>
    </main>
  )
}
