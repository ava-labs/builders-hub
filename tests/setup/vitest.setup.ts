/**
 * Vitest Setup File
 *
 * This file runs before all tests to configure the testing environment.
 * It sets up:
 * - jest-dom matchers for DOM assertions
 * - Automatic cleanup after each test
 * - Mock globals for browser APIs not available in jsdom
 * - Mock wallet providers for testing wallet-dependent code
 */

import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi, beforeAll } from 'vitest'

// Cleanup after each test to prevent state leakage
afterEach(() => {
  cleanup()
})

// Mock window.matchMedia (not available in jsdom)
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

// Mock window.ethereum for wallet tests
vi.stubGlobal('ethereum', {
  isMetaMask: false,
  isCoreWallet: false,
  isConnected: vi.fn(() => false),
  request: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
  selectedAddress: null,
  chainId: null,
})

// Mock window.avalanche for Core Wallet tests
vi.stubGlobal('avalanche', {
  isAvalanche: true,
  isCoreWallet: true,
  isConnected: vi.fn(() => false),
  request: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
  selectedAddress: null,
  chainId: null,
})

// Mock ResizeObserver (not available in jsdom)
vi.stubGlobal('ResizeObserver', class ResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
})

// Mock IntersectionObserver (not available in jsdom)
vi.stubGlobal('IntersectionObserver', class IntersectionObserver {
  constructor(
    public callback: IntersectionObserverCallback,
    public options?: IntersectionObserverInit
  ) {}
  root = null
  rootMargin = ''
  thresholds = []
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  takeRecords = vi.fn(() => [])
})

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/test',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) => {
    // eslint-disable-next-line @next/next/no-img-element
    return `<img src="${src}" alt="${alt}" />`
  },
}))

// Suppress console errors during tests (optional - comment out for debugging)
// vi.spyOn(console, 'error').mockImplementation(() => {})
// vi.spyOn(console, 'warn').mockImplementation(() => {})
