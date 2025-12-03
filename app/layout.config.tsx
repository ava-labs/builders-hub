import { type LinkItemType } from 'fumadocs-ui/layouts/docs';
import { MainItemType, type BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { AvalancheLogo } from '@/components/navigation/avalanche-logo';
import {
  Sprout,
  Logs,
  ArrowUpRight,
  SendHorizontal,
  Bot,
  Computer,
  Cpu,
  Snowflake,
  BriefcaseBusiness,
  MessageSquareQuote,
  Hexagon,
  Waypoints,
  HandCoins,
  Network,
  Wallet,
  Search,
  Cloud,
  Database,
  ListFilter,
  Ticket,
  Earth,
  ArrowLeftRight,
  Triangle,
  GraduationCap,
  BookOpen,
  Code,
  GitBranch,
  DraftingCompass,
} from 'lucide-react';
import Image from 'next/image';
import { UserButtonWrapper } from '@/components/login/user-button/UserButtonWrapper';

export const integrationsMenu: LinkItemType = {
  type: 'menu',
  text: 'Integrations',
  url: '/integrations',
  items: [
    {
      icon: <Wallet />,
      text: 'Wallet SDKs',
      description:
        'Explore solutions for implementing wallet SDKs in your dApps.',
      url: '/integrations#Wallet%20SDKs',
      menu: {
        className: 'lg:col-start-1',
      },
    },
    {
      icon: <Search />,
      text: 'Block Explorers',
      description:
        'Tools to analyze and track blockchain transactions and activities.',
      url: '/integrations#Block%20Explorers',
      menu: {
        className: 'lg:col-start-2',
      },
    },
    {
      icon: <Cloud />,
      text: 'Blockchain-as-a-Service',
      description:
        'Managed solutions for deploying and managing your Avalanche L1s.',
      url: '/integrations#Blockchain%20as%20a%20Service',
      menu: {
        className: 'lg:col-start-3',
      },
    },
    {
      icon: <Database />,
      text: 'Data Feeds',
      description:
        'Access reliable oracle data feeds for your smart contracts.',
      url: '/integrations#Data%20Feeds',
      menu: {
        className: 'lg:col-start-1 lg:row-start-2',
      },
    },
    {
      icon: <ListFilter />,
      text: 'Indexers',
      description:
        'Index and query blockchain data efficiently for your applications.',
      url: '/integrations#Indexers',
      menu: {
        className: 'lg:col-start-2 lg:row-start-2',
      },
    },
    {
      icon: <ArrowUpRight />,
      text: 'Browse All Integrations',
      description:
        'Discover all available integrations in the Avalanche ecosystem.',
      url: '/integrations',
      menu: {
        className: 'lg:col-start-3 lg:row-start-2',
      },
    },
  ],
};

export const blogMenu: LinkItemType = {
  type: 'menu',
  text: 'Blog',
  url: '/guides',
  items: [
    {
      icon: <BookOpen />,
      text: 'Latest Articles',
      description:
        'Read the latest guides, tutorials, and insights from the Avalanche ecosystem.',
      url: '/guides',
    },
    {
      icon: <ArrowUpRight />,
      text: 'Browse All Posts',
      description:
        'Explore our complete collection of articles, guides, and community content.',
      url: '/guides',
      menu: {
        className: 'lg:col-start-2',
      },
    },
  ],
};

export const stats: LinkItemType = {
  type: "menu",
  text: "Stats",
  url: "/stats/overview",
  items: [
    {
      menu: {
        banner: (
          <div className='-mx-3 -mt-3'>
            <Image
              src="/builderhub-playground.png"
              alt='Playground Preview'
              width={500}
              height={140}
              className='rounded-t-lg object-cover'
              style={{
                maskImage: 'linear-gradient(to bottom,white 60%,transparent)',
              }}
            />
          </div>
        ),
        className: 'md:row-span-2 lg:col-span-1',
      },
      icon: <DraftingCompass />,
      text: "Playground",
      url: "/stats/playground",
      description:
      "Create and customize multiple charts with real-time chain metrics.",
    },
    {
      icon: <Logs />,
      text: "Avalanche L1s",
      url: "/stats/overview",
      description:
      "View the latest metrics for all Avalanche L1s in the network.",
      menu: {
        className: 'lg:col-start-2 lg:row-start-1',
      },
    },
    {
      icon: <Network />,
      text: "C-Chain",
      url: "/stats/l1/c-chain",
      description:
      "View the latest metrics for the Avalanche C-Chain.",
      menu: {
        className: 'lg:col-start-2 lg:row-start-2',
      },
    },
    {
      icon: <Hexagon />,
      text: "Primary Network Validators",
      url: "/stats/validators",
      description:
      "View the latest metrics for the Avalanche Primary Network validators.",
      menu: {
        className: 'lg:col-start-3 lg:row-start-1',
      },
    },
  ],
};

export const explorerMenu: MainItemType = {
  type: "main",
  text: "Explorer",
  url: "/explorer"
};

export const docsMenu: LinkItemType = {
  type: 'menu',
  text: 'Documentation',
  url: '/docs/primary-network',
  items: [
    {
      menu: {
        banner: (
          <div className='-mx-3 -mt-3'>
            <Image
               src="https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/course-banner/multi-chain-architecture-lFotxOCNkXx0jUw9EGIaxnfdyuTb9G.jpg"
               alt='Preview'
               width={900}
               height={400}
              className='rounded-t-lg object-cover  w-full h-auto'
              style={{
                maskImage: 'linear-gradient(to bottom,white 60%,transparent)',
              }}
            />
          </div>
        ),
        className: 'md:row-span-2',
      },
      icon: <Sprout />,
      text: 'Primary Network',
      description: 'Connect to Avalanche and start building dApps',
      url: '/docs/primary-network',
    },
    {
      icon: <Computer />,
      text: 'Node RPCs',
      description:
        "Explore the RPC Methods for the C-Chain, P-Chain, and X-Chain.",
      url: '/docs/rpcs/c-chain',
      menu: {
        className: 'lg:col-start-2',
      },
    },
    {
      icon: <Database />,
      text: 'Data APIs',
      description:
        'Explore the Data, Metrics, and Webhook APIs for the C-Chain, P-Chain, and X-Chain.',
      url: '/docs/api-reference/data-api',
      menu: {
        className: 'lg:col-start-2',
      },
    },
    {
      icon: <GitBranch />,
      text: 'ACPs',
      description:
        "Explore Avalanche's Community Proposals (ACPs) for network improvements and best practices.",
      url: '/docs/acps',
      menu: {
        className: 'lg:col-start-3 lg:row-start-1',
      },
    },
    {
      icon: <Code />,
      text: 'Developer Tools',
      description:
        'Explore the Avalanche SDKs, CLI, and more.',
      url: '/docs/tooling',
      menu: {
        className: 'lg:col-start-3 lg:row-start-2',
      },
    },
    // {
    //   icon: <ArrowUpRight />,
    //   text: 'Browse All Tools',
    //   description:
    //     'Explore all available developer tools in the Avalanche ecosystem.',
    //   url: '/docs/tooling',
    // },
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
          <div className='-mx-3 -mt-3'>
            <Image
              src={"https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/course-banner/avalanche-fundamentals-skz9GZ84gSJ7MPvkSrbiNlnK5F7suB.jpg"}
              alt='Preview'
              width={900}
              height={400}
              className='rounded-t-lg object-cover w-full h-auto'
              style={{
                maskImage: 'linear-gradient(to bottom,white 60%,transparent)',
              }}
            />
          </div>
        ),
        className: 'md:row-span-2',
      },
      icon: <Sprout />,
      text: 'Avalanche L1 Academy',
      description:
        'Master blockchain development with comprehensive courses on Avalanche fundamentals, L1s, and advanced topics',
      url: '/academy?path=avalanche-l1',
    },
    {
      menu: {
        banner: (
          <div className='-mx-3 -mt-3'>
            <Image
              src={"https://qizat5l3bwvomkny.public.blob.vercel-storage.com/Codebase-Entrepreneur-Academy-banner.png"}
              alt='Entrepreneur Academy'
              width={900}
              height={400}
              className='rounded-t-lg object-cover w-full h-auto'
              style={{
                maskImage: 'linear-gradient(to bottom,white 60%,transparent)',
              }}
            />
          </div>
        ),
        className: 'md:row-span-2 lg:col-start-2',
      },
      icon: <BriefcaseBusiness />,
      text: 'Entrepreneur Academy',
      description:
        'Transform from builder to founder with courses on business fundamentals, fundraising, and go-to-market strategies',
      url: '/academy?path=entrepreneur',
    },
    {
      menu: {
        banner: (
          <div className='-mx-3 -mt-3'>
            <Image
              src="https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/course-banner/customizing-evm-DkMcINMgCwhkuHuumtAZtrPzROU74M.jpg"
              alt='Blockchain Academy'
              width={900}
              height={400}
              className='rounded-t-lg object-cover w-full h-auto'
              style={{
                maskImage: 'linear-gradient(to bottom,white 60%,transparent)',
              }}
            />
          </div>
        ),
        className: 'md:row-span-2 lg:col-start-3',
      },
      icon: <GraduationCap />,
      text: 'Blockchain Academy',
      description:
        'Build a rock-solid foundation in blockchain fundamentals, smart contracts, and privacy-preserving tech.',
      url: '/academy?path=blockchain',
    },
  ],
};

export const consoleMenu: LinkItemType = {
  type: 'menu',
  text: 'Console',
  url: '/console',
  items: [
    {
      menu: {
        banner: (
          <div className='-mx-3 -mt-3'>
            <Image
              src="/builderhub-console.png"
              alt='L1 Launcher Preview'
              width={500}
              height={140}
              className='rounded-t-lg object-cover'
              style={{
                maskImage: 'linear-gradient(to bottom,white 60%,transparent)',
              }}
            />
          </div>
        ),
        className: 'md:row-span-2 lg:col-span-1',
      },
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
      menu: {
        className: 'lg:col-start-2 lg:row-start-1',
      },
    },
    {
      icon: <ArrowLeftRight />,
      text: 'Interchain Token Transfer Tools',
      description:
        'Set up cross-L1 bridges using the Interchain Token Transfer protocol.',
      url: '/console/ictt/setup',
      menu: {
        className: 'lg:col-start-2 lg:row-start-2',
      },
    },
    {
      icon: <HandCoins />,
      text: 'Testnet Faucet',
      description:
        'Claim Fuji AVAX tokens from the testnet faucet to test your dApps.',
      url: '/console/primary-network/faucet',
      menu: {
        className: 'lg:col-start-3 lg:row-start-1',
      },
    }
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
          <div className='-mx-3 -mt-3'>
            <Image
              src={"https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/nav-banner/codebase-banner-VKmQyN5sPojnIOU09p0lCkUgR6YTpQ.png"}
              alt='Preview'
              width={900}
              height={400}
              className='rounded-t-lg object-cover w-full h-auto'
              style={{
                maskImage: 'linear-gradient(to bottom,white 60%,transparent)',
              }}
            />
          </div>
        ),
        className: 'md:row-span-2',
      },
      icon: <BriefcaseBusiness />,
      text: 'Codebase',
      description:
        'We help transform good ideas into great web3 companies & ambitious builders into extraordinary founders.',
      url: '/codebase',
    },
    {
      icon: <Cpu />,
      text: 'InfraBUIDL',
      description:
        "Strengthening Avalanche's infrastructure. Build the foundation for next-gen blockchain applications.",
      url: '/grants/infrabuidl',
      menu: {
        className: 'lg:col-start-2',
      },
    },
    {
      icon: <Bot />,
      text: 'InfraBUIDL (AI)',
      description:
        'Supports projects that fuse artificial intelligence (AI) with decentralized infrastructure.',
      url: '/grants/infrabuidlai',
      menu: {
        className: 'lg:col-start-2',
      },
    },
    {
      icon: <MessageSquareQuote />,
      text: 'Retro9000',
      description:
        'Build innovative projects on Avalanche. Get rewarded for your creativity.',
      url: 'https://retro9000.avax.network',
      menu: {
        className: 'lg:col-start-3 lg:row-start-1',
      },
    },
    {
      icon: <Snowflake />,
      text: 'Blizzard Fund',
      description:
        'A $200M+ fund investing in promising Avalanche projects. Fuel your growth with institutional support.',
      url: 'https://www.blizzard.fund/',
      menu: {
        className: 'lg:col-start-3',
      },
    },
  ],
};

export const universityMenu: LinkItemType = {
  type: 'main',
  text: 'University',
  url: '/university',
};

export const eventsMenu: LinkItemType = {
  type: 'menu',
  text: 'Events',
  url: '/events',
  items: [
    {
      menu: {
        banner: (
          <div className='-mx-3 -mt-3'>
            <Image
              src={"https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/nav-banner/hackathons-banner-nyqtkzooc3tJ4qcLjfLJijXz6uJ6oH.png"}
              alt='Preview'
              width={900}
              height={400}
              className='rounded-t-lg object-cover w-full h-auto'
              style={{
                maskImage: 'linear-gradient(to bottom,white 60%,transparent)',
              }}
            />
          </div>
        ),
        className: 'md:row-span-2',
      },
      icon: <Ticket />,
      text: 'Hackathons',
      description:
        'The hackathons aims to harness the potential of Avalanche´s robust technology stack to address pressing issues and create scalable, practical solutions.',
      url: '/hackathons',
    },
    {
      menu: {
        banner: (
          <div className='-mx-3 -mt-3'>
            <Image
              src={"https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/nav-banner/local_events_team1-UJLssyvek3G880Q013A94SdMKxiLRq.jpg"}
              alt='Preview'
              width={900}
              height={400}
              className='rounded-t-lg object-cover w-full h-auto'
              style={{
                maskImage: 'linear-gradient(to bottom,white 60%,transparent)',
              }}
            />
          </div>
        ),
        className: 'md:row-span-2',
      },
      icon: <Earth />,
      text: 'Community driven events',
      description:
        'Check out and join the global meetups, workshops and events organized by Avalanche Team1',
      url: 'https://lu.ma/Team1?utm_source=builder_hub',
    },
    {
      icon: <Ticket />,
      text: 'Avalanche Calendar',
      description:
        'Explore upcoming Avalanche events, meetups, and community gatherings. Stay connected with the latest happenings in the ecosystem.',
      url: 'https://lu.ma/calendar/cal-Igl2DB6quhzn7Z4',
      menu: {
        className: 'lg:col-start-3 lg:row-start-1',
      },
    },
    {
      icon: <GraduationCap />,
      text: 'Campus Connect',
      description:
        'Discover opportunities for students and educators to explore blockchain technology and join our community of builders.',
      url: '/university',
      menu: {
        className: 'lg:col-start-3 lg:row-start-2',
      },
    },
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
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <AvalancheLogo className="size-7" fill="currentColor" />
        <span style={{ fontSize: "large", marginTop: "4px" }}>Builder Hub</span>
      </div>
    ),
  },
  links: [
    academyMenu,
    blogMenu,
    consoleMenu,
    docsMenu,
    eventsMenu,
    explorerMenu,
    grantsMenu,
    integrationsMenu,
    stats,
    userMenu
  ],
};
