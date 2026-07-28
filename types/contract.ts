export type ContractType = 'NDA' | 'MSA'
export type ContractStatus = 'uploaded' | 'processing' | 'completed' | 'error'

export interface Contract {
  id: string
  user_id: string
  contract_type: ContractType
  file_name: string
  file_path: string | null
  contract_text: string | null
  page_count: number | null
  token_count: number | null
  status: ContractStatus
  error_message: string | null
  created_at: string
  last_accessed_at: string
}
