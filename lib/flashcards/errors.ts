/**
 * Token budget for a single generate request. Sources are stripped of MDX
 * scaffolding before measurement, so this is a fair upper bound on what the
 * LLM will actually see. Tuned to keep per-request cost predictable on the
 * Sonnet 4 model used by `generateDeck`.
 */
export const FLASHCARDS_MAX_SOURCE_TOKENS = 100_000;

export class TokenBudgetExceededError extends Error {
  readonly tokensUsed: number;
  readonly tokenLimit: number;

  constructor(tokensUsed: number, tokenLimit: number) {
    super(
      `Source content exceeds token budget (${tokensUsed} > ${tokenLimit}).`,
    );
    this.name = 'TokenBudgetExceededError';
    this.tokensUsed = tokensUsed;
    this.tokenLimit = tokenLimit;
  }
}

export class SourceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SourceUnavailableError';
  }
}

export class ServiceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceUnavailableError';
  }
}

export interface SanitizedError {
  status: number;
  body: {
    error: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

const GENERIC_GENERATION_FAILED: SanitizedError = {
  status: 502,
  body: {
    error: 'Generation failed',
    message:
      'We could not generate cards from this content right now. Please try again in a moment.',
  },
};

const ANTHROPIC_ERROR_HINTS = [
  'anthropic',
  'api key',
  'apikey',
  'authentication',
  'unauthorized',
  'invalid_api_key',
  'authentication_error',
];

/**
 * Convert any thrown value into a user-safe API response.
 *
 * Why: raw `error.message` strings from the LLM client can include API keys,
 * stack frames, internal paths, or credentials fragments. We never want those
 * to reach the client or end up in shared logs verbatim. The caller is still
 * expected to log the original error server-side for debugging.
 */
export function sanitizeFlashcardError(error: unknown): SanitizedError {
  if (error instanceof TokenBudgetExceededError) {
    return {
      status: 400,
      body: {
        error: 'Sources exceed token budget',
        message: `Your selected chapters total ~${error.tokensUsed.toLocaleString()} tokens, but the limit per generation is ${error.tokenLimit.toLocaleString()}. Pick fewer or shorter chapters and try again.`,
        details: {
          tokensUsed: error.tokensUsed,
          tokenLimit: error.tokenLimit,
        },
      },
    };
  }

  if (error instanceof SourceUnavailableError) {
    return {
      status: 422,
      body: {
        error: 'Source unavailable',
        message:
          'One or more selected chapters could not be loaded. They may have been moved or removed since you opened this page.',
      },
    };
  }

  if (error instanceof ServiceUnavailableError) {
    return {
      status: 503,
      body: {
        error: 'Service unavailable',
        message:
          'The flashcard service is temporarily unavailable. Please try again shortly.',
      },
    };
  }

  if (error instanceof Error) {
    const lower = error.message.toLowerCase();
    if (ANTHROPIC_ERROR_HINTS.some((hint) => lower.includes(hint))) {
      return {
        status: 503,
        body: {
          error: 'Service unavailable',
          message:
            'The flashcard service is temporarily unavailable. Please try again shortly.',
        },
      };
    }
    if (lower.includes('no mdx file found')) {
      return {
        status: 422,
        body: {
          error: 'Source unavailable',
          message:
            'One or more selected chapters could not be loaded. They may have been moved or removed since you opened this page.',
        },
      };
    }
  }

  return GENERIC_GENERATION_FAILED;
}
