import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    // Enable global test APIs (describe, it, expect)
    globals: true,

    // Use jsdom for DOM testing
    environment: 'jsdom',

    // Setup files to run before tests
    setupFiles: ['./tests/setup/vitest.setup.ts'],

    // Test file patterns
    include: [
      'components/**/*.test.{ts,tsx}',
      'utils/**/*.test.{ts,tsx}',
      'tests/unit/**/*.test.{ts,tsx}',
      'tests/docs/**/*.test.{ts,tsx}',
      'tests/api/**/*.test.{ts,tsx}',
    ],

    // Exclude patterns
    exclude: [
      '**/node_modules/**',
      '**/tests/e2e/**',
      '**/*.spec.ts', // Playwright uses .spec.ts
    ],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'components/toolbox/**/*.{ts,tsx}',
        'utils/**/*.{ts,tsx}',
      ],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
        '**/index.ts',
      ],
      thresholds: {
        statements: 50,
        branches: 50,
        functions: 50,
        lines: 50,
      },
    },

    // Reporter configuration
    reporters: ['verbose'],

    // Timeout for tests
    testTimeout: 10000,

    // Pool configuration for performance
    pool: 'forks',

    // Retry failed tests once
    retry: 1,
  },

  // Path resolution (match Next.js config)
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
