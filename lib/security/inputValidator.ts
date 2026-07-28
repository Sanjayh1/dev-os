import { z } from 'zod'
import { MAX_MESSAGE_LENGTH, isFileSizeAllowed } from './tokenLimiter'

// Zod schemas for every API route's request body, backing validation for
// both the new auth routes (which return the skill's 422 VALIDATION_ERROR
// convention directly — see validateOrRespond in each route) and the
// existing feature routes (which run requests through these same schemas
// but keep their own already-documented, already-tested error codes/statuses
// rather than switching to 422 — changing those would break the contracts
// in docs/specs/*.md and the existing test suite for no security benefit;
// what matters is that every field is actually schema-validated, not which
// JSON shape reports the failure).

export const contractTypeSchema = z.enum(['NDA', 'MSA'])

export const uploadBodySchema = z.object({
  contract_type: contractTypeSchema,
})

export const customTermsBodySchema = z.object({
  terms: z.array(z.string()).max(5),
})

export const keyTermPatchBodySchema = z.object({
  value: z.string(),
})

export const chatMessageBodySchema = z.object({
  message: z.string().max(MAX_MESSAGE_LENGTH),
})

export const feedbackBodySchema = z.object({
  contract_id: z.string().uuid(),
  rating: z.enum(['up', 'down']),
  comment: z.string().max(1000).optional(),
})

// Signup enforces the password policy (matches lib/validation/auth.ts's
// isValidPassword — min 8 chars); login deliberately does not — rejecting a
// login attempt because a real, already-set password happens to be short
// would lock someone out of their own account for a policy that didn't
// necessarily exist when they created it. Supabase Auth is the source of
// truth for whether a login's credentials are actually correct.
export const signupCredentialsSchema = z.object({
  email: z.string().trim().min(1).email(),
  password: z.string().min(8),
})

export const loginCredentialsSchema = z.object({
  email: z.string().trim().min(1).email(),
  password: z.string().min(1),
})

export interface ValidationResult<T> {
  success: boolean
  data?: T
  error?: string
}

export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): ValidationResult<T> {
  const result = schema.safeParse(body)
  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message ?? 'Invalid request body' }
  }
  return { success: true, data: result.data }
}

// --- File upload validation ---
// Order: extension blocklist -> extension/MIME allowlist -> size. PDF is the
// only format actually supported by the extraction pipeline (lib/pdf/extractText.ts
// uses pdfjs-dist directly) — .docx is intentionally not accepted even though
// the security-foundation skill template lists it, since accepting it would
// pass validation and then fail unreadably downstream. See
// docs/security/security-plan.md.

const BLOCKED_EXTENSIONS = ['.exe', '.js', '.mjs', '.cjs', '.php', '.zip', '.sh', '.bat', '.cmd', '.py', '.rb', '.ps1']
const ALLOWED_EXTENSIONS = ['.pdf']
const ALLOWED_MIME_TYPES = ['application/pdf']

export interface FileValidationResult {
  valid: boolean
  code?: 'blocked_extension' | 'invalid_file_type' | 'file_too_large'
  message?: string
}

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.')
  return idx === -1 ? '' : filename.slice(idx).toLowerCase()
}

export function validateFileUpload(file: { name: string; type: string; size: number }): FileValidationResult {
  const extension = getExtension(file.name)

  if (BLOCKED_EXTENSIONS.includes(extension)) {
    return { valid: false, code: 'blocked_extension', message: 'This file type is not allowed.' }
  }
  if (!ALLOWED_EXTENSIONS.includes(extension) || !ALLOWED_MIME_TYPES.includes(file.type)) {
    return { valid: false, code: 'invalid_file_type', message: 'Only PDF files are supported.' }
  }
  if (!isFileSizeAllowed(file.size)) {
    return { valid: false, code: 'file_too_large', message: 'File exceeds the 10MB limit.' }
  }
  return { valid: true }
}
