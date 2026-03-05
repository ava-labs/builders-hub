/** Maximum characters allowed in a single chat message */
export const MAX_MESSAGE_CHARS = 4000;

/** Character count at which a warning is shown (85% of max) */
export const WARN_MESSAGE_CHARS = Math.floor(MAX_MESSAGE_CHARS * 0.85);

/** Server-side hard cap (slightly higher to account for edge cases) */
export const SERVER_MAX_MESSAGE_CHARS = 6000;
