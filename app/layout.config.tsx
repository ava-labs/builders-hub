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
        className: 'md:row-span-2 lg:col-span-1',
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
        'Validator-only L1s with operator-controlled data residency.',
      url: '/solutions/privacy',
      menu: {
        className: 'lg:col-start-3 lg:row-start-1',
      },
    },
    {
      icon: <ShieldCheck />,
      text: 'Compliance',
      description:
        'Permissioning enforced on-chain with allowlist precompiles.',
      url: '/solutions/compliance',
      menu: {
        className: 'lg:col-start-3 lg:row-start-2',
      },
    },
    {
      icon: <Blocks />,
      text: 'Design Patterns',
      description:
        'Real-world institutional builds that compose the guarantees into one architecture.',
      url: '/solutions/design-patterns',
      menu: {
        className: 'md:row-span-2 lg:col-start-4 lg:row-span-2 dp-solutions-anchor',
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
        'Retro9000, research grants, and the Blizzard Fund for your project.',
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
      icon: <Computer />,
      text: 'Nodes & Validators',
      description:
        'Set up, configure, and maintain Avalanche nodes and validators.',
      url: '/docs/nodes',
      menu: {
        className: 'lg:col-start-2 lg:row-start-1',
      },
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
      icon: <Code />,
      text: 'Developer Tools',
      description:
        'Explore the Avalanche SDKs, CLI, and more.',
      url: '/docs/tooling',
      menu: {
        className: 'lg:col-start-2 lg:row-start-3',
      },
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
    },
    {
      icon: <SendHorizontal />,
      text: 'Interchain Messaging Tools',
      description:
        'Set up Interchain Messaging (ICM) for your L1.',
      url: '/console/icm/setup',
    },
    {
      icon: <ArrowLeftRight />,
      text: 'Interchain Token Transfer Tools',
      description:
        'Set up cross-L1 bridges with Interchain Token Transfer.',
      url: '/console/ictt/setup',
    },
    {
      icon: <HandCoins />,
      text: 'Testnet Faucet',
      description:
        'Claim Fuji AVAX to test your dApps.',
      url: '/console/primary-network/faucet',
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
