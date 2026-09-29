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
  /** Small "New" style pill next to the label (drop after launch month). */
  badge?: string;
  external?: boolean;
  /** Picture under public/: the item renders as a picture card instead of a text row. */
  image?: string;
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
    title: 'Solutions',
    href: '/solutions',
    items: [
      { text: 'Why Avalanche', href: '/solutions' },
      { text: 'Performance', href: '/solutions/performance' },
      { text: 'Interoperability', href: '/solutions/interoperability' },
      { text: 'Privacy', href: '/solutions/privacy' },
      { text: 'Compliance', href: '/solutions/compliance' },
    ],
  },
  {
    title: 'Developers',
    href: '/docs/primary-network',
    items: [
      { text: 'Docs', href: '/docs/primary-network', image: '/nav/docs.webp' },
      { text: 'Academy', href: '/academy', image: '/nav/academy.webp' },
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
    title: 'Explorer',
    href: '/explorer/mainnet',
    items: [
      { text: 'Block Explorer', href: '/explorer/mainnet' },
      { text: 'Query', href: '/explorer/mainnet/query' },
      { text: 'C-Chain Explorer', href: '/explorer/mainnet/c-chain' },
      { text: 'Validators', href: '/explorer/mainnet/p-chain/validators' },
      { text: 'Validator Alerts', href: '/validator-alerts' },
    ],
  },
  {
    title: 'Ecosystem',
    href: '/events',
    items: [
      { text: 'Hackathons & Events', href: '/events' },
      { text: 'Avalanche Summit', href: 'https://www.avalanchesummit.com', external: true },
      { text: 'Community Driven Events', href: 'https://lu.ma/Team1?utm_source=builder_hub', external: true },
      { text: 'Campus Connect', href: '/university' },
      { text: 'Grants & Funding', href: '/grants' },
      { text: 'Security Audits', href: '/audits', badge: 'New' },
      { text: 'Blog & Guides', href: '/guides' },
      { text: 'Integrations', href: '/integrations' },
    ],
  },
];

/**
 * Single navigation items (no dropdown)
 * These appear as simple links in both mobile and desktop navigation
 */
export const singleItems: NavItem[] = [];
