const REFERRER_STORAGE_KEY = 'buildGamesReferrer';

/**
 * Stores the referrer handle in localStorage
 */
export function setReferrer(handle: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REFERRER_STORAGE_KEY, handle);
}

/**
 * Gets the referrer handle from localStorage
 */
export function getReferrer(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFERRER_STORAGE_KEY);
}

/**
 * Clears the referrer from localStorage
 */
export function clearReferrer(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(REFERRER_STORAGE_KEY);
}

/**
 * Checks URL for ref parameter and stores it if present
 * Call this on page load
 */
export function captureReferrerFromUrl(): string | null {
  if (typeof window === 'undefined') return null;

  const urlParams = new URLSearchParams(window.location.search);
  const ref = urlParams.get('ref');

  if (ref) {
    setReferrer(ref);
    return ref;
  }

  return getReferrer();
}

const BASE_URL = 'https://build.avax.network/build-games';

/**
 * Generates a referral link with the given X handle
 */
export function generateReferralLink(handle: string): string {
  const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle;
  return `${BASE_URL}?ref=${encodeURIComponent(cleanHandle)}`;
}

/**
 * Generates a share URL for X (Twitter)
 */
export function generateXShareUrl(referralLink: string): string {
  const text = `If you're a crypto builder, read this.

Applications for the Build Games, a $1,000,000 builder competition on Avalanche just opened.

- all star judges
- designed for founders
- any idea on avalanche is eligible

Read more and apply here: ${referralLink}`;
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

/**
 * Generates a share URL for LinkedIn
 */
export function generateLinkedInShareUrl(referralLink: string): string {
  const text = `If you're a crypto builder, read this.

Applications for the Build Games, a $1,000,000 builder competition on Avalanche just opened.

- all star judges
- designed for founders
- any idea on avalanche is eligible

Read more and apply here: ${referralLink}`;
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}&summary=${encodeURIComponent(text)}`;
}
