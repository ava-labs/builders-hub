import type { LucideIcon } from 'lucide-react';
import {
  SquareGanttChart, MonitorCog, Logs, MonitorCheck, Settings, Cable, Webhook, Github,
  Wrench,
  GraduationCap,
  Terminal,
  Blocks
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';
import type { Metadata } from 'next';
import { createMetadata } from '@/utils/metadata';
import { SearchTrigger } from '@/components/SearchTrigger';


export const metadata: Metadata = createMetadata({
  title: 'Documentation',
  description: 'Developer documentation for everything related to the Avalanche ecosystem',
  openGraph: {
    url: '/docs',
    images: {
      url: '/api/og/docs',
      width: 1200,
      height: 630,
      alt: 'Avalanche Documentation',
    },
  },
  twitter: {
    images: {
      url: '/api/og/docs',
      width: 1200,
      height: 630,
      alt: 'Avalanche Documentation',
    },
  },
});

export default function HomePage(): React.ReactElement {
  return (
    <>
      <main className="container relative max-w-[1100px] px-2 py-4 lg:py-16">
        <div>
          <div className="relative">
            <Hero />
          </div>
          <Highlights />
          <Features />
        </div>
      </main>
    </>
  );
}

function Highlights(): React.ReactElement {
  return (
    <div className="mt-16">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <div className="group relative overflow-hidden rounded-xl border border-red-200 dark:border-red-800/50 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/40 dark:to-orange-950/40 p-8 hover:shadow-lg dark:hover:shadow-red-900/20 transition-all duration-300">
          <div className="absolute top-4 right-4">
            <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/50 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:text-red-300 border dark:border-red-700/50">
              Popular
            </span>
          </div>
          <SquareGanttChart className="h-8 w-8 text-red-600 dark:text-red-400 mb-4" />
          <h3 className="text-xl font-semibold text-zinc-900 dark:text-red-100 mb-2">
            Smart Contract Developer
          </h3>
          <p className="text-zinc-600 dark:text-red-200/80 mb-6">
            Deploy dApps on Avalanche C-Chain with familiar EVM tools
          </p>
          <Link 
            href="/docs/dapps" 
            className="inline-flex items-center text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium group-hover:underline"
          >
            Get started with dApps
            <svg className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        <div className="group relative overflow-hidden rounded-xl border border-blue-200 dark:border-blue-800/50 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 p-8 hover:shadow-lg dark:hover:shadow-blue-900/20 transition-all duration-300">
          <div className="absolute top-4 right-4">
            <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/50 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:text-blue-300 border dark:border-blue-700/50">
              Advanced
            </span>
          </div>
          <Blocks className="h-8 w-8 text-blue-600 dark:text-blue-400 mb-4" />
          <h3 className="text-xl font-semibold text-zinc-900 dark:text-blue-100 mb-2">
            Layer 1 Developer
          </h3>
          <p className="text-zinc-600 dark:text-blue-200/80 mb-6">
            Launch your own custom blockchain with unique features
          </p>
          <Link 
            href="/docs/avalanche-l1s" 
            className="inline-flex items-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium group-hover:underline"
          >
            Build your L1
            <svg className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>

      {/* All categories */}
      <div className="grid grid-cols-1 border-r md:grid-cols-2 lg:grid-cols-3">
        <Highlight icon={GraduationCap} heading="Learn the Fundamentals" link="/academy/avalanche-fundamentals" badge="Beginner">
          Master Avalanche concepts and architecture
        </Highlight>
        <Highlight icon={MonitorCog} heading="Virtual Machines" link="/docs/virtual-machines" badge="Advanced">
          Customize the EVM or build new VMs from scratch
        </Highlight>
        <Highlight icon={Cable} heading="Interoperability" link="/docs/cross-chain" badge="Feature">
          Connect and transfer assets between L1s
        </Highlight>
        <Highlight icon={MonitorCheck} heading="Nodes & Validators" link="/docs/nodes" badge="Infrastructure">
          Run nodes and participate in network consensus
        </Highlight>
        <Highlight icon={Webhook} heading="APIs & RPCs" link="/docs/api-reference/c-chain/api" badge="Reference">
          Integrate with Avalanche network APIs
        </Highlight>
        <Highlight icon={Wrench} heading="Developer Tools" link="/tools/l1-toolbox" badge="Tools">
          CLI tools and utilities for development
        </Highlight>
      </div>
    </div>
  );
}

function Highlight({
  icon: Icon,
  heading,
  link,
  children,
  badge,
}: {
  icon: LucideIcon;
  heading: ReactNode;
  link: string;
  children: ReactNode;
  badge?: string;
}): React.ReactElement {
  return (
    <a href={link}>
      <div className="border-l border-t px-6 py-12 hover:bg-fd-accent relative group">
        {badge && (
          <div className="absolute top-4 right-4">
            <span className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
              {badge}
            </span>
          </div>
        )}
        <div className="mb-4 flex flex-row items-center gap-2 text-fd-muted-foreground">
          <Icon className="size-4" />
          <h2 className="text-sm font-medium">{heading}</h2>
        </div>
        <span className="font-medium text-zinc-700 dark:text-zinc-300">{children}</span>
        <div className="mt-3 flex items-center text-red-600 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          Learn more
          <svg className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </a>
  );
}

function Hero(): React.ReactElement {
  return (
    <div className="flex flex-col justify-center items-center px-4 mb-16">
      <div className="mb-8 relative flex items-end justify-center gap-2">
        <div className="relative">
          <Image
            src="/small-logo.png"
            alt="Avalanche Logo"
            width={120}
            height={120}
            className=""
            priority
          />
        </div>
        <h2 className="font-display text-3xl tracking-tight text-black dark:text-white font-light leading-none mb-2">
          Documentation
        </h2>
      </div>
      <p className="mt-6 text-xl tracking-tight text-zinc-600 dark:text-zinc-400 text-center max-w-2xl">
        Build the future on Avalanche - from dApps to custom blockchains
      </p>
      
      {/* Quick Search */}
      <div className="mt-8 w-full max-w-md">
        <SearchTrigger />
      </div>
    </div>
  );
}


function Features(): React.ReactElement {
  return (
    <div className="grid grid-cols-1 border-b border-r md:grid-cols-2">
      <Feature
        icon={Settings}
        subheading="Tooling"
        heading="Tools For Developers."
        description="We provide a suite of tools to make your development experience as smooth as possible."
      >
        <div className="mt-8 flex flex-col gap-4">
          <Link href="/tools/l1-toolbox" className="rounded-xl border bg-fd-background p-4 shadow-lg transition-colors hover:bg-fd-accent">
            <Wrench />
            <h3 className="font-semibold">L1 Toolbox</h3>
            <p className="text-sm text-fd-muted-foreground">
              Simple atomic tools to launch and maintain your L1.
            </p>
          </Link>
          <Link href="/docs/tooling/get-avalanche-cli" className="rounded-xl border bg-fd-background p-4 shadow-lg transition-colors hover:bg-fd-accent">
            <Terminal />
            <h3 className="font-semibold">Avalanche CLI</h3>
            <p className="text-sm text-fd-muted-foreground">
              Command-line interface for local development with L1s.
            </p>
          </Link>
          <Link href="https://github.com/ava-labs/avalanche-starter-kit" className="rounded-xl border bg-fd-background p-4 shadow-lg transition-colors hover:bg-fd-accent">
            <Github />
            <h3 className="font-semibold">Avalanche Starter Kit</h3>
            <p className="text-sm text-fd-muted-foreground">
              Containerized Development Environment including Avalanche CLI, Foundry and our interoperability contract implementations.
            </p>
          </Link>
        </div>
      </Feature>
      <Feature
        icon={Webhook}
        subheading="APIs"
        heading="API References for anything Avalanche."
        description="Well documented APIs for the Avalanche Network."
      >
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Link href="/docs/api-reference/c-chain/api" className="rounded-xl border bg-fd-background p-4 shadow-lg transition-colors hover:bg-fd-accent">
            <h3 className="font-semibold">C-Chain API</h3>
            <p className="text-sm text-fd-muted-foreground">
              API reference for the Contract Chain.
            </p>
          </Link>
          <Link href="/docs/api-reference/p-chain/api" className="rounded-xl border bg-fd-background p-4 shadow-lg transition-colors hover:bg-fd-accent">
            <h3 className="font-semibold">P-Chain API</h3>
            <p className="text-sm text-fd-muted-foreground">
              API reference for the Platform Chain.
            </p>
          </Link>
          <Link href="/docs/api-reference/x-chain/api" className="rounded-xl border bg-fd-background p-4 shadow-lg transition-colors hover:bg-fd-accent">
            <h3 className="font-semibold">X-Chain API</h3>
            <p className="text-sm text-fd-muted-foreground">
              API reference for the Exchange Chain.
            </p>
          </Link>
          <Link href="/docs/api-reference/admin-api" className="rounded-xl border bg-fd-background p-4 shadow-lg transition-colors hover:bg-fd-accent">
            <h3 className="font-semibold">AvalancheGo API</h3>
            <p className="text-sm text-fd-muted-foreground">
              API reference for AvalancheGo.
            </p>
          </Link>
          <Link href="/docs/api-reference/subnet-evm-api" className="rounded-xl border bg-fd-background p-4 shadow-lg transition-colors hover:bg-fd-accent">
            <h3 className="font-semibold">Subnet-EVM API</h3>
            <p className="text-sm text-fd-muted-foreground">
              API reference for Subnet-EVM.
            </p>
          </Link>
          <Link href="https://developers.avacloud.io/introduction" target="_blank" className="rounded-xl border bg-fd-background p-4 shadow-lg transition-colors hover:bg-fd-accent">
            <h3 className="font-semibold">AvaCloud APIs</h3>
            <p className="text-sm text-fd-muted-foreground">
              API reference for AvaCloud.
            </p>
          </Link>
        </div>
      </Feature>
    </div>
  );
}

function Feature({
  className,
  icon: Icon,
  heading,
  subheading,
  description,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  icon: LucideIcon;
  subheading: ReactNode;
  heading: ReactNode;
  description: ReactNode;
}): React.ReactElement {
  return (
    <div
      className={cn('border-l border-t px-6 py-12', className)}
      {...props}
    >
      <div className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-fd-muted-foreground">
        <Icon className="size-4" />
        <p>{subheading}</p>
      </div>
      <h2 className="mb-2 text-lg font-semibold">{heading}</h2>
      <p className="text-fd-muted-foreground">{description}</p>

      {props.children}
    </div>
  );
}
