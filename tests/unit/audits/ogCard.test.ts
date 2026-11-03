import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const { createOGResponseMock } = vi.hoisted(() => ({ createOGResponseMock: vi.fn() }));
// The route renders through next/og with fonts fetched from disk; the test
// reads what it hands the renderer.
vi.mock('@/utils/og-image', () => ({
  loadFonts: async () => ({}),
  createOGResponse: createOGResponseMock,
}));

import { SectionCard, sectionFromPath, taglineFromPath } from '@/utils/og/section-card';
import { metadata } from '@/app/(home)/audits/layout';
import { GET } from '@/app/api/og/audits/route';

/**
 * The /audits social card. Until this branch the section fell through to the
 * site-wide default card (utils/metadata.ts), so a shared link read
 * "Avalanche Builder Hub" with no hint of the audit program.
 */

const AUDITS_OG_IMAGE = '/api/og/audits';

type ImageLike = string | URL | { url: string | URL };

const firstImageUrl = (images: unknown): string | undefined => {
  const first = (Array.isArray(images) ? images[0] : images) as ImageLike | undefined;
  if (!first) return undefined;
  if (typeof first === 'string') return first;
  if (first instanceof URL) return first.toString();
  return String(first.url);
};

describe('audits section card', () => {
  it('maps the audits path to its own footer tagline', () => {
    expect(sectionFromPath('audits')).toBe('AUDITS');
    expect(taglineFromPath('audits')).toBe('AVA LABS AUDIT PROGRAM · FREE FOR BUILDERS');
  });

  it('renders title, description, canonical path and tagline', () => {
    const html = renderToStaticMarkup(
      createElement(SectionCard, {
        title: 'Security Audits',
        description: String(metadata.description),
        path: 'audits',
      }),
    );
    expect(html).toContain('SECURITY AUDITS');
    expect(html).toContain('THE VETTED SECURITY FIRMS ON THE AVA LABS WHITELIST');
    // The subsidy is no longer advertised (2026-10-20).
    expect(html).toContain('FREE AND PRIVATE.');
    expect(html).not.toContain('SUBSIDIZED');
    expect(html).toContain('BUILD.AVAX.NETWORK/AUDITS');
    expect(html).toContain('AVA LABS AUDIT PROGRAM · FREE FOR BUILDERS');
    expect(html).not.toContain('ONE NETWORK · TWO WAYS TO BUILD');
    // "Security Audits" already carries the section, so no red AUDITS label.
    expect(html).not.toMatch(/>AUDITS</);
  });
});

describe('audits layout metadata', () => {
  it('points og:image and twitter:image at the audits card', () => {
    expect(firstImageUrl(metadata.openGraph?.images)).toBe(AUDITS_OG_IMAGE);
    expect(firstImageUrl(metadata.twitter?.images)).toBe(AUDITS_OG_IMAGE);
  });

  it('describes the program as free and private, with no subsidy', () => {
    expect(metadata.description).toBe(
      'Request audit quotes from the vetted security firms on the Ava Labs whitelist. Free and private.',
    );
  });

  it('prints the same description on the social card', async () => {
    await GET();

    expect(createOGResponseMock).toHaveBeenCalledTimes(1);
    expect(createOGResponseMock.mock.calls[0][0]).toMatchObject({
      title: 'Security Audits',
      description: metadata.description,
      path: 'audits',
    });
  });
});
