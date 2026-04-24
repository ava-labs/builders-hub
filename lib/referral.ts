const REFERRER_STORAGE_KEY = 'buildGamesReferrer';
const EVENT_REFERRER_STORAGE_KEY = 'eventReferrer';

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

const BASE_URL = 'https://build.avax.network/build-games/apply';

/**
 * Generates a referral link with the given X handle and optional user ID
 * If userId is provided, the referral code will be: first4chars-last4chars-handle
 * If userId is not provided, the referral code will be: handle
 */
export function generateReferralLink(handle: string, userId?: string): string {
  const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle;

  let referralCode = cleanHandle;

  // Try to include user ID prefix if available
  if (userId) {
    try {
      // Use first 4 and last 4 characters of user ID
      const firstFour = userId.substring(0, 4);
      const lastFour = userId.substring(userId.length - 4);
      const userIdPrefix = `${firstFour}-${lastFour}`;
      referralCode = `${userIdPrefix}-${cleanHandle}`;
    } catch (error) {
      // If any error occurs, just use the handle
      console.error('Error processing user ID for referral:', error);
    }
  }

  return `${BASE_URL}?ref=${encodeURIComponent(referralCode)}`;
}

/**
 * Gets the event referrer handle from localStorage
 */
export function getEventReferrer(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(EVENT_REFERRER_STORAGE_KEY);
}

/**
 * Clears the event referrer from localStorage
 */
export function clearEventReferrer(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(EVENT_REFERRER_STORAGE_KEY);
}

/**
 * Checks URL for ref parameter and stores it in the event referrer key
 * Call this on registration form page load
 */
export function captureEventReferrerFromUrl(): string | null {
  if (typeof window === 'undefined') return null;

  const urlParams = new URLSearchParams(window.location.search);
  const ref = urlParams.get('ref');

  if (ref) {
    localStorage.setItem(EVENT_REFERRER_STORAGE_KEY, ref);
    return ref;
  }

  return getEventReferrer();
}

/**
 * Generates a referral link for an event registration
 * Code format: first4chars-last4chars-handle
 */
export function generateEventReferralLink(
  handle: string,
  eventId: string,
  userId?: string
): string {
  const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle;
  let referralCode = cleanHandle;

  if (userId) {
    try {
      const firstFour = userId.substring(0, 4);
      const lastFour = userId.substring(userId.length - 4);
      referralCode = `${firstFour}-${lastFour}-${cleanHandle}`;
    } catch (error) {
      console.error('Error processing user ID for event referral:', error);
    }
  }

  const base =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://build.avax.network';

  return `${base}/events/registration-form?event=${encodeURIComponent(eventId)}&ref=${encodeURIComponent(referralCode)}`;
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
