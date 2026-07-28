export type ChatRole = 'user' | 'assistant'

export interface ChatSession {
  id: string
  contract_id: string
  user_id: string
  created_at: string
}

export interface ChatMessage {
  id: string
  session_id: string
  user_id: string
  role: ChatRole
  content: string
  created_at: string
}
