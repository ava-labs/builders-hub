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
      { text: 'Why Avalanche', href: '/solutions', image: '/nav/solutions.webp' },
      { text: 'Interoperability', href: '/solutions/interoperability' },
      { text: 'Performance', href: '/solutions/performance' },
      { text: 'Privacy', href: '/solutions/privacy' },
      { text: 'Compliance', href: '/solutions/compliance' },
    ],
  },
  {
    title: 'Developers',
    href: '/docs/primary-network',
    items: [
      { text: 'Documentation', href: '/docs/primary-network', image: '/nav/documentation.webp' },
      { text: 'Academy', href: '/academy', image: '/nav/academy-fundamentals.webp' },
    ],
  },
  {
    // The faucet is the most tapped link of the phone menu, so it gets the second card.
    title: 'Console',
    href: '/console',
    items: [
      { text: 'Console', href: '/console', image: '/nav/console.webp' },
      { text: 'Testnet Faucet', href: '/console/primary-network/faucet', image: '/nav/faucet.webp' },
    ],
  },
  {
    title: 'Explorer',
    href: '/explorer/mainnet',
    items: [
      { text: 'Block Explorer', href: '/explorer/mainnet', image: '/nav/explorer.webp' },
      { text: 'Query', href: '/explorer/mainnet/query' },
      { text: 'C-Chain Explorer', href: '/explorer/mainnet/c-chain' },
      { text: 'Validators', href: '/explorer/mainnet/p-chain/validators' },
      { text: 'Validator Alerts', href: '/validator-alerts' },
    ],
  },
  {
    // The card opens the /ecosystem overview, which lists the links this section leaves out.
    // One-word labels fit the column beside the card on a 360px phone.
    title: 'Ecosystem',
    href: '/ecosystem',
    items: [
      { text: 'Overview', href: '/ecosystem', image: '/nav/ecosystem.webp' },
      { text: 'Events', href: '/events' },
      { text: 'Grants', href: '/grants' },
      { text: 'Audits', href: '/audits', badge: 'New' },
      { text: 'Integrations', href: '/integrations' },
    ],
  },
];

/**
 * Single navigation items (no dropdown)
 * These appear as simple links in both mobile and desktop navigation
 */
export const singleItems: NavItem[] = [];
