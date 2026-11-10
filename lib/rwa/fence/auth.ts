// Server-only: OAuth2 token manager for Fence Finance API
// Do NOT import this file from client components

import { FENCE_AUTH_TIMEOUT_MS } from '../constants/fence'

interface TokenState {
  accessToken: string
  expiresAt: number
}

class FenceTokenManager {
  private state: TokenState | null = null
  private refreshPromise: Promise<string> | null = null

  private getConfig() {
    const apiUrl = process.env.FENCE_API_URL
    const clientId = process.env.FENCE_CLIENT_ID
    const clientSecret = process.env.FENCE_CLIENT_SECRET

    if (!apiUrl || !clientId || !clientSecret) {
      throw new Error(
        'Fence API credentials not configured. Set FENCE_API_URL, FENCE_CLIENT_ID, and FENCE_CLIENT_SECRET environment variables.'
      )
    }

    return { apiUrl, clientId, clientSecret }
  }

  private isValid(): boolean {
    if (!this.state) return false
    return Date.now() < this.state.expiresAt - 60_000
  }

  private async fetchNewToken(): Promise<string> {
    const { apiUrl, clientId, clientSecret } = this.getConfig()

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    })

    const response = await fetch(`${apiUrl}/v1/login/access-token`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
      signal: AbortSignal.timeout(FENCE_AUTH_TIMEOUT_MS),
    })

    if (!response.ok) {
      throw new Error(`Fence auth failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const { access_token, expires_in } = data as {
      access_token: string
      expires_in: number
    }

    this.state = {
      accessToken: access_token,
      expiresAt: Date.now() + expires_in * 1000,
    }

    return access_token
  }

  async getToken(): Promise<string> {
    if (this.isValid()) {
      return this.state!.accessToken
    }

    if (this.refreshPromise) {
      return this.refreshPromise
    }

    this.refreshPromise = this.fetchNewToken().finally(() => {
      this.refreshPromise = null
    })

    return this.refreshPromise
  }

  invalidate(): void {
    this.state = null
  }
}

const globalAuth = globalThis as unknown as { __fenceAuth?: FenceTokenManager }
if (!globalAuth.__fenceAuth) {
  globalAuth.__fenceAuth = new FenceTokenManager()
}
export const fenceAuth: FenceTokenManager = globalAuth.__fenceAuth
