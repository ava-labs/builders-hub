import { withAuth } from '@/lib/protectedRoute'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Proxies Google Forms API `forms.get` using the caller's OAuth access token.
 *
 * Setup (Google Cloud Console):
 * - Enable "Google Forms API" for the OAuth client project.
 * - Add OAuth scope: https://www.googleapis.com/auth/forms.body.readonly
 * - Browser: set NEXT_PUBLIC_GOOGLE_CLIENT_ID to the same Web client ID as GOOGLE_CLIENT_ID
 *   and add this app's origin under "Authorized JavaScript origins" (required for GIS token flow).
 */
const FORM_ID_PATTERN = /^[a-zA-Z0-9_-]+$/

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = (await request.json()) as {
      formId?: string
      accessToken?: string
    }

    const rawId = typeof body.formId === 'string' ? body.formId.trim() : ''
    const accessToken =
      typeof body.accessToken === 'string' ? body.accessToken.trim() : ''

    if (!rawId || !accessToken) {
      return NextResponse.json(
        { error: 'formId and accessToken are required' },
        { status: 400 }
      )
    }

    const formId = extractFormId(rawId)
    if (!formId || !FORM_ID_PATTERN.test(formId)) {
      return NextResponse.json(
        { error: 'Invalid form ID. Use the ID from the form URL or paste the full URL.' },
        { status: 400 }
      )
    }

    const url = `https://forms.googleapis.com/v1/forms/${encodeURIComponent(formId)}`
    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })

    const payload: unknown = await upstream.json().catch(() => ({}))

    if (!upstream.ok) {
      const message = mapFormsApiError(upstream.status, payload)
      return NextResponse.json({ error: message }, { status: upstream.status })
    }

    return NextResponse.json(payload)
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }
})

function extractFormId(input: string): string {
  const fromUrl = input.match(/\/forms\/d\/([a-zA-Z0-9_-]+)/)
  if (fromUrl?.[1]) {
    return fromUrl[1]
  }
  return input
}

function mapFormsApiError(status: number, payload: unknown): string {
  if (status === 401) {
    return 'Google rejected the access token. Sign in again and retry.'
  }
  if (status === 403) {
    return 'You do not have permission to read this form, or the Forms API scope was not granted.'
  }
  if (status === 404) {
    return 'Form not found. Check the form ID and that the form exists.'
  }
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const err = (payload as { error?: { message?: string } }).error
    if (err?.message) {
      return err.message
    }
  }
  return 'Failed to load the form from Google.'
}
