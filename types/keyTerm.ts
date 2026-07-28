export interface KeyTerm {
  id: string
  contract_id: string
  user_id: string
  term_name: string
  value: string | null
  original_ai_value: string | null
  page_number: number | null
  confidence_score: number
  source_sentence: string | null
  is_custom: boolean
  is_edited: boolean
  created_at: string
}

export interface CustomKeyTerm {
  id: string
  contract_id: string
  user_id: string
  term_name: string
  is_manual: boolean
  created_at: string
}
