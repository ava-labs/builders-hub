import Image from 'next/image';
import Link from 'next/link';
import { type LinkItemType, type BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { AvalancheLogo } from '@/components/navigation/avalanche-logo';
import {
  SendHorizontal,
  Hexagon,
  Waypoints,
  HandCoins,
  Network,
  Ticket,
  Earth,
  ArrowLeftRight,
  BookOpen,
  DraftingCompass,
  Gamepad2,
  Flame,
  Blocks,
  Search,
  Bell,
  Gauge,
  EyeOff,
  ShieldCheck,
  Landmark,
} from 'lucide-react';
import { UserButtonWrapper } from '@/components/login/user-button/UserButtonWrapper';

export const solutionsMenu: LinkItemType = {
  type: 'menu',
  text: 'Solutions',
  url: '/solutions',
  items: [
    {
      icon: <Landmark />,
      text: 'Why Avalanche',
      description:
        'The guarantees enterprise chains are built on: performance, interoperability, privacy, and compliance.',
      url: '/solutions',
      menu: {
        // featured panel: the image leads, the four pillars stack in the
        // right rail. .nav-featured + the :has() popover rules in global.css.
        className: 'nav-featured lg:col-start-1 lg:row-start-1 lg:row-span-4',
        banner: (
          <Image
            src="/nav/why-avalanche.webp"
            alt="Why Avalanche"
            width={2400}
            height={890}
            className="nav-banner border border-zinc-200 dark:border-zinc-800"
          />
        ),
      },
    },
    {
      icon: <Gauge />,
      text: 'Performance',
      description:
        'Sub-second, irreversible finality on dedicated blockspace.',
      url: '/solutions/performance',
      menu: {
        className: 'lg:col-start-2 lg:row-start-1',
      },
    },
    {
      icon: <ArrowLeftRight />,
      text: 'Interoperability',
      description:
        'Native messaging and asset transfer between public, permissioned, and private chains.',
      url: '/solutions/interoperability',
      menu: {
        className: 'lg:col-start-2 lg:row-start-2',
      },
    },
    {
      icon: <EyeOff />,
      text: 'Privacy',
      description:
        'Privacy configured to your requirements: closed networks, placed data, and the cryptography you choose.',
      url: '/solutions/privacy',
      menu: {
        className: 'lg:col-start-2 lg:row-start-3',
      },
    },
    {
      icon: <ShieldCheck />,
      text: 'Compliance',
      description:
        'Permissioning enforced on-chain with allowlist precompiles.',
      url: '/solutions/compliance',
      menu: {
        className: 'lg:col-start-2 lg:row-start-4',
      },
    },
  ],
};

export const ecosystemMenu: LinkItemType = {
  type: 'menu',
  text: 'Ecosystem',
  items: [
    // grouped columns: events, then programs, then reading and tools
    {
      icon: <Ticket />,
      text: 'Hackathons & Events',
      description:
        'Hands-on learning and real building, from hackathons to workshops and bootcamps.',
      url: '/events',
      menu: { className: 'lg:col-start-1 lg:row-start-1' },
    },
    {
      icon: <Gamepad2 />,
      text: 'Avalanche Summit',
      description:
        "Avalanche's premier gathering for builders and enterprise leaders. NYC, September 16–17.",
      url: 'https://www.avalanchesummit.com',
      menu: { className: 'lg:col-start-1 lg:row-start-2' },
    },
    {
      icon: <Earth />,
      text: 'Community Driven Events',
      description:
        'Global meetups, workshops and events organized by Avalanche Team1.',
      url: 'https://lu.ma/Team1?utm_source=builder_hub',
      menu: { className: 'lg:col-start-1 lg:row-start-3' },
    },
    {
      icon: <HandCoins />,
      text: 'Grants & Funding',
      description:
        'Research grants and the Blizzard Fund for your project.',
      url: '/grants',
      menu: { className: 'lg:col-start-2 lg:row-start-1' },
    },
    {
      icon: <ShieldCheck />,
      text: (
        <span className="inline-flex items-center gap-1.5">
          Security Audits
          <span className="rounded-full border border-brand/40 px-1.5 py-px font-mono text-[9px] uppercase tracking-[0.1em] text-brand dark:border-brand-soft/40 dark:text-brand-soft">
            New
          </span>
        </span>
      ),
      description:
        'Quotes from every vetted firm, free. Subsidized up to 75% by the program.',
      url: '/audits',
      menu: { className: 'lg:col-start-2 lg:row-start-2' },
    },
    {
      icon: <BookOpen />,
      text: 'Blog & Guides',
      description:
        'Read the latest articles, tutorials, and insights from the Avalanche ecosystem.',
      url: '/guides',
      menu: { className: 'lg:col-start-3 lg:row-start-1' },
    },
    {
      icon: <Blocks />,
      text: 'Integrations',
      description:
        'Browse wallet SDKs, block explorers, indexers, data feeds, and more.',
      url: '/integrations',
      menu: { className: 'lg:col-start-3 lg:row-start-2' },
    },
  ],
};

export const explorerMenu: LinkItemType = {
  type: "menu",
  text: "Explorer",
  url: "/explorer/mainnet",
  items: [
    {
      icon: <Search />,
      text: "Block Explorer",
      url: "/explorer/mainnet",
      description:
      "Search any block, tx, address, or node across the P-Chain, C-Chain, and every L1.",
    },
    {
      icon: <Network />,
      text: "L1 Explorers",
      url: "/explorer/mainnet/chains",
      description:
      "Blocks, transactions, and addresses on the C-Chain and every Avalanche L1.",
    },
    {
      icon: <DraftingCompass />,
      text: "Query",
      url: "/explorer/mainnet/query",
      description:
      "Ask a chain a question in plain words and get a chart with its SQL.",
    },
    {
      icon: <Network />,
      text: "C-Chain",
      url: "/explorer/mainnet/c-chain",
      description:
      "Live blocks, transactions, gas and chain stats for the Avalanche C-Chain.",
    },
    {
      icon: <Hexagon />,
      text: "Primary Network Validators",
      url: "/explorer/mainnet/c-chain/validators",
      description:
      "The latest metrics for Primary Network validators.",
    },
    {
      icon: <Flame />,
      text: <span className="inline-flex items-center gap-2">Gas Market<span className="text-[10px] font-bold uppercase tracking-wider bg-red-500 text-white px-1.5 py-0.5 rounded">New</span></span>,
      url: "/explorer/mainnet/c-chain/gas",
      description:
      "The C-Chain gas market: live fees, history, and who burns the most.",
    },
    {
      icon: <Bell />,
      text: "Validator Alerts",
      url: "/validator-alerts",
      description:
      "Get notified about the status and health of your validators.",
    },
  ],
};

export const developersMenu: LinkItemType = {
  type: 'menu',
  text: 'Developers',
  url: '/docs/primary-network',
  items: [
    {
      text: 'Documentation',
      description: 'Reference for the network, nodes, APIs, tools, and ACPs.',
      url: '/docs/primary-network',
      menu: {
        // two featured cards side by side: .nav-featured + .nav-duo in global.css
        className: 'nav-featured nav-duo',
        banner: (
          <Image
            src="/nav/documentation.webp"
            alt=""
            width={1536}
            height={864}
            className="nav-banner border border-zinc-200 dark:border-zinc-800"
          />
        ),
      },
    },
    {
      text: 'Academy',
      description: 'Guided courses, from blockchain fundamentals to launching your own L1.',
      url: '/academy',
      menu: {
        className: 'nav-featured nav-duo',
        banner: (
          <Image
            src="/nav/academy-fundamentals.webp"
            alt=""
            width={1536}
            height={864}
            className="nav-banner border border-zinc-200 dark:border-zinc-800"
          />
        ),
      },
    },
  ],
};

// The Console trigger does not prefetch. A prefetched Console route preloads its
// CSS into the page that holds the navbar, which Chrome reports as preloaded but
// not used on a page without that CSS, such as the home page.
export const consoleMenu: LinkItemType = {
  type: 'menu',
  // the trigger's own Link: a menu url gets a Link that prefetches
  text: (
    <Link href="/console" prefetch={false}>
      Console
    </Link>
  ),
  items: [
    {
      icon: <Waypoints />,
      text: 'Console',
      description: 'Manage your L1 with a highly granular set of tools.',
      url: '/console',
      menu: {
        // featured panel: the image leads, links stack in the right rail.
        // .nav-featured + the :has() popover rules live in global.css.
        className: 'nav-featured lg:col-start-1 lg:row-start-1 lg:row-span-3',
        banner: (
          <Image
            src="/nav/builder-console.png"
            alt="The Builder Console"
            width={1200}
            height={676}
            className="nav-banner border border-zinc-200 dark:border-zinc-800"
          />
        ),
      },
    },
    {
      icon: <SendHorizontal />,
      text: 'Interchain Messaging Tools',
      description:
        'Set up Interchain Messaging (ICM) for your L1.',
      url: '/console/icm/setup',
      menu: { className: 'lg:col-start-2 lg:row-start-1' },
    },
    {
      icon: <ArrowLeftRight />,
      text: 'Interchain Token Transfer Tools',
      description:
        'Set up cross-L1 bridges with Interchain Token Transfer.',
      url: '/console/ictt/setup',
      menu: { className: 'lg:col-start-2 lg:row-start-2' },
    },
    {
      icon: <HandCoins />,
      text: 'Testnet Faucet',
      description:
        'Claim Fuji AVAX to test your dApps.',
      url: '/console/primary-network/faucet',
      menu: { className: 'lg:col-start-2 lg:row-start-3' },
    }
  ],
};

export const userMenu: LinkItemType = {
  type: 'custom',
  children: <UserButtonWrapper />,
  secondary: true,
};

export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <div style={{ display: "flex", alignItems: "center" }} aria-label="Avalanche Builder Hub">
        <AvalancheLogo className="size-7" fill="currentColor" />
      </div>
    ),
  },
  links: [
    solutionsMenu,
    developersMenu,
    consoleMenu,
    explorerMenu,
    ecosystemMenu,
    userMenu
  ],
};