import { type LinkItemType } from 'fumadocs-ui/layouts/docs';
import { type BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { AvalancheLogo } from '@/components/navigation/avalanche-logo';
import {
  Sprout,
  Logs,
  MonitorCheck,
  ArrowUpRight,
  SendHorizontal,
  Cable,
  Bot,
  Cpu,
  Snowflake,
  BriefcaseBusiness,
  MessageSquareQuote,
  Github,
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
  Shield,
  Triangle,
  GraduationCap,
  BookOpen,
  Users,
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
      text: 'Account Abstraction',
      description:
        'Explore solutions for implementing account abstraction in your dApps.',
      url: '/integrations#Account%20Abstraction',
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
  type: 'main',
  text: 'Blog',
  url: '/guides',
};

export const stats: LinkItemType = {
  type: "menu",
  text: "Stats",
  url: "/stats/overview",
  items: [
    {
      icon: <Logs />,
      text: "Avalanche L1s",
      url: "/stats/overview",
      description:
      "View the latest metrics for all Avalanche L1s in the network.",
    },
    {
      icon: <Network />,
      text: "C-Chain",
      url: "/stats/primary-network/c-chain",
      description:
      "View the latest metrics for the Avalanche C-Chain.",
    },
    {
      icon: <Hexagon />,
      text: "Primary Network Validators",
      url: "/stats/primary-network/validators",
      description:
      "View the latest metrics for the Avalanche Primary Network validators.",
    },
  ],
};

export const docsMenu: LinkItemType = {
  type: 'menu',
  text: 'Docs',
  url: '/docs',
  items: [
    {
      menu: {
        banner: (
          <div className='-mx-3 -mt-3'>
            <Image
               src="https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/course-banner/customizing-evm-DkMcINMgCwhkuHuumtAZtrPzROU74M.jpg"
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
      text: 'Avalanche Protocol',
      description: 'Learn about the Avalanche Protocol',
      url: '/docs/quick-start',
    },
    {
      icon: <Logs />,
      text: 'Avalanche L1s',
      description:
        "Build your own sovereign Layer 1 blockchain using Avalanche's battle-tested infrastructure and tooling.",
      url: '/docs/avalanche-l1s',
      menu: {
        className: 'lg:col-start-2',
      },
    },
    {
      icon: <MonitorCheck />,
      text: 'Nodes & Validators',
      description:
        'Learn about hardware requirements, staking mechanisms, rewards, and best practices for running validator infra on Avalanche.',
      url: '/docs/nodes',
      menu: {
        className: 'lg:col-start-2',
      },
    },
    {
      icon: <Cable />,
      text: 'Interoperability',
      description:
        "Explore Avalanche's native cross-chain protocols that enable seamless asset and data transfer across different Avalanche L1s.",
      url: '/docs/cross-chain',
      menu: {
        className: 'lg:col-start-3 lg:row-start-1',
      },
    },
    {
      icon: <ArrowUpRight />,
      text: 'Browse All Docs',
      description:
        'Explore our in-depth documentation, guides, and resources to bring your ideas to life.',
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
      text: 'Avalanche Developer Academy',
      description:
        'Master blockchain development with comprehensive courses on Avalanche fundamentals, L1s, and advanced topics',
      url: '/academy',
    },
    {
      menu: {
        banner: (
          <div className='-mx-3 -mt-3'>
            <Image
              src={"https://qizat5l3bwvomkny.public.blob.vercel-storage.com/Codebase-Entrepreneur-Academy-banner.png"}
              alt='Codebase Entrepreneur Academy'
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
      text: 'Codebase Entrepreneur Academy',
      description:
        'Transform from builder to founder with courses on business fundamentals, fundraising, and go-to-market strategies',
      url: '/codebase-entrepreneur-academy',
    },
    {
      icon: <Triangle />,
      text: 'Avalanche Fundamentals',
      description:
        'Get a high level overview of Avalanche Consensus, L1s and VMs',
      url: '/academy/avalanche-fundamentals',
      menu: {
        className: 'lg:col-start-3 lg:row-start-1',
      },
    },
    {
      icon: <ArrowUpRight />,
      text: 'Check All Courses',
      description:
        'Supercharge your learning journey with expert-curated courses offered by Avalanche Academy and earn certificates.',
      url: '/academy',
      menu: {
        className: 'lg:col-start-3',
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
              src={"https://qizat5l3bwvomkny.public.blob.vercel-storage.com/Avalanche-Event-8wjhXhApK9YGd5Le4Pkcl9tufb5QDA.jpg"}
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
      text: 'Avalanche Calendar',
      description:
        'Explore upcoming Avalanche events, meetups, and community gatherings. Stay connected with the latest happenings in the ecosystem.',
      url: 'https://lu.ma/calendar/cal-Igl2DB6quhzn7Z4',
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <AvalancheLogo className='size-7' fill='currentColor' />
        <span style={{ fontSize: 'large', marginTop: '4px' }}>Builder Hub</span>
      </div>
    ),
  },
  links: [
    academyMenu,
    docsMenu,
    consoleMenu,
    eventsMenu,
    grantsMenu,
    universityMenu,
    integrationsMenu,
    userMenu,
    blogMenu,
    stats
  ],
};
