// Fake OpenAI client for E2E runs. Used only by key-term extraction
// (app/api/contracts/[id]/process) — chat now calls the Azure agent via
// lib/azure.ts / lib/testing/fakeAzureClient.ts instead.

interface FakeChatMessage {
  role: string
  content: string
}

interface FakeCompletionParams {
  response_format?: { type: string }
  messages: FakeChatMessage[]
}

function fakeExtractionContent(): string {
  return JSON.stringify({
    terms: [
      {
        term_name: 'Effective Date',
        value: 'January 1, 2024',
        page_number: 1,
        confidence_score: 96.5,
        source_sentence: 'This Agreement is effective as of January 1, 2024.',
        is_custom: false,
      },
      {
        term_name: 'Governing Law',
        value: 'State of Delaware',
        page_number: 1,
        confidence_score: 92.0,
        source_sentence: 'This Agreement shall be governed by the laws of the State of Delaware.',
        is_custom: false,
      },
    ],
  })
}

export function createFakeOpenAIClient() {
  return {
    chat: {
      completions: {
        async create(_params: FakeCompletionParams) {
          return { choices: [{ message: { content: fakeExtractionContent() } }] }
        },
      },
    },
  }
}
