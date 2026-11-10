import { describe, expect, it } from 'vitest';
import { MINI_GRANT_HACKATHON_ID, MINI_GRANT_KEY } from '@/lib/grants/programs';
import {
  firstExternalUrl,
  projectEditHref,
  projectRoleLabel,
  referralKindTag,
  referralTargetGroups,
  shareUrlDisplay,
  totalSignupsOf,
  visibleReferralLinks,
} from '@/components/profile/sections/model';
import type { ReferralLink, ReferralTarget } from '@/components/profile/sections/types';

const project = (over: Partial<Parameters<typeof projectEditHref>[0]> = {}) => ({
  id: 'p 1',
  origin: 'hackathon',
  hackathonId: 'h-1',
  hasMiniGrantApplication: false,
  ...over,
});

describe('projectEditHref', () => {
  it('sends an event project to the submission form', () => {
    expect(projectEditHref(project())).toBe('/events/project-submission?project=p%201');
  });

  it('sends a mini grant project to its application', () => {
    expect(projectEditHref(project({ origin: MINI_GRANT_KEY, hackathonId: null }))).toBe(
      '/grants/team1-mini-grants/apply?project=p%201',
    );
    expect(projectEditHref(project({ hackathonId: MINI_GRANT_HACKATHON_ID }))).toBe(
      '/grants/team1-mini-grants/apply?project=p%201',
    );
    expect(projectEditHref(project({ hackathonId: MINI_GRANT_HACKATHON_ID, hasMiniGrantApplication: true }))).toBe(
      '/grants/team1-mini-grants',
    );
  });

  it('sends a Build Games project to its stage form', () => {
    expect(projectEditHref(project({ hackathonId: '249d2911-7931-4aa0-a696-37d8370b79f9' }))).toBe(
      '/build-games/submit?stage=1',
    );
  });
});

describe('projectRoleLabel', () => {
  it('gives no tag to a plain member, in any case', () => {
    expect(projectRoleLabel('Member')).toBeNull();
    expect(projectRoleLabel('member')).toBeNull();
    expect(projectRoleLabel('')).toBeNull();
  });

  it('capitalizes any other role', () => {
    expect(projectRoleLabel('lead')).toBe('Lead');
  });
});

describe('firstExternalUrl', () => {
  it('keeps an http link and adds https to a bare host', () => {
    expect(firstExternalUrl('https://github.com/a/b')).toBe('https://github.com/a/b');
    expect(firstExternalUrl('github.com/a/b')).toBe('https://github.com/a/b');
    expect(firstExternalUrl('example.com:8080/demo')).toBe('https://example.com:8080/demo');
  });

  it('takes the first link of a comma-joined value, as the submission forms store it', () => {
    expect(firstExternalUrl('https://github.com/a/b,https://github.com/a/c')).toBe('https://github.com/a/b');
    expect(firstExternalUrl(' , javascript:alert(1), demo.example.com')).toBe('https://demo.example.com');
  });

  it('drops an empty value and any other scheme', () => {
    expect(firstExternalUrl(null)).toBeNull();
    expect(firstExternalUrl('  ')).toBeNull();
    expect(firstExternalUrl('https://')).toBeNull();
    expect(firstExternalUrl('javascript:alert(1)')).toBeNull();
    expect(firstExternalUrl('JavaScript:alert(1)')).toBeNull();
    expect(firstExternalUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
  });
});

const target = (targetType: string, targetId: string | null, key = `${targetType}-${targetId}`): ReferralTarget => ({
  key,
  label: key,
  targetType,
  targetId,
  destinationUrl: '/',
  icon: 'rocket',
});

const link = (id: string, targetType: string, targetId: string | null, signups = 0): ReferralLink => ({
  id,
  shareUrl: `https://build.avax.network/?ref=${id}`,
  signups,
  targetType,
  targetId,
  targetLabel: id,
  targetIcon: 'rocket',
});

const catalog = [
  target('grant_application', 'grant_minigrant'),
  target('hackathon_registration', 'h-1'),
  target('hackathon_registration', 'h-2'),
  target('bh_signup', null),
];

describe('visibleReferralLinks', () => {
  it('keeps marketed kinds in the catalog, sign-up first', () => {
    const links = [
      link('grant', 'grant_application', 'grant_minigrant', 2),
      link('legacy', 'build_games_application', null, 5),
      link('ended', 'hackathon_registration', 'h-old', 1),
      link('event', 'hackathon_registration', 'h-1', 3),
      link('signup', 'bh_signup', null, 4),
    ];
    expect(visibleReferralLinks(links, catalog).map((l) => l.id)).toEqual(['signup', 'event', 'grant']);
  });
});

describe('referralTargetGroups', () => {
  it('groups the unlinked destinations by kind and leaves out an empty kind', () => {
    const groups = referralTargetGroups(catalog, [link('signup', 'bh_signup', null)]);
    expect(groups.map((g) => [g.label, g.targets.map((t) => t.targetId)])).toEqual([
      ['Events', ['h-1', 'h-2']],
      ['Grants', ['grant_minigrant']],
    ]);
  });
});

describe('referral display helpers', () => {
  it('uses the server total, else the sum of the links', () => {
    const links = [link('a', 'bh_signup', null, 2), link('b', 'grant_application', 'g', 3)];
    expect(totalSignupsOf(links, 9)).toBe(9);
    expect(totalSignupsOf(links)).toBe(5);
  });

  it('shows a share URL without its scheme or end slash', () => {
    expect(shareUrlDisplay('https://build.avax.network/')).toBe('build.avax.network');
    expect(shareUrlDisplay('http://localhost:3000/signup?ref=AB')).toBe('localhost:3000/signup?ref=AB');
  });

  it('tags events and grants only', () => {
    expect(referralKindTag('hackathon_registration')).toBe('Event');
    expect(referralKindTag('grant_application')).toBe('Grant');
    expect(referralKindTag('bh_signup')).toBeNull();
    expect(referralKindTag('build_games_application')).toBeNull();
  });
});
