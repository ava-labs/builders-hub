import { describe, expect, it } from 'vitest'

import {
  normalizeTelegram,
  formatTelegramDisplay,
  extractXUsername,
  normalizeXUrl,
  extractLinkedInSlug,
  normalizeLinkedInUrl,
  extractGithubUsername,
  normalizeGithubUrl,
  ensureUrl,
} from '@/lib/profile/socialAccountFormat'
import {
  TELEGRAM_ACCOUNT_PATTERN,
  X_ACCOUNT_PATTERN,
  LINKEDIN_ACCOUNT_PATTERN,
  GITHUB_ACCOUNT_PATTERN,
} from '@/lib/profile/socialAccountValidation'

describe('normalizeTelegram', () => {
  it('strips a leading @', () => {
    expect(normalizeTelegram('@username')).toBe('username')
  })

  it('passes a bare handle through unchanged', () => {
    expect(normalizeTelegram('username')).toBe('username')
  })

  it('unwraps t.me and https://t.me/ URLs', () => {
    expect(normalizeTelegram('t.me/username')).toBe('username')
    expect(normalizeTelegram('https://t.me/username')).toBe('username')
    expect(normalizeTelegram('https://telegram.me/username/')).toBe('username')
  })

  it('collapses a doubled @@ (the profile-editor display bug)', () => {
    expect(normalizeTelegram('@@username')).toBe('username')
  })

  it('trims whitespace and returns "" for empty input', () => {
    expect(normalizeTelegram('  @username  ')).toBe('username')
    expect(normalizeTelegram('')).toBe('')
    expect(normalizeTelegram('   ')).toBe('')
    expect(normalizeTelegram(null)).toBe('')
    expect(normalizeTelegram(undefined)).toBe('')
  })

  it('produces a value that satisfies TELEGRAM_ACCOUNT_PATTERN', () => {
    expect(TELEGRAM_ACCOUNT_PATTERN.test(normalizeTelegram('@andyvargtz'))).toBe(true)
    expect(TELEGRAM_ACCOUNT_PATTERN.test(normalizeTelegram('https://t.me/andyvargtz'))).toBe(true)
  })
})

describe('formatTelegramDisplay', () => {
  it('prefixes a single @ and never doubles it', () => {
    expect(formatTelegramDisplay('username')).toBe('@username')
    expect(formatTelegramDisplay('@username')).toBe('@username')
    expect(formatTelegramDisplay('@@username')).toBe('@username')
  })

  it('returns "" for empty input', () => {
    expect(formatTelegramDisplay('')).toBe('')
    expect(formatTelegramDisplay(null)).toBe('')
  })
})

describe('extractXUsername', () => {
  it('reads the handle from x.com / twitter.com URLs and @handles', () => {
    expect(extractXUsername('https://x.com/jack')).toBe('jack')
    expect(extractXUsername('https://www.twitter.com/jack/')).toBe('jack')
    expect(extractXUsername('@jack')).toBe('jack')
    expect(extractXUsername('jack')).toBe('jack')
  })
})

describe('normalizeXUrl', () => {
  it('builds a canonical x.com URL from any form, twitter.com → x.com', () => {
    expect(normalizeXUrl('jack')).toBe('https://x.com/jack')
    expect(normalizeXUrl('@jack')).toBe('https://x.com/jack')
    expect(normalizeXUrl('https://twitter.com/jack')).toBe('https://x.com/jack')
    expect(normalizeXUrl('')).toBe('')
  })

  it('produces a value that satisfies X_ACCOUNT_PATTERN', () => {
    expect(X_ACCOUNT_PATTERN.test(normalizeXUrl('jack'))).toBe(true)
    expect(X_ACCOUNT_PATTERN.test(normalizeXUrl('https://twitter.com/jack'))).toBe(true)
  })
})

describe('extractLinkedInSlug', () => {
  it('reads the slug from in/pub/company/school paths', () => {
    expect(extractLinkedInSlug('https://www.linkedin.com/in/jane-doe')).toBe('jane-doe')
    expect(extractLinkedInSlug('https://linkedin.com/company/ava-labs/')).toBe('ava-labs')
    expect(extractLinkedInSlug('jane-doe')).toBe('jane-doe')
  })
})

describe('normalizeLinkedInUrl', () => {
  it('builds a canonical /in/ URL from a bare slug by default', () => {
    expect(normalizeLinkedInUrl('jane-doe')).toBe('https://www.linkedin.com/in/jane-doe')
  })

  it('uses the provided default kind for bare slugs', () => {
    expect(normalizeLinkedInUrl('ava-labs', 'company')).toBe(
      'https://www.linkedin.com/company/ava-labs',
    )
  })

  it('preserves an explicit kind present in the input', () => {
    expect(normalizeLinkedInUrl('https://linkedin.com/company/ava-labs', 'in')).toBe(
      'https://www.linkedin.com/company/ava-labs',
    )
    expect(normalizeLinkedInUrl('https://www.linkedin.com/in/jane', 'company')).toBe(
      'https://www.linkedin.com/in/jane',
    )
  })

  it('returns "" for empty input', () => {
    expect(normalizeLinkedInUrl('')).toBe('')
  })

  it('produces a value that satisfies LINKEDIN_ACCOUNT_PATTERN', () => {
    expect(LINKEDIN_ACCOUNT_PATTERN.test(normalizeLinkedInUrl('jane-doe'))).toBe(true)
    expect(LINKEDIN_ACCOUNT_PATTERN.test(normalizeLinkedInUrl('ava-labs', 'company'))).toBe(true)
  })
})

describe('extractGithubUsername / normalizeGithubUrl', () => {
  it('reads the handle from URLs, @handles, and bare handles', () => {
    expect(extractGithubUsername('https://github.com/ava-labs')).toBe('ava-labs')
    expect(extractGithubUsername('@ava-labs')).toBe('ava-labs')
    expect(extractGithubUsername('ava-labs')).toBe('ava-labs')
  })

  it('builds a canonical github.com URL', () => {
    expect(normalizeGithubUrl('ava-labs')).toBe('https://github.com/ava-labs')
    expect(normalizeGithubUrl('https://github.com/ava-labs/')).toBe('https://github.com/ava-labs')
    expect(normalizeGithubUrl('')).toBe('')
  })

  it('produces a value that satisfies GITHUB_ACCOUNT_PATTERN', () => {
    expect(GITHUB_ACCOUNT_PATTERN.test(normalizeGithubUrl('ava-labs'))).toBe(true)
    expect(GITHUB_ACCOUNT_PATTERN.test(extractGithubUsername('ava-labs'))).toBe(true)
  })
})

describe('ensureUrl', () => {
  it('prepends https:// when a scheme is missing', () => {
    expect(ensureUrl('example.com')).toBe('https://example.com')
    expect(ensureUrl('https://example.com')).toBe('https://example.com')
  })

  it('passes empty values through', () => {
    expect(ensureUrl('')).toBe('')
  })
})
