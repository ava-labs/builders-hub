import {
  SquareGanttChart, MonitorCog, Logs, MonitorCheck, Settings, Cable, Webhook, Github,
  Wrench,
  Terminal,
  Blocks,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/utils/cn';
import type { Metadata } from 'next';
import { createMetadata } from '@/utils/metadata';
import { SearchTrigger } from '@/components/SearchTrigger';
import Chatbot from '@/components/ui/chatbot';


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

// Background component similar to HeroBackground
function DocsBackground() {
  return (
    <div className="fixed inset-0 -z-10">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-[#0A0A0A] dark:via-[#0A0A0A] dark:to-[#0A0A0A]">
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] dark:bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)]"></div>
      </div>
    </div>
  );
}

export default function HomePage(): React.ReactElement {
  return (
    <>
      <DocsBackground />
      <Hero />
      <main className="container relative max-w-[1100px] px-2 py-4 lg:py-8">
        <Highlights />
        <AllCategories />
        <Features />
      </main>
    </>
  );
}

function Highlights(): React.ReactElement {
  const highlights = [
    {
      id: 1,
      title: "Node & Validators",
      description: "Run a node or validator on the Avalanche Primary Network",
      icon: SquareGanttChart,
      href: "/docs/nodes/run-a-node/using-docker",
      badge: "Popular",
      badgeColor: "bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300 border-red-200 dark:border-red-700/50"
    },
    {
      id: 2,
      title: "Launch an L1",
      description: "Launch your own custom blockchain with unique features",
      icon: Blocks,
      href: "/docs/avalanche-l1s",
      badge: "Advanced",
      badgeColor: "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-700/50"
    }
  ];

  return (
    <div className="flex flex-col px-4 mb-20">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-xl font-medium tracking-wide text-zinc-700 dark:text-zinc-300 uppercase">
          Popular Resources
        </h2>
      </div>
      
      <div className="mt-12 mx-auto font-geist relative max-w-7xl w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {highlights.map((highlight) => (
            <Link
              key={highlight.id}
              href={highlight.href}
              className={cn(
                "group block p-6 rounded-2xl transition-all duration-200 relative",
                "bg-white dark:bg-zinc-900/50",
                "border border-zinc-200/80 dark:border-zinc-800/80",
                "shadow-[0_2px_10px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.3)]",
                "hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)]",
                "hover:border-zinc-300/80 dark:hover:border-zinc-700/80"
              )}
            >
              <div className="h-full min-h-[160px] flex flex-col">
                {/* Badge */}
                <div className="absolute top-4 right-4">
                  <span className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border",
                    highlight.badgeColor
                  )}>
                    {highlight.badge}
                  </span>
                </div>

                {/* Icon */}
                <div className="mb-4">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <highlight.icon className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
                  </div>
                </div>
                
                {/* Content */}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2 text-zinc-900 dark:text-white">
                    {highlight.title}
                  </h3>
                  
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {highlight.description}
                  </p>
                </div>
                
                {/* Arrow */}
                <div className="mt-4 flex justify-end">
                  <ArrowRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-400 transition-colors" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function AllCategories(): React.ReactElement {
  const categories = [
    {
      id: 1,
      title: "Virtual Machines",
      description: "Customize the EVM or build new VMs from scratch",
      icon: MonitorCog,
      href: "/docs/virtual-machines",
      badge: "Advanced"
    },
    {
      id: 2,
      title: "Interoperability",
      description: "Connect and transfer assets between L1s",
      icon: Cable,
      href: "/docs/cross-chain",
      badge: "Feature"
    },
    {
      id: 3,
      title: "Nodes & Validators",
      description: "Run nodes and participate in network consensus",
      icon: MonitorCheck,
      href: "/docs/nodes",
      badge: "Infrastructure"
    },
    {
      id: 4,
      title: "APIs & RPCs",
      description: "Integrate with Avalanche network APIs",
      icon: Webhook,
      href: "/docs/api-reference/c-chain/api",
      badge: "Reference"
    },
    {
      id: 5,
      title: "Developer Tools",
      description: "CLI tools and utilities for development",
      icon: Wrench,
      href: "/tools/l1-toolbox",
      badge: "Tools"
    }
  ];

  return (
    <div className="flex flex-col px-4 mb-20">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-xl font-medium tracking-wide text-zinc-700 dark:text-zinc-300 uppercase">
          All Categories
        </h2>
      </div>
      
      <div className="mt-12 mx-auto font-geist relative max-w-7xl w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={category.href}
              className={cn(
                "group block p-6 rounded-2xl transition-all duration-200 relative",
                "bg-white dark:bg-zinc-900/50",
                "border border-zinc-200/80 dark:border-zinc-800/80",
                "shadow-[0_2px_10px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.3)]",
                "hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)]",
                "hover:border-zinc-300/80 dark:hover:border-zinc-700/80"
              )}
            >
              <div className="h-full min-h-[160px] flex flex-col">
                {/* Badge */}
                <div className="absolute top-4 right-4">
                  <span className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    {category.badge}
                  </span>
                </div>

                {/* Icon */}
                <div className="mb-4">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <category.icon className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
                  </div>
                </div>
                
                {/* Content */}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2 text-zinc-900 dark:text-white">
                    {category.title}
                  </h3>
                  
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {category.description}
                  </p>
                </div>
                
                {/* Arrow */}
                <div className="mt-4 flex justify-end">
                  <ArrowRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-400 transition-colors" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Hero(): React.ReactElement {
  return (
    <section className="w-full flex items-center justify-center relative py-8 lg:py-12 pb-4 lg:pb-8">
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-center items-center">
          <div className="mb-8 relative flex items-end justify-center gap-2">

          </div>
          
          {/* Quick Search */}
          <div className="w-full max-w-md">
            <SearchTrigger />
          </div>

          {/* AI Assistant */}
          <div className="mt-6 flex justify-center">
            <Chatbot variant="static" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Features(): React.ReactElement {
  const toolsFeatures = [
    {
      id: 1,
      title: "Builder Console",
      description: "Simple atomic tools to launch and maintain your L1",
      icon: Wrench,
      href: "/console"
    },
    {
      id: 2,
      title: "Avalanche CLI",
      description: "Command-line interface for local development with L1s",
      icon: Terminal,
      href: "/docs/tooling/get-avalanche-cli"
    },
    {
      id: 3,
      title: "Avalanche Starter Kit",
      description: "Containerized Development Environment including Avalanche CLI, Foundry and our interoperability contract implementations",
      icon: Github,
      href: "https://github.com/ava-labs/avalanche-starter-kit"
    },
    {
      id: 4,
      title: "Avalanche SDK",
      description: "Complete set of tools and libraries for developers to interact programmatically with the Avalanche blockchain ecosystem.",
      icon: Github,
      href: "https://github.com/ava-labs/avalanche-sdk-typescript"
    }
  ];

  const apiFeatures = [
    {
      id: 1,
      title: "C-Chain API",
      description: "API reference for the Contract Chain",
      href: "/docs/api-reference/c-chain/api"
    },
    {
      id: 2,
      title: "P-Chain API", 
      description: "API reference for the Platform Chain",
      href: "/docs/api-reference/p-chain/api"
    },
    {
      id: 3,
      title: "X-Chain API",
      description: "API reference for the Exchange Chain", 
      href: "/docs/api-reference/x-chain/api"
    },
    {
      id: 4,
      title: "AvalancheGo API",
      description: "API reference for AvalancheGo",
      href: "/docs/api-reference/admin-api"
    },
    {
      id: 5,
      title: "Subnet-EVM API",
      description: "API reference for Subnet-EVM",
      href: "/docs/api-reference/subnet-evm-api"
    },
    {
      id: 6,
      title: "AvaCloud APIs",
      description: "API reference for AvaCloud",
      href: "https://developers.avacloud.io/introduction"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-20">
      {/* Tools Section */}
      <div className="flex flex-col px-4">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
          <h2 className="text-xl font-medium tracking-wide text-zinc-700 dark:text-zinc-300 uppercase">
            Tools For Developers
          </h2>
        </div>
        <p className="text-zinc-600 dark:text-zinc-400 mb-8">
          We provide a suite of tools to make your development experience as smooth as possible.
        </p>
        
        <div className="space-y-4">
          {toolsFeatures.map((tool) => (
            <Link
              key={tool.id}
              href={tool.href}
              className={cn(
                "group block p-4 rounded-xl transition-all duration-200",
                "bg-white dark:bg-zinc-900/50",
                "border border-zinc-200/80 dark:border-zinc-800/80",
                "shadow-[0_2px_10px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.3)]",
                "hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)]",
                "hover:border-zinc-300/80 dark:hover:border-zinc-700/80"
              )}
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                  <tool.icon className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-zinc-900 dark:text-white">
                    {tool.title}
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                    {tool.description}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-400 transition-colors flex-shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* APIs Section */}
      <div className="flex flex-col px-4">
        <div className="flex items-center gap-3 mb-4">
          <Webhook className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
          <h2 className="text-xl font-medium tracking-wide text-zinc-700 dark:text-zinc-300 uppercase">
            API References
          </h2>
        </div>
        <p className="text-zinc-600 dark:text-zinc-400 mb-8">
          Well documented APIs for the Avalanche Network.
        </p>
        
        <div className="grid grid-cols-1 gap-4">
          {apiFeatures.map((api) => (
            <Link
              key={api.id}
              href={api.href}
              className={cn(
                "group block p-4 rounded-xl transition-all duration-200",
                "bg-white dark:bg-zinc-900/50",
                "border border-zinc-200/80 dark:border-zinc-800/80",
                "shadow-[0_2px_10px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.3)]",
                "hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)]",
                "hover:border-zinc-300/80 dark:hover:border-zinc-700/80"
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-white">
                    {api.title}
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                    {api.description}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-400 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
