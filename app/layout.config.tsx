import Image from 'next/image';
import { type LinkItemType, type BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { AvalancheLogo } from '@/components/navigation/avalanche-logo';
import {
  Sprout,
  Logs,
  SendHorizontal,
  Computer,
  Hexagon,
  Waypoints,
  HandCoins,
  Network,
  Database,
  Ticket,
  Earth,
  ArrowLeftRight,
  BookOpen,
  Code,
  GitBranch,
  DraftingCompass,
  Gamepad2,
  Flame,
  Layers,
  Blocks,
  Search,
  Bell,
  Gauge,
  EyeOff,
  ShieldCheck,
  Landmark,
} from 'lucide-react';
import { UserButtonWrapper } from '@/components/login/user-button/UserButtonWrapper';
import { DocsLearnCard } from '@/components/navigation/docs-learn-card';

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
    {
      icon: <Ticket />,
      text: 'Hackathons & Events',
      description:
        'Hands-on learning and real building, from hackathons to workshops and bootcamps.',
      url: '/events',
    },
    {
      icon: <Gamepad2 />,
      text: 'Avalanche Summit',
      description:
        "Avalanche's premier gathering for builders and enterprise leaders. NYC, September 16–17.",
      url: 'https://www.avalanchesummit.com',
    },
    {
      icon: <Earth />,
      text: 'Community Driven Events',
      description:
        'Global meetups, workshops and events organized by Avalanche Team1.',
      url: 'https://lu.ma/Team1?utm_source=builder_hub',
    },
    {
      icon: <HandCoins />,
      text: 'Grants & Funding',
      description:
        'Research grants and the Blizzard Fund for your project.',
      url: '/grants',
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
    },
  ],
};

export const explorerMenu: LinkItemType = {
  type: "menu",
  text: "Explorer",
  url: "/explorer",
  items: [
    {
      icon: <Search />,
      text: "Block Explorer",
      url: "/explorer",
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
      text: "Playground",
      url: "/stats/playground",
      description:
      "Create and customize charts with real-time chain metrics.",
    },
    {
      icon: <Logs />,
      text: "All Networks",
      url: "/explorer/mainnet",
      description:
      "Live activity, ICM, validators, and AVAX across every Avalanche chain.",
    },
    {
      icon: <Network />,
      text: "C-Chain Stats",
      url: "/stats/l1/c-chain",
      description:
      "The latest metrics for the Avalanche C-Chain.",
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

export const docsMenu: LinkItemType = {
  type: 'menu',
  text: 'Documentation',
  url: '/docs/primary-network',
  items: [
    {
      type: 'custom',
      children: (
        <DocsLearnCard
          className='lg:col-start-1 lg:row-start-1'
          icon={<Sprout />}
          title='Primary Network'
          description='Connect to Avalanche and start building dApps.'
          links={[
            { label: 'Docs', href: '/docs/primary-network' },
            { label: 'Stake AVAX', href: '/console/primary-network/stake' },
          ]}
        />
      ),
    },
    {
      type: 'custom',
      children: (
        <DocsLearnCard
          className='lg:col-start-1 lg:row-start-2'
          icon={<Layers />}
          title='Avalanche L1s'
          description='Launch and customize your own Avalanche L1 blockchain.'
          docsHref='/docs/avalanche-l1s'
          learnHref='/academy/avalanche-l1'
        />
      ),
    },
    {
      type: 'custom',
      children: (
        <DocsLearnCard
          className='lg:col-start-1 lg:row-start-3'
          icon={<ArrowLeftRight />}
          title='Interchain Messaging'
          description='Move messages and assets natively between Avalanche chains.'
          docsHref='/docs/cross-chain'
          learnHref='/academy/avalanche-l1/interchain-messaging'
        />
      ),
    },
    {
      type: 'custom',
      children: (
        <DocsLearnCard
          className='lg:col-start-2 lg:row-start-1'
          icon={<Computer />}
          title='Nodes & Validators'
          description='Set up, configure, and maintain Avalanche nodes and validators.'
          links={[
            { label: 'Docs', href: '/docs/nodes' },
            { label: 'L1 Node Setup', href: '/console/layer-1/l1-node-setup' },
          ]}
        />
      ),
    },
    {
      icon: <Database />,
      text: 'Data APIs',
      description:
        'Explore the Data, Metrics, and Webhook APIs for the C-Chain, P-Chain, and X-Chain.',
      url: '/docs/api-reference/data-api',
      menu: {
        className: 'lg:col-start-2 lg:row-start-2',
      },
    },
    {
      type: 'custom',
      children: (
        <DocsLearnCard
          className='lg:col-start-2 lg:row-start-3'
          icon={<Code />}
          title='Developer Tools'
          description='Explore the Avalanche SDKs, CLI, and more.'
          links={[
            { label: 'SDK', href: '/docs/tooling/avalanche-sdk' },
            { label: 'Platform CLI', href: '/docs/tooling/platform-cli' },
          ]}
        />
      ),
    },
    {
      icon: <BookOpen />,
      text: 'Blog & Guides',
      description:
        'Read the latest articles, tutorials, and insights from the Avalanche ecosystem.',
      url: '/guides',
      menu: {
        className: 'lg:col-start-3 lg:row-start-1',
      },
    },
    {
      icon: <GitBranch />,
      text: 'ACPs',
      description:
        "Explore Avalanche's Community Proposals (ACPs) for network improvements.",
      url: '/docs/acps',
      menu: {
        className: 'lg:col-start-3 lg:row-start-2',
      },
    },
    {
      icon: <Blocks />,
      text: 'Integrations',
      description:
        'Browse wallet SDKs, block explorers, indexers, data feeds, and more.',
      url: '/integrations',
      menu: {
        className: 'lg:col-start-3 lg:row-start-3',
      },
    },
  ],
};

export const consoleMenu: LinkItemType = {
  type: 'menu',
  text: 'Console',
  url: '/console',
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
    docsMenu,
    consoleMenu,
    explorerMenu,
    ecosystemMenu,
    userMenu
  ],
};