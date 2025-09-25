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
      enable_heatmaps: true
    })
  } else {
    console.warn('PostHog key not found in environment variables')
  }
}

export function PHProvider({ children }) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return children
  }
  
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>
}