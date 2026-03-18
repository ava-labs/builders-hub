/**
 * Detects if the user is browsing from an embedded browser (in-app browser)
 * Common embedded browsers: Twitter/X, Facebook, Instagram, LinkedIn, etc.
 */
export function isEmbeddedBrowser(): boolean {
  if (typeof window === 'undefined') return false;

  const ua = navigator.userAgent || '';

  // Twitter/X in-app browser
  if (ua.includes('Twitter') || ua.includes('FBAN') || ua.includes('FBAV')) {
    return true;
  }

  // Facebook in-app browser
  if (ua.includes('FBAN') || ua.includes('FBAV') || ua.includes('FB_IAB')) {
    return true;
  }

  // Instagram in-app browser
  if (ua.includes('Instagram')) {
    return true;
  }

  // LinkedIn in-app browser
  if (ua.includes('LinkedInApp')) {
    return true;
  }

  // Line in-app browser
  if (ua.includes('Line/')) {
    return true;
  }

  // Generic WebView detection (Android)
  if (ua.includes('wv') && ua.includes('Android')) {
    return true;
  }

  return false;
}

/**
 * Gets the name of the embedded browser
 */
export function getEmbeddedBrowserName(): string | null {
  if (typeof window === 'undefined') return null;

  const ua = navigator.userAgent || '';

  if (ua.includes('Twitter')) return 'X (Twitter)';
  if (ua.includes('FBAN') || ua.includes('FBAV') || ua.includes('FB_IAB')) return 'Facebook';
  if (ua.includes('Instagram')) return 'Instagram';
  if (ua.includes('LinkedInApp')) return 'LinkedIn';
  if (ua.includes('Line/')) return 'Line';

  return 'in-app browser';
}

/**
 * Opens the current URL in the system browser (forces external browser)
 */
export function openInExternalBrowser(): void {
  if (typeof window === 'undefined') return;

  const currentUrl = window.location.href;

  // Try multiple methods to open in external browser
  // Method 1: Use intent:// URL scheme for Android
  const isAndroid = /Android/i.test(navigator.userAgent);
  if (isAndroid) {
    window.location.href = `intent://${currentUrl.replace(/^https?:\/\//, '')}#Intent;scheme=https;end`;
    return;
  }

  // Method 2: For iOS, just opening with target _blank often works
  const link = document.createElement('a');
  link.href = currentUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
