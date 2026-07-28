import { NextResponse } from 'next/server'

export interface ApiErrorBody {
  error: {
    code: string
    message: string
  }
}

export function apiError(status: number, code: string, message: string) {
  return NextResponse.json<ApiErrorBody>({ error: { code, message } }, { status })
}

export function notImplemented(routeName: string) {
  return apiError(501, 'not_implemented', `${routeName} is scaffolded but not yet implemented (Stage 4).`)
}
