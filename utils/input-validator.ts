/**
 * Input validation utilities to detect dangerous content
 * without modifying user input
 */

/**
 * Checks if text contains HTML/Script injection attempts
 */
export function detectHtmlInjection(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false
  }

  // Check for HTML tags
  const htmlTagPattern = /<[^>]+>/g
  if (htmlTagPattern.test(text)) {
    return true
  }

  // Check for script-related patterns without matching normal words like "description"
  const dangerousScriptPattern = /(?:javascript|vbscript)\s*:|<\s*\/?\s*script\b|\bon[a-z]+\s*=|\beval\s*\(|\bexpression\s*\(/i
  if (dangerousScriptPattern.test(text)) {
    return true
  }

  return false
}

/**
 * Checks if text contains Markdown injection attempts.
 * Evaluates ALL markdown links in the text, not just the first one.
 */
export function detectMarkdownInjection(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false
  }

  // Recreate the regex each call (stateless) and iterate over ALL matches
  const markdownLinkPattern = /\[([^\]]*)\]\(([^)]*)\)/g
  let match: RegExpExecArray | null
  while ((match = markdownLinkPattern.exec(text)) !== null) {
    if (detectDangerousUrl(match[2])) {
      return true
    }
  }

  return false
}

/**
 * Checks if URL contains dangerous protocols
 */
export function detectDangerousUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false
  }

  const trimmedUrl = url.trim().toLowerCase()

  // Block dangerous protocols
  const dangerousProtocols = [
    'javascript:',
    'data:',
    'vbscript:',
    'file:',
    'about:',
  ]

  return dangerousProtocols.some(protocol => trimmedUrl.startsWith(protocol))
}

/**
 * Validates text input for dangerous content
 * Returns error message if dangerous, otherwise returns true
 */
export function validateTextInput(
  value: string | string[] | undefined,
  fieldName: string
): true | string {
  if (!value || typeof value !== 'string') {
    return true
  }

  // Check for HTML injection
  if (detectHtmlInjection(value)) {
    return `⚠️ ${fieldName} contains dangerous HTML, Script or MD content. Please remove HTML tags and script-related keywords.`
  }

  // Check for Markdown injection
  if (detectMarkdownInjection(value)) {
    return `⚠️ ${fieldName} contains potentially dangerous Markdown links. Please use plain URLs instead.`
  }

  return true
}

/**
 * Validates URL input for dangerous protocols
 * Returns error message if dangerous, otherwise returns true
 */
export function validateUrlInput(
  value: string | string[] | undefined
): true | string {
  if (!value) {
    return true
  }

  const urls = Array.isArray(value) ? value : [value]

  for (const url of urls) {
    if (typeof url !== 'string') {
      continue
    }

    const trimmedUrl = url.trim()

    if (!trimmedUrl) {
      continue
    }

    if (detectDangerousUrl(trimmedUrl)) {
      return `⚠️ URL contains a dangerous protocol (javascript:, data:, vbscript:, file:, about:). Please use valid http:// or https:// URLs.`
    }
  }

  return true
}

/**
 * Validates an array of strings for dangerous content
 * Returns error message if dangerous, otherwise returns true
 */
export function validateStringArray(
  value: string | string[] | undefined,
  fieldName: string
): true | string {
  if (!value || !Array.isArray(value)) {
    return true
  }

  for (const item of value) {
    if (typeof item !== 'string') {
      continue
    }

    // Check for HTML injection
    if (detectHtmlInjection(item)) {
      return `⚠️ ${fieldName} contains dangerous HTML/Script content. Please remove HTML tags.`
    }

    // Check for dangerous URLs in items
    if (detectDangerousUrl(item)) {
      return `⚠️ ${fieldName} contains dangerous protocols. Please use valid URLs.`
    }
  }

  return true
}
