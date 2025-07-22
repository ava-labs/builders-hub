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
  Cog,
  Snowflake,
  BriefcaseBusiness,
  MessageSquareQuote,
  Github,
  Waypoints,
  HandCoins,
  Wallet,
  Search,
  Cloud,
  Database,
  ListFilter,
  Ticket,
  Earth,
  ArrowLeftRight,
} from 'lucide-react';
import Image from 'next/image';
import { SiGithub } from '@icons-pack/react-simple-icons';
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

export const docsMenu: LinkItemType = {
  type: 'menu',
  text: 'Documentation',
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
      text: 'Avalanche Fundamentals',
      description:
        'Get a high level overview of Avalanche Consensus, L1s and VMs',
      url: '/academy/avalanche-fundamentals',
    },
    {
      icon: <SendHorizontal />,
      text: 'Avalanche Interchain Messaging',
      description:
        'Utilize Avalanche Interchain Messaging to build cross-chain dApps in the Avalanche ecosystem.',
      url: '/academy/interchain-messaging',
      menu: {
        className: 'lg:col-start-2 lg:row-start-1',
      },
    },
    {
      icon: <ArrowLeftRight />,
      text: 'Avalanche Interchain Token Transfer',
      description:
        'Bridge tokens between Avalanche L1s using the Interchain Token Transfer protocol.',
      url: '/academy/interchain-token-transfer',
      menu: {
        className: 'lg:col-start-2 lg:row-start-2',
      },
    },
    {
      icon: <Cpu />,
      text: 'Customizing the EVM',
      description:
        'Learn how to customize the Ethereum Virtual Machine and add your own custom precompiles.',
      url: '/academy/customizing-evm',
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

export const toolsMenu: LinkItemType = {
  type: 'menu',
  text: 'Tools',
  url: '/tools/l1-toolbox',
  items: [
    {
      menu: {
        banner: (
          <div className='-mx-3 -mt-3'>
            <Image
              src="/l1toolbox.png"
              alt='L1 Launcher Preview'
              width={900}
              height={400}
              className='rounded-t-lg object-cover w-full h-auto'
              style={{
                maskImage: 'linear-gradient(to bottom,white 60%,transparent)',
              }}
            />
          </div>
        ),
        className: 'md:row-span-2 lg:col-span-1',
      },
      icon: <Waypoints />,
      text: 'L1 Toolbox',
      description: 'Manage your L1 with a highly granular set of tools.',
      url: '/tools/l1-toolbox',
    },
    {
      icon: <SendHorizontal />,
      text: 'Interchain Messaging Tools',
      description:
        'Set up Interchain Messaging (ICM) for your L1.',
      url: '/tools/l1-toolbox',
      menu: {
        className: 'lg:col-start-2 lg:row-start-1',
      },
    },
    {
      icon: <ArrowLeftRight />,
      text: 'Interchain Token Transfer Tools',
      description:
        'Set up cross-L1 bridges using the Interchain Token Transfer protocol.',
      url: '/tools/l1-toolbox',
      menu: {
        className: 'lg:col-start-2 lg:row-start-2',
      },
    },
    {
      icon: <HandCoins />,
      text: 'Testnet Faucet',
      description:
        'Claim Fuji AVAX tokens from the testnet faucet to test your dApps.',
      url: '/tools/l1-toolbox#faucet',
      menu: {
        className: 'lg:col-start-3 lg:row-start-1',
      },
    },
    {
      icon: <Github />,
      text: 'Avalanche Starter Kit',
      description:
        'Spin up short-lived test environments for building dApps using interoperability features like ICM and ICTT.',
      url: 'https://github.com/ava-labs/avalanche-starter-kit',
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

const bridgeLink: LinkItemType = {
  type: 'main',
  text: 'Bridge',
  url: 'https://core.app/bridge',
};

const userMenu: LinkItemType = {
  type: 'custom',
  children: <UserButtonWrapper />,
  secondary: true
};

const github: LinkItemType = {
  type: 'icon',
  icon: <SiGithub />,
  url: 'https://github.com/ava-labs/avalanche-docs',
  text: 'Github',
  active: 'none',
};

const hackathons: LinkItemType = {
  icon: <Cog />,
  text: 'Hackathons',
  url: '/hackathons',
  active: 'nested-url',
};

export const baseOptions: BaseLayoutProps = {
  // githubUrl: 'https://github.com/ava-labs/builders-hub',
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
    integrationsMenu,
    bridgeLink,
    toolsMenu,
    grantsMenu,
    eventsMenu,
    github,
    userMenu,
  ],
};
