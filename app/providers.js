'use client'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'

if (typeof window !== 'undefined') {
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST
  
  if (posthogKey) {
    const consent = localStorage.getItem('cookie_consent')
    posthog.init(posthogKey, {
      api_host: posthogHost || 'https://app.posthog.com',
      persistence: consent === 'yes' ? 'localStorage+cookie' : 'memory',
      enable_heatmaps: true,
      capture_exceptions: true,
      // the project's remote config records canvases; its snapshots read each 2D canvas back
      // pixel by pixel, and Chrome warns about those readbacks on every page that draws one
      session_recording: { captureCanvas: { recordCanvas: false } },
    })
  }
}

export function PHProvider({ children }) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return children
  }
  
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>
}