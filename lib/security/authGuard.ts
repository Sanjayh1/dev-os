import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api/errors'

// Replaces the auth.getUser() + 401 boilerplate repeated at the top of every
// route with a single call: `const { user, supabase, response } =
// await requireAuth(); if (response) return response`.
export async function requireAuth() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      user: null as null,
      supabase,
      response: apiError(401, 'unauthorized', 'You must be signed in to do this.'),
    }
  }

  return { user, supabase, response: null as null }
}
