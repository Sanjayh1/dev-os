import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockSupabaseClient } from '@/test/helpers/supabaseMock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/pdf/extractText', () => ({ extractText: vi.fn() }))
vi.mock('@/lib/security/rateLimiter', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
  rateLimitedResponse: vi.fn((retryAfterSeconds: number) => {
    const res = NextResponse.json({ error: { code: 'rate_limited', message: 'slow down' } }, { status: 429 })
    res.headers.set('Retry-After', String(retryAfterSeconds))
    return res
  }),
}))

import { createClient } from '@/lib/supabase/server'
import { extractText } from '@/lib/pdf/extractText'
import { checkRateLimit } from '@/lib/security/rateLimiter'
import { POST } from './route'

const mockedCreateClient = vi.mocked(createClient)
const mockedExtractText = vi.mocked(extractText)
const mockedCheckRateLimit = vi.mocked(checkRateLimit)

function buildRequest(file: File | null, contractType: string | null) {
  const formData = new FormData()
  if (file) formData.append('file', file)
  if (contractType) formData.append('contract_type', contractType)
  return new NextRequest('http://localhost/api/contracts/upload', { method: 'POST', body: formData })
}

function pdfFile(name = 'contract.pdf', size = 1024) {
  return new File([new Uint8Array(size)], name, { type: 'application/pdf' })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/contracts/upload', () => {
  it('returns 401 when there is no session', async () => {
    mockedCreateClient.mockReturnValue(createMockSupabaseClient({ user: null }) as never)

    const response = await POST(buildRequest(pdfFile(), 'NDA'))
    expect(response.status).toBe(401)
  })

  it('returns 400 for a non-PDF file', async () => {
    mockedCreateClient.mockReturnValue(createMockSupabaseClient({ user: { id: 'u1' } }) as never)
    const notPdf = new File(['hello'], 'notes.txt', { type: 'text/plain' })

    const response = await POST(buildRequest(notPdf, 'NDA'))
    const body = await response.json()
    expect(response.status).toBe(400)
    expect(body.error.code).toBe('invalid_file_type')
  })

  it('returns 400 for a file over 10MB', async () => {
    mockedCreateClient.mockReturnValue(createMockSupabaseClient({ user: { id: 'u1' } }) as never)
    const tooBig = pdfFile('big.pdf', 11 * 1024 * 1024)

    const response = await POST(buildRequest(tooBig, 'NDA'))
    const body = await response.json()
    expect(response.status).toBe(400)
    expect(body.error.code).toBe('file_too_large')
  })

  it('returns 400 for an invalid contract_type', async () => {
    mockedCreateClient.mockReturnValue(createMockSupabaseClient({ user: { id: 'u1' } }) as never)

    const response = await POST(buildRequest(pdfFile(), 'LEASE'))
    const body = await response.json()
    expect(response.status).toBe(400)
    expect(body.error.code).toBe('invalid_contract_type')
  })

  it('returns 400 blocked_extension for a disguised executable', async () => {
    mockedCreateClient.mockReturnValue(createMockSupabaseClient({ user: { id: 'u1' } }) as never)
    const disguised = new File([new Uint8Array(10)], 'invoice.pdf.exe', { type: 'application/pdf' })

    const response = await POST(buildRequest(disguised, 'NDA'))
    const body = await response.json()
    expect(response.status).toBe(400)
    expect(body.error.code).toBe('blocked_extension')
  })

  it('returns 429 when the upload rate limit is exceeded', async () => {
    mockedCreateClient.mockReturnValue(createMockSupabaseClient({ user: { id: 'u1' } }) as never)
    mockedCheckRateLimit.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 3600 })

    const response = await POST(buildRequest(pdfFile(), 'NDA'))
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('3600')
  })

  it('returns 400 scanned_pdf_unsupported when word count is too low', async () => {
    mockedCreateClient.mockReturnValue(createMockSupabaseClient({ user: { id: 'u1' } }) as never)
    mockedExtractText.mockResolvedValue({ text: '[PAGE 1]\nhi', pageCount: 1, wordCount: 2 })

    const response = await POST(buildRequest(pdfFile(), 'NDA'))
    const body = await response.json()
    expect(response.status).toBe(400)
    expect(body.error.code).toBe('scanned_pdf_unsupported')
  })

  it('returns 400 too_many_pages when the PDF exceeds 20 pages', async () => {
    mockedCreateClient.mockReturnValue(createMockSupabaseClient({ user: { id: 'u1' } }) as never)
    mockedExtractText.mockResolvedValue({
      text: '[PAGE 1]\n' + 'word '.repeat(200),
      pageCount: 25,
      wordCount: 200,
    })

    const response = await POST(buildRequest(pdfFile(), 'NDA'))
    const body = await response.json()
    expect(response.status).toBe(400)
    expect(body.error.code).toBe('too_many_pages')
  })

  it('returns 400 token_limit_exceeded when the estimated tokens exceed 15000', async () => {
    mockedCreateClient.mockReturnValue(createMockSupabaseClient({ user: { id: 'u1' } }) as never)
    mockedExtractText.mockResolvedValue({
      text: 'x'.repeat(15000 * 4 + 100),
      pageCount: 5,
      wordCount: 500,
    })

    const response = await POST(buildRequest(pdfFile(), 'NDA'))
    const body = await response.json()
    expect(response.status).toBe(400)
    expect(body.error.code).toBe('token_limit_exceeded')
  })

  it('returns 500 pdf_read_failed when extraction throws', async () => {
    mockedCreateClient.mockReturnValue(createMockSupabaseClient({ user: { id: 'u1' } }) as never)
    mockedExtractText.mockRejectedValue(new Error('corrupt pdf'))

    const response = await POST(buildRequest(pdfFile(), 'NDA'))
    const body = await response.json()
    expect(response.status).toBe(500)
    expect(body.error.code).toBe('pdf_read_failed')
  })

  it('creates the contract row and returns 201 on success, even if Storage upload fails', async () => {
    mockedCreateClient.mockReturnValue(
      createMockSupabaseClient({
        user: { id: 'u1' },
        tableResults: { contracts: { data: null, error: null } },
        storageUpload: { data: null, error: { message: 'bucket unreachable' } },
      }) as never
    )
    mockedExtractText.mockResolvedValue({
      text: '[PAGE 1]\n' + 'word '.repeat(200),
      pageCount: 3,
      wordCount: 200,
    })

    const response = await POST(buildRequest(pdfFile(), 'NDA'))
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.contract_id).toBeTruthy()
    expect(body.page_count).toBe(3)
    expect(body.standard_terms_preview).toContain('Governing Law')
  })
})
