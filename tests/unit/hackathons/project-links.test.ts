import { describe, it, expect } from 'vitest';
import {
  countReviewProgress,
  projectHasNoLinks,
} from '@/lib/hackathons/project-links';

/**
 * A hackathon project with no links at all (no GitHub, demo, video, website,
 * socials, or deployed addresses) has nothing a judge can verify, so the
 * evaluate flow auto-hides it. The definition here must mirror what the
 * SubmissionDetailPanel "Links" section renders: trimmed, string-valued URLs.
 */

const emptyShell = {
  github_repository: null,
  demo_link: null,
  demo_video_link: null,
  website: null,
  socials: null,
  deployed_addresses: [],
};

describe('projectHasNoLinks — link-less shells', () => {
  it('flags a project with every link field null/empty', () => {
    expect(projectHasNoLinks(emptyShell)).toBe(true);
  });

  it('flags empty strings and whitespace-only strings as no link', () => {
    expect(
      projectHasNoLinks({
        ...emptyShell,
        github_repository: '',
        demo_link: '   ',
        demo_video_link: '\t',
      }),
    ).toBe(true);
  });

  it('flags empty website/socials objects as no link', () => {
    expect(
      projectHasNoLinks({ ...emptyShell, website: {}, socials: {} }),
    ).toBe(true);
  });

  it('flags website/socials whose every value is empty or non-string', () => {
    expect(
      projectHasNoLinks({
        ...emptyShell,
        website: { main: '', docs: '  ' },
        socials: { twitter: null, discord: 42 },
      }),
    ).toBe(true);
  });

  it('treats malformed website/socials shapes (array, string) as no link', () => {
    expect(
      projectHasNoLinks({
        ...emptyShell,
        website: ['https://example.com'],
        socials: 'https://x.com/team',
      }),
    ).toBe(true);
  });

  it('ignores deployed address entries without a usable address', () => {
    expect(
      projectHasNoLinks({
        ...emptyShell,
        deployed_addresses: [{ tag: 'token' }, { address: '   ' }, null, 'raw'],
      }),
    ).toBe(true);
  });
});

describe('projectHasNoLinks — projects with at least one link', () => {
  it.each([
    ['github_repository', { github_repository: 'https://github.com/org/repo' }],
    ['demo_link', { demo_link: 'https://demo.example.com' }],
    ['demo_video_link', { demo_video_link: 'https://youtu.be/abc' }],
  ] as const)('keeps a project with only %s', (_field, overrides) => {
    expect(projectHasNoLinks({ ...emptyShell, ...overrides })).toBe(false);
  });

  it('keeps a project whose website map has one non-empty URL', () => {
    expect(
      projectHasNoLinks({
        ...emptyShell,
        website: { main: '', landing: 'https://example.com' },
      }),
    ).toBe(false);
  });

  it('keeps a project whose socials map has one non-empty URL', () => {
    expect(
      projectHasNoLinks({
        ...emptyShell,
        socials: { twitter: 'https://x.com/team' },
      }),
    ).toBe(false);
  });

  it('keeps a project with only a deployed address (on-chain evidence)', () => {
    expect(
      projectHasNoLinks({
        ...emptyShell,
        deployed_addresses: [{ address: '0x1234abcd', tag: 'token' }],
      }),
    ).toBe(false);
  });
});

/**
 * The "Move to picking phase" gate must only count projects judges can
 * actually review: hidden projects (manually rejected or auto-hidden) drop
 * out of both the reviewed and total counters, otherwise the gate can never
 * be satisfied.
 */

function proj(overrides: {
  is_rejected?: boolean;
  auto_hidden?: boolean;
  evaluations?: unknown[];
}) {
  return {
    is_rejected: false,
    auto_hidden: false,
    evaluations: [],
    ...overrides,
  };
}

describe('countReviewProgress — eligibility-aware gate counters', () => {
  it('counts only eligible projects in reviewed and total', () => {
    const { reviewed, total } = countReviewProgress([
      proj({ evaluations: [{}] }),
      proj({}),
      proj({ is_rejected: true, evaluations: [{}] }),
      proj({ auto_hidden: true }),
    ]);
    expect(total).toBe(2);
    expect(reviewed).toBe(1);
  });

  it('excludes a reviewed-then-hidden project from both counters', () => {
    const { reviewed, total } = countReviewProgress([
      proj({ is_rejected: true, evaluations: [{}, {}] }),
      proj({ auto_hidden: true, evaluations: [{}] }),
    ]);
    expect(total).toBe(0);
    expect(reviewed).toBe(0);
  });

  it('returns zeros for an empty project list', () => {
    expect(countReviewProgress([])).toEqual({ reviewed: 0, total: 0 });
  });

  it('is satisfied exactly when every eligible project has a review', () => {
    const { reviewed, total } = countReviewProgress([
      proj({ evaluations: [{}] }),
      proj({ evaluations: [{}] }),
      proj({ is_rejected: true }),
      proj({ auto_hidden: true }),
    ]);
    expect(reviewed).toBe(total);
    expect(total).toBe(2);
  });
});
