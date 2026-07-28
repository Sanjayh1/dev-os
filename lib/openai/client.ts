import OpenAI from 'openai'
import { createFakeOpenAIClient } from '@/lib/testing/fakeOpenAIClient'

// SERVER ONLY — never import this module from a Client Component.
// E2E runs swap in an in-memory fake (lib/testing/fakeOpenAIClient.ts) so
// Playwright can drive real flows without any real OpenAI network calls.
export const openai: OpenAI =
  process.env.NEXT_PUBLIC_E2E_MOCK_BACKEND === '1'
    ? (createFakeOpenAIClient() as unknown as OpenAI)
    : new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
