// Fake Storage bucket for E2E runs. Upload always reports unavailable —
// this keeps E2E fully offline (no real signed URL for PdfViewer to fetch
// over the network) and exercises the TextViewer fallback path, which the
// spec treats as first-class, not degraded (see docs/specs/results-display.md).

export function fakeStorageFrom(_bucket: string) {
  return {
    async upload() {
      return { data: null, error: { message: 'Storage not available in E2E fake mode' } }
    },
    async createSignedUrl() {
      return { data: null, error: { message: 'Object not found' } }
    },
    async remove() {
      return { data: {}, error: null }
    },
  }
}
