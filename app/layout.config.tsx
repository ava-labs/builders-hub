import { type LinkItemType } from 'fumadocs-ui/layouts/docs';
import { type BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { AvalancheLogo } from '@/components/navigation/avalanche-logo';
import { Sprout, Logs, MonitorCheck, ArrowUpRight, SendHorizontal, Cable, Bot, Cpu, Cog, Snowflake, BriefcaseBusiness, MessageSquareQuote, Server, Github, Waypoints, HandCoins, HardDrive, Wallet, Search, Cloud, Database, ListFilter, Ticket, Earth } from 'lucide-react';
import Image from 'next/image';
import Preview9000 from '@/public/nav-banner/9000-logo.png';
import CoursePreview from '@/public/nav-banner/course-preview.png';
import CodebaseBanner from '@/public/nav-banner/codebase-banner.png';
import SummitLondonBanner from '@/public/nav-banner/avalanche_summit_london.png';
import HackathonLondonBanner from '@/public/nav-banner/hackathon_luma.png';
import Team1Banner from '@/public/nav-banner/local_events_team1.jpg';
import L1LauncherPreview from '@/public/nav-banner/l1-launcher-preview.png';

export const integrationsMenu: LinkItemType = {
    type: 'menu',
    text: 'Integrations',
    url: '/integrations',
    items: [
      {
        icon: <Wallet />,
        text: 'Account Abstraction',
        description: "Explore solutions for implementing account abstraction in your dApps.",
        url: '/integrations#Account%20Abstraction',
        menu: {
          className: 'lg:col-start-1',
        },
      },
      {
        icon: <Search />,
        text: 'Block Explorers',
        description: "Tools to analyze and track blockchain transactions and activities.",
        url: '/integrations#Block%20Explorers',
        menu: {
          className: 'lg:col-start-2',
        },
      },
      {
        icon: <Cloud />,
        text: 'Blockchain-as-a-Service',
        description: "Managed solutions for deploying and managing your Avalanche L1s.",
        url: '/integrations#Blockchain%20as%20a%20Service',
        menu: {
          className: 'lg:col-start-3',
        },
      },
      {
        icon: <Database />,
        text: 'Data Feeds',
        description: "Access reliable oracle data feeds for your smart contracts.",
        url: '/integrations#Data%20Feeds',
        menu: {
          className: 'lg:col-start-1 lg:row-start-2',
        },
      },
      {
        icon: <ListFilter />,
        text: 'Indexers',
        description: "Index and query blockchain data efficiently for your applications.",
        url: '/integrations#Indexers',
        menu: {
          className: 'lg:col-start-2 lg:row-start-2',
        },
      },
      {
        icon: <ArrowUpRight />,
        text: 'Browse All Integrations',
        description: "Discover all available integrations in the Avalanche ecosystem.",
        url: '/integrations',
        menu: {
          className: 'lg:col-start-3 lg:row-start-2',
        },
      },
    ],
  };

export const docsMenu: LinkItemType = {
  type: 'menu',
  text: 'Documentation',
  url: '/docs',
  items: [
    {
      menu: {
        banner: (
          <div className="-mx-3 -mt-3">
            <Image
              src={Preview9000}
              alt="Preview"
              className="rounded-t-lg object-cover"
              style={{
                maskImage:
                  'linear-gradient(to bottom,white 60%,transparent)',
              }}
            />
          </div>
        ),
        className: 'md:row-span-2',
      },
      icon: <Sprout />,
      text: 'Avalanche Protocol',
      description: 'Learn about the Avalanche Protocol',
      url: '/docs/quick-start',
    },
    {
      icon: <Logs />,
      text: 'Avalanche L1s',
      description: "Build your own sovereign Layer 1 blockchain using Avalanche's battle-tested infrastructure and tooling.",
      url: '/docs/avalanche-l1s',
      menu: {
        className: 'lg:col-start-2',
      },
    },
    {
      icon: <MonitorCheck />,
      text: 'Nodes & Validators',
      description: 'Learn about hardware requirements, staking mechanisms, rewards, and best practices for running validator infra on Avalanche.',
      url: '/docs/nodes',
      menu: {
        className: 'lg:col-start-2',
      },
    },
    {
      icon: <Cable />,
      text: 'Interoperability',
      description: "Explore Avalanche's native cross-chain protocols that enable seamless asset and data transfer across different Avalanche L1s.",
      url: '/docs/cross-chain',
      menu: {
        className: 'lg:col-start-3 lg:row-start-1',
      },
    },
    {
      icon: <ArrowUpRight />,
      text: 'Browse All Docs',
      description: "Explore our in-depth documentation, guides, and resources to bring your ideas to life.",
      url: '/docs',
      menu: {
        className: 'lg:col-start-3',
      },
    },
  ],
};

export const academyMenu: LinkItemType = {
  type: 'menu',
  text: 'Academy',
  url: '/academy',
  items: [
    {
      menu: {
        banner: (
          <div className="-mx-3 -mt-3">
            <Image
              src={CoursePreview}
              alt="Preview"
              className="rounded-t-lg object-cover"
              style={{
                maskImage:
                  'linear-gradient(to bottom,white 60%,transparent)',
              }}
            />
          </div>
        ),
        className: 'md:row-span-2',
      },
      icon: <Sprout />,
      text: 'Avalanche Fundamentals',
      description: 'Get a high level overview of Avalanche Consensus, L1s and VMs',
      url: '/academy/avalanche-fundamentals',
    },
    {
      icon: <Logs />,
      text: 'Multi-Chain Architecture',
      description: "Dive deeper into Avalanche's multi-chain architecture and deploy your own Blockchain.",
      url: '/academy/multi-chain-architecture',
      menu: {
        className: 'lg:col-start-2',
      },
    },
    {
      icon: <Cpu />,
      text: 'Customizing the EVM',
      description: "Learn how to customize the Ethereum Virtual Machine and add your own custom precompiles.",
      url: '/academy/customizing-evm',
      menu: {
        className: 'lg:col-start-2',
      },
    },
    {
      icon: <SendHorizontal />,
      text: 'Avalanche Interchain Messaging',
      description: "Utilize Avalanche Interchain Messaging to build cross-chain dApps in the Avalanche ecosystem.",
      url: '/academy/interchain-messaging',
      menu: {
        className: 'lg:col-start-3 lg:row-start-1',
      },
    },
    {
      icon: <ArrowUpRight />,
      text: 'Check All Courses',
      description: "Supercharge your learning journey with expert-curated courses offered by Avalanche Academy and earn certificates.",
      url: '/academy',
      menu: {
        className: 'lg:col-start-3',
      },
    },
  ],
};

export const toolsMenu: LinkItemType = {
  type: 'menu',
  text: 'Tools',
  url: '/tools',
  items: [
    {
      menu: {
        banner: (
          <div className="-mx-3 -mt-3">
            <Image
              src={L1LauncherPreview}
              alt="L1 Launcher Preview"
              className="rounded-t-lg object-cover"
              style={{
                maskImage: 'linear-gradient(to bottom,white 60%,transparent)',
              }}
            />
          </div>
        ),
        className: 'md:row-span-2 lg:col-span-1',
      },
      icon: <Server />,
      text: 'L1 Launcher (Beta)',
      description: 'Launch your self-hosted Testnet or Mainnet L1 on your own infrastructure.',
      url: '/tools/l1-launcher',
    },
    {
      icon: <Waypoints />,
      text: 'L1 Toolbox (Beta)',
      description: 'Manage your L1 with a highly granular set of tools.',
      url: '/tools/l1-toolbox',
      menu: {
        className: 'lg:col-start-2 lg:row-start-1',
      },
    },
    {
      icon: <HandCoins />,
      text: 'Testnet Faucet',
      description: 'Claim Fuji AVAX tokens from the testnet faucet to test your dApps.',
      url: 'https://core.app/tools/testnet-faucet/?subnet=c&token=c',
      menu: {
        className: 'lg:col-start-2 lg:row-start-2',
      },
    },
    {
      icon: <Github />,
      text: 'Avalanche Starter Kit',
      description: "Spin up short-lived test environments for building dApps using interoperability features like ICM and ICTT.",
      url: 'https://github.com/ava-labs/avalanche-starter-kit',
      menu: {
        className: 'lg:col-start-3 lg:row-start-1',
      },
    },
    {
      icon: <HardDrive />,
      text: 'PoA Validator Management (Beta)',
      description: 'Manage your validator set from the web.',
      url: '/tools/poa-validator-management',
      menu: {
        className: 'lg:col-start-3 lg:row-start-2',
      },
    },
  ],
};

export const grantsMenu: LinkItemType = {
  type: 'menu',
  text: 'Grants',
  url: '/grants',
  items: [
    {
      menu: {
        banner: (
          <div className="-mx-3 -mt-3">
            <Image
              src={CodebaseBanner}
              alt="Preview"
              className="rounded-t-lg object-cover"
              style={{
                maskImage:
                  'linear-gradient(to bottom,white 60%,transparent)',
              }}
            />
          </div>
        ),
        className: 'md:row-span-2',
      },
      icon: <BriefcaseBusiness />,
      text: 'Codebase',
      description: 'We help transform good ideas into great web3 companies & ambitious builders into extraordinary founders.',
      url: 'https://codebase.avax.network/',
    },
    {
      icon: <Cpu />,
      text: 'InfraBUIDL',
      description: "Strengthening Avalanche's infrastructure. Build the foundation for next-gen blockchain applications.",
      url: 'https://www.avax.network/infrabuidl-program',
      menu: {
        className: 'lg:col-start-2',
      },
    },
    {
      icon: <Bot />,
      text: 'InfraBUIDL (AI)',
      description: 'Supports projects that fuse artificial intelligence (AI) with decentralized infrastructure.',
      url: 'https://www.avax.network/infrabuidl-ai-program',
      menu: {
        className: 'lg:col-start-2',
      },
    },
    {
      icon: <MessageSquareQuote />,
      text: 'Retro9000',
      description: "Build innovative projects on Avalanche. Get rewarded for your creativity.",
      url: 'https://retro9000.avax.network/',
      menu: {
        className: 'lg:col-start-3 lg:row-start-1',
      },
    },
    {
      icon: <Snowflake />,
      text: 'Blizzard Fund',
      description: "A $200M+ fund investing in promising Avalanche projects. Fuel your growth with institutional support.",
      url: 'https://www.blizzard.fund/',
      menu: {
        className: 'lg:col-start-3',
      },
    },
  ],
};

export const eventsMenu: LinkItemType = {
  type: 'menu',
  text: 'Events',
  url: '/events',
  items: [
    {
      menu: {
        banner: (
          <div className="-mx-3 -mt-3">
            <Image
              src={SummitLondonBanner}
              alt="Preview"
              className="rounded-t-lg object-cover"
              style={{
                maskImage:
                  'linear-gradient(to bottom,white 60%,transparent)',
              }}
            />
          </div>
        ),
        className: 'md:row-span-2',
      },
      icon: <Ticket />,
      text: 'Avalanche Summit London',
      description: 'Join us for Avalanche Summit, London, as we explore the world’s original global financial hub through the lens of Web3.',
      url: 'https://www.avalanchesummitlondon.com/',
    },
    {
      menu: {
        banner: (
          <div className="-mx-3 -mt-3">
            <Image
              src={HackathonLondonBanner}
              alt="Preview"
              className="rounded-t-lg object-cover"
              style={{
                maskImage:
                  'linear-gradient(to bottom,white 60%,transparent)',
              }}
            />
          </div>
        ),
        className: 'md:row-span-2',
      },
      icon: <Ticket />,
      text: 'Summit Hackathon London',
      description: 'This hackathon aims to harness the potential of Avalanche’s robust technology stack to address pressing issues and create scalable, practical solutions.',
      url: '/hackathon',
    },
    {
      menu: {
        banner: (
          <div className="-mx-3 -mt-3">
            <Image
              src={Team1Banner}
              alt="Preview"
              className="rounded-t-lg object-cover"
              style={{
                maskImage:
                  'linear-gradient(to bottom,white 60%,transparent)',
              }}
            />
          </div>
        ),
        className: 'md:row-span-2',
      },
      icon: <Earth />,
      text: 'Team1 Events',
      description: 'Check out and join the global meetups, workshops and events organized by Avalanche Team1',
      url: 'https://lu.ma/Team1?utm_source=builder_hub',
    },
  ],
};

export const baseOptions: BaseLayoutProps = {
  githubUrl: 'https://github.com/ava-labs/builders-hub',
  nav: {
    title: (
      <>
        {<AvalancheLogo className="size-7" fill="currentColor" />}
        <span style={{ fontSize: "large" }}>Builders Hub</span>
      </>
    )
  },
  links: [
    docsMenu,
    academyMenu,
    toolsMenu,
    grantsMenu,
    eventsMenu,
    integrationsMenu,
  ],
};
