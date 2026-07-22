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
      // marker: the popover CSS lays four-item menus out as a 2x2 grid
      menu: { className: 'nav-grid-2' },
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
      "Explore blocks, transactions, and addresses across Avalanche L1s.",
    },
    {
      icon: <Network />,
      text: "P-Chain Explorer",
      url: "/explorer/mainnet/p-chain",
      description:
      "Blocks, transactions, UTXOs, validators, and staking on the Avalanche P-Chain.",
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
      text: "Avalanche L1 Stats",
      url: "/stats/overview",
      description:
      "The latest metrics for every Avalanche L1 in the network.",
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
      url: "/stats/validators/c-chain",
      description:
      "The latest metrics for Primary Network validators.",
    },
    {
      icon: <Flame />,
      text: <span className="inline-flex items-center gap-2">AVAX Burners<span className="text-[10px] font-bold uppercase tracking-wider bg-red-500 text-white px-1.5 py-0.5 rounded">New</span></span>,
      url: "/stats/dapps/treemap",
      description:
      "Which protocols burn the most AVAX on the C-Chain.",
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
          docsHref='/docs/primary-network'
          learnHref='/academy?path=blockchain'
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
          learnHref='/academy?path=avalanche-l1'
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
          docsHref='/docs/nodes'
          learnHref='/academy/avalanche-l1/permissionless-l1s'
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
          docsHref='/docs/tooling'
          learnHref='/academy/blockchain/solidity-foundry'
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
