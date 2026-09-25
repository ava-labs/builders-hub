import { describe, expect, it } from 'vitest';
import {
  blobKeyFromIdentifier,
  isSafeBlobKey,
  isWellFormedBlobKey,
  uploaderIdFromBlobKey,
} from '@/server/services/fileValidation';

const OWNER = 'cjld2cjxh0000qzrmn831i7rn';

describe('isWellFormedBlobKey', () => {
  it('accepts exactly two non-empty segments', () => {
    expect(isWellFormedBlobKey(`${OWNER}/a845fcb0.png`)).toBe(true);
  });

  it('rejects a third segment, so a nested key cannot pose as a prefix', () => {
    expect(isWellFormedBlobKey(`${OWNER}/sub/a.png`)).toBe(false);
  });

  it('rejects traversal and empty segments', () => {
    for (const key of [`${OWNER}/../victim.png`, `${OWNER}/.`, `${OWNER}/`, `/a.png`, 'a.png']) {
      expect(isWellFormedBlobKey(key)).toBe(false);
    }
  });
});

describe('isSafeBlobKey', () => {
  it('accepts legacy keys of any depth, which stay admin-only', () => {
    expect(isSafeBlobKey('old-logo.png')).toBe(true);
    expect(isSafeBlobKey('builders-hub/hackathon-images/x.png')).toBe(true);
  });

  it('rejects traversal and empty segments at any depth', () => {
    for (const key of [`${OWNER}/../victim.png`, 'a//b.png', '../x.png', 'a/./b.png', '']) {
      expect(isSafeBlobKey(key)).toBe(false);
    }
  });
});

describe('uploaderIdFromBlobKey', () => {
  it('reads a cuid owner without guessing the id format', () => {
    expect(uploaderIdFromBlobKey(`https://example.com/${OWNER}/a845fcb0.png`)).toBe(OWNER);
  });

  it('returns null for a legacy unprefixed name', () => {
    expect(uploaderIdFromBlobKey('old-logo.png')).toBeNull();
  });

  it('returns null for a deep legacy path rather than naming a folder as owner', () => {
    expect(uploaderIdFromBlobKey('builders-hub/hackathon-images/x.png')).toBeNull();
  });

  // blobKeyFromIdentifier decodes AFTER the URL parser normalises dot
  // segments, so encoded separators arrive as real ones.
  it('refuses an encoded-separator traversal', () => {
    const sneaky = `https://example.com/${OWNER}/%2F..%2Fvictim/f.png`;
    expect(blobKeyFromIdentifier(sneaky)).toContain('..');
    expect(uploaderIdFromBlobKey(sneaky)).toBeNull();
  });
});
