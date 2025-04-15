import type { LucideIcon } from 'lucide-react';
import {
  SquareGanttChart, MonitorCog, Logs, MonitorCheck, Settings, Cable, Webhook, Github,
  Wrench,
  GraduationCap,
  Rocket
} from 'lucide-react';
import Link from 'next/link';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';

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
    <div className="grid grid-cols-1 border-r md:grid-cols-2 lg:grid-cols-3">
      <Highlight icon={GraduationCap} heading="Learn the Fundamentals" link="/academy/avalanche-fundamentals">
        Learn about the Avalanche Protocol and it's groundbreaking consensus algorithm.
      </Highlight>
      <Highlight icon={Logs} heading="Avalanche L1s" link="/docs/avalanche-l1s">
        Utilize the Avalanche tech stack to build your own layer 1 blockchain.
      </Highlight>
      <Highlight icon={Cable} heading="Interoperability" link="/docs/cross-chain">
        Advanced interoperability protocols to communicate with other blockchains.
      </Highlight>
      <Highlight icon={SquareGanttChart} heading="Build Applications" link="/docs/dapps">
        Your one stop shop to deploy smart contracts on the Avalanche C-Chain.
      </Highlight>
      <Highlight icon={MonitorCog} heading="Virtual Machines" link="/docs/virtual-machines">
        Learn how to customize the EVM or build new virtual machines from scratch.
      </Highlight>
      <Highlight icon={MonitorCheck} heading="Nodes & Validators" link="/docs/nodes">
        Become an active participant in the network by running a node or validator.
      </Highlight>

    </div>
  );
}

function Highlight({
  icon: Icon,
  heading,
  link,
  children,
}: {
  icon: LucideIcon;
  heading: ReactNode;
  link: string;
  children: ReactNode;
}): React.ReactElement {
  return (
    <a href={link}>
      <div className="border-l border-t px-6 py-12 hover:bg-fd-accent">
        <div className="mb-4 flex flex-row items-center gap-2 text-fd-muted-foreground">
          <Icon className="size-4" />
          <h2 className="text-sm font-medium">{heading}</h2>
        </div>
        <span className="font-medium">{children}</span>
      </div>
    </a>
  );
}

function Hero(): React.ReactElement {
  return (
    <div className="flex flex-col justify-center items-center px-4 mb-16">
      <h2 className="font-display text-3xl tracking-tight sm:text-5xl text-center">
        Avalanche Docs
      </h2>
      <p className="mt-4 text-lg tracking-tight text-zinc-400 text-center">
        Full-Stack Avalanche Development, All in One Place
      </p>
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
          <Link href="/tools/l1-launcher" className="rounded-xl border bg-fd-background p-4 shadow-lg transition-colors hover:bg-fd-accent">
            <Rocket />
            <h3 className="font-semibold">L1 Launcher</h3>
            <p className="text-sm text-fd-muted-foreground">
              Launch your EVM L1 with Docker and Core Wallet.
            </p>
          </Link>
          <Link href="/tools/l1-toolbox" className="rounded-xl border bg-fd-background p-4 shadow-lg transition-colors hover:bg-fd-accent">
            <Wrench />
            <h3 className="font-semibold">L1 Toolbox</h3>
            <p className="text-sm text-fd-muted-foreground">
              Simple atomic tools to launch and maintain your L1.
            </p>
          </Link>
          <Link href="https://github.com/ava-labs/avalanche-starter-kit" className="rounded-xl border bg-fd-background p-4 shadow-lg transition-colors hover:bg-fd-accent">
            <Github />
            <h3 className="font-semibold">Avalanche Starter Kit</h3>
            <p className="text-sm text-fd-muted-foreground">
              Quickstart your journey into Avalanche with our Starter Kit.
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