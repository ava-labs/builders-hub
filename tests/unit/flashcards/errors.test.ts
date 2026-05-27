import { describe, expect, it } from 'vitest';
import {
  FLASHCARDS_MAX_SOURCE_TOKENS,
  sanitizeFlashcardError,
  ServiceUnavailableError,
  SourceUnavailableError,
  TokenBudgetExceededError,
} from '@/lib/flashcards/errors';

describe('sanitizeFlashcardError', () => {
  it('maps TokenBudgetExceededError to 400 with structured details', () => {
    const err = new TokenBudgetExceededError(
      150_000,
      FLASHCARDS_MAX_SOURCE_TOKENS,
    );
    const result = sanitizeFlashcardError(err);
    expect(result.status).toBe(400);
    expect(result.body.error).toBe('Sources exceed token budget');
    expect(result.body.message).toContain('150,000');
    expect(result.body.details).toEqual({
      tokensUsed: 150_000,
      tokenLimit: FLASHCARDS_MAX_SOURCE_TOKENS,
    });
  });

  it('maps SourceUnavailableError to 422', () => {
    const result = sanitizeFlashcardError(
      new SourceUnavailableError('No MDX file found for /content/x.mdx'),
    );
    expect(result.status).toBe(422);
    expect(result.body.error).toBe('Source unavailable');
    expect(result.body.message).not.toContain('/content/x.mdx');
  });

  it('maps ServiceUnavailableError to 503 without leaking the original message', () => {
    const result = sanitizeFlashcardError(
      new ServiceUnavailableError('Flashcard generation is not configured'),
    );
    expect(result.status).toBe(503);
    expect(result.body.message).not.toContain('configured');
  });

  it('treats Anthropic-flavored Error messages as service unavailable', () => {
    const cases = [
      'Anthropic API request failed',
      'invalid_api_key: please rotate',
      'authentication_error: 401 from upstream',
      'unauthorized request: missing apiKey header',
    ];
    for (const msg of cases) {
      const result = sanitizeFlashcardError(new Error(msg));
      expect(result.status).toBe(503);
      expect(result.body.message).not.toContain(msg);
      expect(result.body.error).toBe('Service unavailable');
    }
  });

  it('treats "no MDX file found" raw errors as source unavailable', () => {
    const result = sanitizeFlashcardError(
      new Error('No MDX file found for "/academy/internal/path"'),
    );
    expect(result.status).toBe(422);
    expect(result.body.message).not.toContain('/academy/internal');
  });

  it('falls back to a generic 502 for unknown Error instances', () => {
    const result = sanitizeFlashcardError(
      new Error('Random downstream failure with secret abc123'),
    );
    expect(result.status).toBe(502);
    expect(result.body.message).not.toContain('abc123');
    expect(result.body.error).toBe('Generation failed');
  });

  it('falls back to a generic 502 for non-Error throwables', () => {
    const result = sanitizeFlashcardError('weird string');
    expect(result.status).toBe(502);
    expect(result.body.error).toBe('Generation failed');
  });

  it('never echoes the raw error.message back to the client body', () => {
    const sensitive = 'sk-ant-api03-XXXXXXXXXXXXXXXXXXXXXXXX';
    const result = sanitizeFlashcardError(new Error(sensitive));
    expect(JSON.stringify(result.body)).not.toContain(sensitive);
  });
});
