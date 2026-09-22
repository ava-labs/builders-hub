import { describe, expect, it, vi, beforeEach } from 'vitest';

const { projectFindFirst, userFindFirst, memberFindFirst } = vi.hoisted(() => ({
  projectFindFirst: vi.fn(),
  userFindFirst: vi.fn(),
  memberFindFirst: vi.fn(),
}));

vi.mock('@/prisma/prisma', () => ({
  prisma: {
    project: { findFirst: projectFindFirst },
    user: { findFirst: userFindFirst, findUnique: userFindFirst },
    member: { findFirst: memberFindFirst },
  },
}));

import {
  uploaderIdFromBlobKey,
  blobKeyFromIdentifier,
  canUserDeleteFile,
} from '@/server/services/fileValidation';

const VICTIM = 'aaaaaaaa-1111-2222-3333-444444444444';
const ATTACKER = 'bbbbbbbb-5555-6666-7777-888888888888';
const VICTIM_URL = `https://qizat.public.blob.vercel-storage.com/${VICTIM}/9f8e7d6c.png`;

beforeEach(() => {
  projectFindFirst.mockReset();
  userFindFirst.mockReset();
  memberFindFirst.mockReset();
});

describe('blobKeyFromIdentifier', () => {
  // Regression: taking the last path segment addressed a different object,
  // so deletes silently removed nothing.
  it('keeps the uploader prefix from a full URL', () => {
    expect(blobKeyFromIdentifier(VICTIM_URL)).toBe(`${VICTIM}/9f8e7d6c.png`);
  });

  it('keeps a bare prefixed key unchanged', () => {
    expect(blobKeyFromIdentifier(`${VICTIM}/a.png`)).toBe(`${VICTIM}/a.png`);
  });

  it('handles a legacy unprefixed name', () => {
    expect(blobKeyFromIdentifier('old-logo.png')).toBe('old-logo.png');
  });

  it('decodes percent-encoding in the path', () => {
    expect(blobKeyFromIdentifier(`https://x.com/${VICTIM}/a%20b.png`)).toBe(`${VICTIM}/a b.png`);
  });
});

describe('uploaderIdFromBlobKey', () => {
  it('extracts the uploader from a prefixed key', () => {
    expect(uploaderIdFromBlobKey(VICTIM_URL)).toBe(VICTIM);
  });

  it('returns null for a legacy key', () => {
    expect(uploaderIdFromBlobKey('old-logo.png')).toBeNull();
  });
});

describe('canUserDeleteFile', () => {
  // Finding: the attacker created a project whose logo_url was the victim's
  // blob URL; the lookup then "confirmed" their ownership and the blob was
  // deleted. Ownership now comes from the key, so the lookup never runs.
  it("refuses deletion of another user's blob even if a project row points at it", async () => {
    projectFindFirst.mockResolvedValue({ id: 'attacker-project' });
    memberFindFirst.mockResolvedValue({ id: 'm1' });

    const allowed = await canUserDeleteFile(VICTIM_URL, ATTACKER, []);

    expect(allowed).toBe(false);
    // The spoofable lookup is not even consulted.
    expect(projectFindFirst).not.toHaveBeenCalled();
  });

  it('allows the uploader to delete their own blob', async () => {
    const allowed = await canUserDeleteFile(VICTIM_URL, VICTIM, []);
    expect(allowed).toBe(true);
    expect(projectFindFirst).not.toHaveBeenCalled();
  });

  it('allows an admin', async () => {
    const allowed = await canUserDeleteFile(VICTIM_URL, ATTACKER, ['admin']);
    expect(allowed).toBe(true);
  });

  // Legacy keys carry no owner, and the project/profile lookup that used to
  // stand in for one is exactly what an attacker can forge. Admin-only is the
  // only answer that cannot be spoofed.
  it('refuses a legacy unprefixed key for a non-admin', async () => {
    const allowed = await canUserDeleteFile('legacy-logo.png', ATTACKER, []);
    expect(allowed).toBe(false);
    // The spoofable lookup is not reached at all.
    expect(projectFindFirst).not.toHaveBeenCalled();
  });

  it('allows an admin to delete a legacy unprefixed key', async () => {
    const allowed = await canUserDeleteFile('legacy-logo.png', ATTACKER, ['admin']);
    expect(allowed).toBe(true);
  });

  it('cannot be spoofed by planting a project row for a legacy key', async () => {
    projectFindFirst.mockResolvedValue({ id: 'attacker-project' });
    memberFindFirst.mockResolvedValue({ id: 'm1' });
    expect(await canUserDeleteFile('legacy-logo.png', ATTACKER, [])).toBe(false);
  });
});
