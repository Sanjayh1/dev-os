import OpenAI from 'openai'
import { createFakeAzureClient } from '@/lib/testing/fakeAzureClient'

// SERVER ONLY — never import this module from a Client Component.
// E2E runs swap in an in-memory fake (lib/testing/fakeAzureClient.ts) so
// Playwright can drive real flows without any real Azure network calls.

// As of mid-2025 this was the working api-version for the agent responses
// endpoint. Preview versions rotate — if requests start failing with "API
// version not supported", check the Azure AI Foundry REST API reference for
// the current value and update this constant.
const AZURE_API_VERSION = '2025-05-15-preview'

// The AZURE_AGENT_ENDPOINT copied from the portal already ends with
// /responses — the SDK appends that itself when calling responses.create(),
// so it must be stripped here or every request doubles the path (405).
function toBaseURL(endpoint: string): string {
  return endpoint.replace(/\/responses\/?$/, '')
}

export const azure: OpenAI =
  process.env.NEXT_PUBLIC_E2E_MOCK_BACKEND === '1'
    ? (createFakeAzureClient() as unknown as OpenAI)
    : new OpenAI({
        apiKey: process.env.AZURE_API_KEY,
        baseURL: toBaseURL(process.env.AZURE_AGENT_ENDPOINT ?? ''),
        defaultQuery: { 'api-version': AZURE_API_VERSION },
        defaultHeaders: { 'api-key': process.env.AZURE_API_KEY ?? '' },
      })
