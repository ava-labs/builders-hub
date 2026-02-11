/**
 * Shared navigation configuration - Single Source of Truth
 *
 * This file defines navigation items in a simple format that can be used by:
 * - Mobile dropdown (navbar-dropdown.tsx)
 * - Desktop nav (via transformation to fumadocs format in layout.config.tsx)
 *
 * IMPORTANT: When adding/removing nav items, update this file ONLY.
 * Both mobile and desktop navigation will automatically sync.
 */

export interface NavItem {
  text: string;
  href: string;
  external?: boolean;
}

export interface NavSection {
  title: string;
  href: string;
  items: NavItem[];
}

/**
 * Navigation sections with dropdown menus
 * These appear as expandable sections in mobile and dropdown menus on desktop
 */
export const menuSections: NavSection[] = [
  {
    title: 'Academy',
    href: '/academy',
    items: [
      { text: 'Avalanche L1 Academy', href: '/academy/avalanche-l1' },
      { text: 'Entrepreneur Academy', href: '/academy/entrepreneur' },
      { text: 'Blockchain Academy', href: '/academy/blockchain' },
    ],
  },
  {
    title: 'Documentation',
    href: '/docs/primary-network',
    items: [
      { text: 'Primary Network', href: '/docs/primary-network' },
      { text: 'Nodes & Validators', href: '/docs/nodes' },
      { text: 'Data APIs', href: '/docs/api-reference/data-api' },
      { text: 'ACPs', href: '/docs/acps' },
      { text: 'Developer Tools', href: '/docs/tooling' },
    ],
  },
  {
    title: 'Chat',
    href: '/chat',
    items: [
      { text: 'Ask AI', href: '/chat' },
    ],
  },
  {
    title: 'Console',
    href: '/console',
    items: [
      { text: 'Console', href: '/console' },
      { text: 'Interchain Messaging Tools', href: '/console/icm/setup' },
      { text: 'Interchain Token Transfer Tools', href: '/console/ictt/setup' },
      { text: 'Testnet Faucet', href: '/console/primary-network/faucet' },
    ],
  },
  {
    title: 'Events',
    href: '/hackathons',
    items: [
      { text: 'Hackathons', href: '/hackathons' },
      { text: 'BuildGames', href: '/build-games' },
      { text: 'Community Driven Events', href: 'https://lu.ma/Team1?utm_source=builder_hub', external: true },
      { text: 'Campus Connect', href: '/university' },
    ],
  },
  {
    title: 'Grants',
    href: '/grants',
    items: [
      { text: 'Codebase', href: '/codebase' },
      { text: 'InfraBUIDL', href: '/grants/infrabuidl' },
      { text: 'InfraBUIDL (AI)', href: '/grants/infrabuidlai' },
      { text: 'Retro9000', href: 'https://retro9000.avax.network', external: true },
      { text: 'Blizzard Fund', href: 'https://www.blizzard.fund/', external: true },
    ],
  },
  {
    title: 'Blog',
    href: '/guides',
    items: [
      { text: 'Latest Articles', href: '/guides' },
      { text: 'Browse All Posts', href: '/guides' },
    ],
  },
  {
    title: 'Stats',
    href: '/stats/overview',
    items: [
      { text: 'Playground', href: '/stats/playground' },
      { text: 'Avalanche L1s', href: '/stats/overview' },
      { text: 'C-Chain', href: '/stats/l1/c-chain' },
      { text: 'Validators', href: '/stats/validators' },
    ],
  },
  {
    title: 'Integrations',
    href: '/integrations',
    items: [
      { text: 'Wallet SDKs', href: '/integrations#Wallet%20SDKs' },
      { text: 'Block Explorers', href: '/integrations#Block%20Explorers' },
      { text: 'Blockchain-as-a-Service', href: '/integrations#Blockchain%20as%20a%20Service' },
      { text: 'Data Feeds', href: '/integrations#Data%20Feeds' },
      { text: 'Indexers', href: '/integrations#Indexers' },
      { text: 'Browse All Integrations', href: '/integrations' },
    ],
  },
];

/**
 * Single navigation items (no dropdown)
 * These appear as simple links in both mobile and desktop navigation
 */
export const singleItems: NavItem[] = [
  { text: 'Explorer', href: '/explorer' },
];
