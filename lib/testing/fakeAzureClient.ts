// Fake Azure AI Foundry agent client for E2E runs. Mirrors the shape of the
// real client's responses.create() call (lib/azure.ts) closely enough that
// the chat route doesn't need to know it's talking to a fake.

interface FakeResponsesCreateParams {
  input: Array<{ role: string; content: string }>
}

// Matches the fixed page/citation content e2e/inline-edit-and-chat.spec.ts
// asserts on — keep in sync if that spec changes.
function fakeChatContent(): string {
  return 'Based on the document, this is a fake E2E test response. [Page 1]'
}

export function createFakeAzureClient() {
  return {
    responses: {
      async create(_params: FakeResponsesCreateParams) {
        return { output_text: fakeChatContent() }
      },
    },
  }
}
