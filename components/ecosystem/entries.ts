/**
 * The /ecosystem overview: every item of the navbar's Ecosystem menu, in the
 * desktop menu's three columns (events, programs, guides and tools). Campus
 * Connect is in the phone menu only; it sits with the programs, in its phone
 * menu order. Titles, badges and external flags match the menu items;
 * tests/unit/navigation/ecosystem-page.test.ts holds the two lists together.
 */

/** A live figure the overview reads for an entry (server/services/ecosystem.ts). */
export type EcosystemFigureKey = 'events' | 'auditFirms' | 'latestPost' | 'integrations';

export type EcosystemEntry = {
  title: string;
  /** what the page is, in one sentence */
  line: string;
  href: string;
  /** a site outside the Builder Hub: opens in a new tab */
  external?: boolean;
  badge?: string;
  figure?: EcosystemFigureKey;
};

export type EcosystemGroup = { id: string; title: string; entries: EcosystemEntry[] };

export const ECOSYSTEM_GROUPS: EcosystemGroup[] = [
  {
    id: 'events',
    title: 'Events',
    entries: [
      {
        title: 'Hackathons & Events',
        line: 'Hackathons, workshops and bootcamps on Avalanche.',
        href: '/events',
        figure: 'events',
      },
      {
        title: 'Avalanche Summit',
        line: 'The annual Avalanche conference for builders and enterprise leaders.',
        href: 'https://www.avalanchesummit.com',
        external: true,
      },
      {
        title: 'Community Driven Events',
        line: 'Meetups and workshops that Avalanche Team1 organizes around the world.',
        href: 'https://lu.ma/Team1?utm_source=builder_hub',
        external: true,
      },
    ],
  },
  {
    id: 'programs',
    title: 'Programs',
    entries: [
      {
        title: 'Campus Connect',
        line: 'Courses, faculty training and club support for students and educators.',
        href: '/university',
      },
      {
        title: 'Grants & Funding',
        line: 'Grants, the Blizzard Fund, partner programs and the bug bounty.',
        href: '/grants',
      },
      {
        title: 'Security Audits',
        line: 'One request for private quotes from vetted audit firms.',
        href: '/audits',
        badge: 'New',
        figure: 'auditFirms',
      },
    ],
  },
  {
    id: 'guides-and-tools',
    title: 'Guides and tools',
    entries: [
      {
        title: 'Blog & Guides',
        line: 'Articles and tutorials about Avalanche upgrades, L1s and developer tools.',
        // the menu links /guides, which redirects here
        href: '/blog',
        figure: 'latestPost',
      },
      {
        title: 'Integrations',
        line: 'Wallets, RPC providers, indexers, oracles, custody and other tools that support Avalanche.',
        href: '/integrations',
        figure: 'integrations',
      },
    ],
  },
];
