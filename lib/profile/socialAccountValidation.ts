export const X_ACCOUNT_PATTERN = /^https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[A-Za-z0-9_]{1,15}\/?$/i;
// Accepts personal profiles (`/in/`, `/pub/`) AND company / school pages.
// Project profiles use the company variants; user profiles still work with
// /in/ as before.
export const LINKEDIN_ACCOUNT_PATTERN = /^https?:\/\/(?:www\.)?linkedin\.com\/(?:in|pub|company|school)\/[\w\-.%]+\/?$/i;
export const GITHUB_ACCOUNT_PATTERN = /^(?:[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}|https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}\/?)$/i;
export const TELEGRAM_ACCOUNT_PATTERN = /^@?[A-Za-z][A-Za-z0-9_]{4,31}$/;
