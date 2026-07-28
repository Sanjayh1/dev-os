// Fake OpenAI client for E2E runs. Distinguishes the extraction call from
// the chat call the same way the real API does: extraction always sets
// response_format: { type: 'json_object' }, chat never does.

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

// Kept free of the raw user message: it can contain arbitrary punctuation
// (periods) that would confuse ChatMessage's "Based on the document…" prefix
// split, which looks for the first period to end the lead-in.
function fakeChatContent(): string {
  return 'Based on the document, this is a fake E2E test response. [Page 1]'
}

export function createFakeOpenAIClient() {
  return {
    chat: {
      completions: {
        async create(params: FakeCompletionParams) {
          if (params.response_format?.type === 'json_object') {
            return { choices: [{ message: { content: fakeExtractionContent() } }] }
          }
          return { choices: [{ message: { content: fakeChatContent() } }] }
        },
      },
    },
  }
}
