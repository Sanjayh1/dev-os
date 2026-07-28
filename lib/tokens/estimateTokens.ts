// Spec: docs/specs/upload-extraction.md — "tiktoken-compatible estimate"
// No tokenizer dependency is installed; ~4 chars/token is the standard
// approximation for English prose and keeps this dependency-free.
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4)
}
