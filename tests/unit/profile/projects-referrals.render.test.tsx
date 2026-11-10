import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProjectsSection, type ProfileProject } from '@/components/profile/sections/ProjectsSection';
import { ReferralsSection } from '@/components/profile/sections/ReferralsSection';
import type { ReferralLink, ReferralTarget } from '@/components/profile/sections/types';

const project = (over: Partial<ProfileProject> = {}): ProfileProject => ({
  id: 'p-1',
  name: 'Relay Dashboard',
  description: 'Watch ICM messages move between L1s.',
  tags: [],
  isWinner: false,
  hackathonId: 'h-1',
  hackathonTitle: 'Summit Hack',
  origin: 'hackathon',
  hasMiniGrantApplication: false,
  logoUrl: null,
  demoLink: null,
  githubRepository: null,
  role: 'member',
  ...over,
});

const projects = (props: Partial<Parameters<typeof ProjectsSection>[0]> = {}) =>
  renderToStaticMarkup(createElement(ProjectsSection, { projects: [], ...props }));

describe('ProjectsSection', () => {
  it('links the name to the edit form and marks a winner in text', () => {
    const html = projects({ projects: [project({ isWinner: true, role: 'lead' })] });
    expect(html).toContain('href="/events/project-submission?project=p-1"');
    expect(html).toContain('aria-label="Edit Relay Dashboard"');
    expect(html).toContain('>Winner<');
    expect(html).toContain('>Lead<');
    expect(html).toContain('>Summit Hack<');
    expect(html).toMatch(/<ul[^>]*><li/);
  });

  it('opens the first stored repository and demo in a new tab', () => {
    const html = projects({
      projects: [
        project({
          githubRepository: 'https://github.com/a/b,https://github.com/a/c',
          demoLink: 'demo.example.com',
        }),
      ],
    });
    expect(html).toContain('href="https://github.com/a/b" target="_blank" rel="noopener noreferrer"');
    expect(html).toContain('aria-label="Relay Dashboard repository (opens in a new tab)"');
    expect(html).toContain('href="https://demo.example.com" target="_blank" rel="noopener noreferrer"');
    expect(html).toContain('href="/audits/new?project=p-1"');
  });

  it('shows no link for an unsafe stored value', () => {
    const html = projects({ projects: [project({ githubRepository: 'javascript:alert(1)' })] });
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('repository (opens in a new tab)');
  });

  it('shows one state at a time: empty, loading, failed', () => {
    const empty = projects();
    expect(empty).toContain('No projects yet.');
    expect(empty.match(/href="\/hackathons"/g)).toHaveLength(2);

    const loading = projects({ loading: true });
    expect(loading).toContain('role="status"');
    expect(loading).not.toContain('No projects yet.');

    const failed = projects({ failed: true, loading: true, onRetry: () => undefined });
    expect(failed).toContain('role="alert"');
    expect(failed).toContain('Could not load your projects.');
    expect(failed).toContain('Try again');
  });
});

const target = (targetType: string, targetId: string | null, label: string): ReferralTarget => ({
  key: `${targetType}-${targetId}`,
  label,
  targetType,
  targetId,
  destinationUrl: '/',
  icon: 'rocket',
});

const catalog = [
  target('bh_signup', null, 'Builder Hub Sign Up'),
  target('grant_application', 'grant_minigrant', 'Team1 Mini Grants'),
];

const signupLink: ReferralLink = {
  id: 'l-1',
  shareUrl: 'https://build.avax.network/signup?ref=AB',
  signups: 3,
  targetType: 'bh_signup',
  targetId: null,
  targetLabel: 'Builder Hub Sign Up',
  targetIcon: 'rocket',
};

const referrals = (props: Partial<Parameters<typeof ReferralsSection>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(ReferralsSection, { links: [], targets: catalog, onCreate: () => undefined, ...props }),
  );

describe('ReferralsSection', () => {
  it('lists each link with its count and named Copy and QR buttons', () => {
    const html = referrals({ links: [signupLink], totalSignups: 7 });
    expect(html).toContain('>Total signups<');
    expect(html).toContain('>7<');
    expect(html).toContain('build.avax.network/signup?ref=AB');
    expect(html).toContain('aria-label="Copy link for Builder Hub Sign Up"');
    expect(html).toContain('aria-label="Show QR code for Builder Hub Sign Up"');
  });

  it('offers a Make link button only for a destination with no link', () => {
    const html = referrals({ links: [signupLink] });
    expect(html).toContain('aria-label="Make link for Team1 Mini Grants"');
    expect(html).not.toContain('aria-label="Make link for Builder Hub Sign Up"');
  });

  it('shows the empty and the failed states', () => {
    expect(referrals()).toContain('No links yet. Make one below.');
    const failed = referrals({ failed: true, onRetry: () => undefined });
    expect(failed).toContain('Could not load your links.');
    expect(failed).not.toContain('Make link');
  });
});
