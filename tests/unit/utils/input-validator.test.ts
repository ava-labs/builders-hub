import { describe, expect, it } from 'vitest'

import {
  detectHtmlInjection,
  detectMarkdownInjection,
  detectDangerousUrl,
  validateTextInput,
  validateUrlInput,
  validateStringArray,
} from '@/utils/input-validator'

describe('detectHtmlInjection', () => {
  it('allows plain words that contain script as a substring', () => {
    expect(detectHtmlInjection('Voyager project')).toBe(false)
    expect(detectHtmlInjection('Short description')).toBe(false)
    expect(detectHtmlInjection('Full description')).toBe(false)
  })

  it('rejects HTML tags', () => {
    expect(detectHtmlInjection("<script>alert('xss')</script>")).toBe(true)
    expect(detectHtmlInjection('<img src=x onerror=alert(1)>')).toBe(true)
    expect(detectHtmlInjection('<b>bold</b>')).toBe(true)
  })

  it('rejects script-related patterns', () => {
    expect(detectHtmlInjection('javascript:alert(1)')).toBe(true)
    expect(detectHtmlInjection('eval(alert(1))')).toBe(true)
    expect(detectHtmlInjection('expression(alert(1))')).toBe(true)
  })
})

describe('detectDangerousUrl', () => {
  it('allows safe http/https URLs', () => {
    expect(detectDangerousUrl('https://example.com')).toBe(false)
    expect(detectDangerousUrl('http://example.com/path?q=1')).toBe(false)
  })

  it('rejects dangerous protocols', () => {
    expect(detectDangerousUrl('javascript:alert(1)')).toBe(true)
    expect(detectDangerousUrl('data:text/html,<script>alert(1)</script>')).toBe(true)
    expect(detectDangerousUrl('vbscript:msgbox(1)')).toBe(true)
    expect(detectDangerousUrl('file:///etc/passwd')).toBe(true)
    expect(detectDangerousUrl('about:blank')).toBe(true)
  })

  it('is case-insensitive for protocols', () => {
    expect(detectDangerousUrl('JAVASCRIPT:alert(1)')).toBe(true)
    expect(detectDangerousUrl('Data:text/html,<h1>x</h1>')).toBe(true)
  })

  it('returns false for empty or non-string input', () => {
    expect(detectDangerousUrl('')).toBe(false)
  })
})

describe('detectMarkdownInjection', () => {
  it('allows Markdown links with safe URLs', () => {
    expect(detectMarkdownInjection('[Click here](https://example.com)')).toBe(false)
    expect(detectMarkdownInjection('[A](https://a.com) [B](https://b.com)')).toBe(false)
  })

  it('rejects a single dangerous Markdown link', () => {
    expect(detectMarkdownInjection('[click](javascript:alert(1))')).toBe(true)
    expect(detectMarkdownInjection('[x](data:text/html,<script>alert(1)</script>)')).toBe(true)
  })

  it('rejects dangerous link even when a safe link appears first', () => {
    // Regression: previous impl only checked the first match
    expect(
      detectMarkdownInjection('[safe](https://safe.com) [evil](javascript:alert(1))')
    ).toBe(true)
  })

  it('returns false for plain text without Markdown links', () => {
    expect(detectMarkdownInjection('plain text without links')).toBe(false)
    expect(detectMarkdownInjection('')).toBe(false)
  })
})

describe('validateTextInput', () => {
  it('returns true for safe text', () => {
    expect(validateTextInput('Short description', 'Short description')).toBe(true)
    expect(validateTextInput('My project built with Rust', 'description')).toBe(true)
  })

  it('returns an error string for HTML injection', () => {
    expect(validateTextInput("<script>alert('xss')</script>", 'title')).not.toBe(true)
  })

  it('returns an error string for dangerous Markdown', () => {
    expect(validateTextInput('[x](javascript:alert(1))', 'title')).not.toBe(true)
  })

  it('returns true for undefined or non-string values', () => {
    expect(validateTextInput(undefined, 'field')).toBe(true)
    expect(validateTextInput(['array'], 'field')).toBe(true)
  })
})

describe('validateUrlInput', () => {
  it('returns true for valid URLs', () => {
    expect(validateUrlInput('https://github.com/myrepo')).toBe(true)
    expect(validateUrlInput(['https://a.com', 'https://b.com'])).toBe(true)
  })

  it('returns an error string for dangerous URL protocols', () => {
    expect(validateUrlInput('javascript:alert(1)')).not.toBe(true)
    expect(validateUrlInput(['https://ok.com', 'data:text/html,bad'])).not.toBe(true)
  })

  it('returns true for empty input', () => {
    expect(validateUrlInput(undefined)).toBe(true)
    expect(validateUrlInput([])).toBe(true)
  })
})

describe('validateStringArray', () => {
  it('returns true for a safe array of strings', () => {
    expect(validateStringArray(['DeFi', 'Gaming', 'NFT'], 'categories')).toBe(true)
  })

  it('returns an error string if any item contains HTML', () => {
    expect(validateStringArray(['DeFi', '<script>x</script>'], 'categories')).not.toBe(true)
  })

  it('returns an error string if any item is a dangerous URL', () => {
    expect(validateStringArray(['javascript:alert(1)'], 'links')).not.toBe(true)
  })

  it('returns true for undefined or non-array input', () => {
    expect(validateStringArray(undefined, 'field')).toBe(true)
    expect(validateStringArray('string-not-array', 'field')).toBe(true)
  })
})

