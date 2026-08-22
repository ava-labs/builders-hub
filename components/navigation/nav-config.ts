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
    title: 'Documentation',
    href: '/docs/primary-network',
    items: [
      { text: 'Academy', href: '/academy' },
      { text: 'Primary Network', href: '/docs/primary-network' },
      { text: 'Avalanche L1s', href: '/docs/avalanche-l1s' },
      { text: 'Nodes & Validators', href: '/docs/nodes' },
      { text: 'Data APIs', href: '/docs/api-reference/data-api' },
      { text: 'ACPs', href: '/docs/acps' },
      { text: 'Developer Tools', href: '/docs/tooling' },
      { text: 'Integrations', href: '/integrations' },
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
    href: '/explorer',
    items: [
      { text: 'Block Explorer', href: '/explorer' },
      { text: 'Playground', href: '/stats/playground' },
      { text: 'All Networks', href: '/explorer/mainnet' },
      { text: 'C-Chain Explorer', href: '/explorer/mainnet/c-chain' },
      { text: 'Validators', href: '/explorer/mainnet/validators' },
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
    ],
  },
];

/**
 * Single navigation items (no dropdown)
 * These appear as simple links in both mobile and desktop navigation
 */
export const singleItems: NavItem[] = [];
