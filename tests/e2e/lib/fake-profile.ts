import type { FakeAnswers } from './fake-auth';

// The API answers of the profile page (components/profile) for one fake user, so a test opens the signed-in profile
// with no database. lib/fake-auth.ts serves the session; these serve what the page reads after it.
// The data is a fixed story: a builder with two Academy courses done, one hackathon win, Console activity on Fuji
// and one Query board.

export const ACADEMY_TOTAL = 13;
export const ACADEMY_DONE = 2;

export function profileAnswers(userId: string, email: string): FakeAnswers {
  return {
    [`GET /api/profile/extended/${userId}`]: {
      id: userId,
      name: 'Test Builder',
      username: 'testbuilder',
      email,
      bio: 'I build L1s for payments.',
      country: 'Portugal',
      image: null,
      user_type: { is_developer: true },
      github_account: null,
      x_account: null,
      linkedin_account: null,
      telegram_account: null,
      wallet: [],
      additional_social_accounts: [],
      skills: ['Solidity'],
      notifications: false,
      consent_sharing: false,
      profile_privacy: 'public',
      githubConnected: false,
    },
    'GET /api/user/noun-avatar': { seed: null, enabled: false },
    'GET /api/profile/popular-skills': [],
    'GET /api/profile/summary': {
      projects: [],
      badges: [
        {
          id: 'ub-1',
          badgeId: 'b-academy-1',
          name: 'Avalanche Fundamentals',
          description: 'Finish the Avalanche Fundamentals course.',
          imagePath: '/small-logo.png',
          category: 'academy',
          group: 'academy',
          isUnlocked: true,
          awardedAt: '2026-09-01T00:00:00.000Z',
          requirements: [],
        },
        {
          id: 'ub-2',
          badgeId: 'b-academy-2',
          name: 'Interchain Messaging',
          description: 'Finish the Interchain Messaging course.',
          imagePath: '/small-logo.png',
          category: 'academy',
          group: 'academy',
          isUnlocked: false,
          awardedAt: null,
          requirements: [],
        },
      ],
      academy: { completed: ACADEMY_DONE, total: ACADEMY_TOTAL },
      engagement: { hasProject: false, hasHackathonParticipation: false, hasUsedConsole: true },
      referralCount: 0,
      bhSignupCode: null,
      bhSignupShareUrl: null,
      referralLinks: [],
      referralTargets: [],
      totalBuilders: 0,
      origin: '',
    },
    'GET /api/profile/console-history': {
      items: [
        {
          id: 'console:1',
          source: 'console',
          status: 'success',
          title: 'Chain created',
          detail: null,
          network: 'testnet',
          createdAt: '2026-10-01T12:00:00.000Z',
          href: null,
          hash: null,
          address: null,
        },
      ],
      nextCursor: null,
    },
    'GET /api/profile/query-boards': {
      boards: [
        {
          id: 'pg-board',
          name: 'C-Chain fees',
          scope: 'mainnet:c-chain',
          network: 'mainnet',
          chain: 'c-chain',
          chainLabel: 'C-Chain',
          networkLabel: 'Mainnet',
          tiles: 1,
          charts: 1,
          updatedAt: '2026-10-01T12:00:00.000Z',
          href: '/explorer/mainnet/c-chain/query/boards/pg-board',
        },
      ],
    },
  };
}
