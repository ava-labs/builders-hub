import axios from 'axios';

/**
 * The message to show when /api/send-otp refuses a request. A 4xx answer
 * carries a message for the user (for example a 429 with the wait time).
 * Anything else shows the caller's fallback.
 */
export function sendOtpErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error) && error.response && error.response.status < 500) {
    const message = error.response.data?.error;
    if (typeof message === 'string') return message;
  }
  return fallback;
}
