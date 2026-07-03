import { withAuth } from '@/lib/protectedRoute'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Proxies Google Forms API `forms.get` using the caller's server-side session.
 *
 * SECURITY: This route no longer accepts an `accessToken` from the client.
 * The client is responsible for calling the Google Forms API directly from the
 * browser using its own OAuth token (obtained via GIS).  This route exists as
 * a fallback proxy only; the `accessToken` field is explicitly rejected to
 * prevent token forwarding / exposure in server logs.
 *
 * Setup (Google Cloud Console):
 * - Enable "Google Forms API" for the OAuth client project.
 * - Add OAuth scope: https://www.googleapis.com/auth/forms.body.readonly
 * - Browser: set NEXT_PUBLIC_GOOGLE_CLIENT_ID to the same Web client ID as GOOGLE_CLIENT_ID
 *   and add this app's origin under "Authorized JavaScript origins" (required for GIS token flow).
 */
const FORM_ID_PATTERN = /^[a-zA-Z0-9_-]+$/

export const POST = withAuth(async (request: NextRequest, _context, session) => {

  const isDevrel = session?.user.custom_attributes?.includes("devrel") ?? false;
  const isHackathonCreator = session?.user.custom_attributes?.includes("hackathonCreator") ?? false;

  if (!isDevrel && !isHackathonCreator) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      formId?: string
      accessToken?: unknown
    }

    /**
     * SECURITY: Reject any request that includes an `accessToken` field.
     * Clients must call the Google Forms API directly from the browser.
     * Accepting tokens from the client body would expose them in logs.
     */
    if ('accessToken' in body) {
      return NextResponse.json(
        { error: 'accessToken must not be sent to this endpoint. Call the Google Forms API directly from the browser.' },
        { status: 400 }
      )
    }

    const rawId = typeof body.formId === 'string' ? body.formId.trim() : ''

    if (!rawId) {
      return NextResponse.json(
        { error: 'formId is required' },
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

    /**
     * SECURITY: This route no longer acts as a proxy to the Google Forms API.
     * Clients must call https://forms.googleapis.com/v1/forms/{formId} directly
     * from the browser using their own OAuth access token.  Doing so keeps the
     * token entirely client-side and out of server logs.
     *
     * Return 410 Gone so that any legacy callers get an explicit signal that
     * the proxy behaviour has been intentionally removed.
     */
    return NextResponse.json(
      { error: 'This proxy endpoint has been removed. Call the Google Forms API directly from the browser.' },
      { status: 410 }
    )
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
