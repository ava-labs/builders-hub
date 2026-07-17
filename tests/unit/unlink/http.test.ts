import { describe, expect, it } from 'vitest';
import { hasSameOrigin } from '@/lib/unlink/http';

describe('hasSameOrigin', () => {
  it('allows matching browser origins and non-browser requests', () => {
    expect(
      hasSameOrigin(
        new Request('https://build.avax.network/api/unlink/register', {
          headers: { origin: 'https://build.avax.network' },
        }),
      ),
    ).toBe(true);
    expect(hasSameOrigin(new Request('https://build.avax.network/api/unlink/register'))).toBe(true);
  });

  it('rejects foreign and malformed origins', () => {
    expect(
      hasSameOrigin(
        new Request('https://build.avax.network/api/unlink/register', {
          headers: { origin: 'https://evil.example' },
        }),
      ),
    ).toBe(false);
    expect(
      hasSameOrigin(
        new Request('https://build.avax.network/api/unlink/register', {
          headers: { origin: 'not a URL' },
        }),
      ),
    ).toBe(false);
  });
});
