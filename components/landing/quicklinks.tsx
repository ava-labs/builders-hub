"use client";

import {
  Droplet,
  Wrench,
  BookOpen,
  Computer,
  ArrowLeftRight,
  GitBranch,
  ActivityIcon,
  PackageIcon,
  CodeIcon,
  Triangle
} from "lucide-react";
import { cn } from "@/utils/cn";
import Link from "next/link";

const sections = [
  {
    title: "Get Started",
    links: [
      {
        title: "Avalanche Fundamentals",
        description: "Learn the basics",
        icon: Triangle,
        href: "/academy/avalanche-fundamentals"
      },
      {
        title: "Create an L1",
        description: "Launch your own chain",
        icon: Wrench,
        href: "/console/layer-1/create"
      },
      {
        title: "Testnet Faucet",
        description: "Get test AVAX",
        icon: Droplet,
        href: "/console/primary-network/faucet"
      },
    ]
  },
  {
    title: "Build",
    links: [
      {
        title: "Run a Node",
        description: "Hardware or cloud",
        icon: Computer,
        href: "/docs/nodes/run-a-node/using-docker"
      },
      {
        title: "RPC Reference",
        description: "C-Chain, P-Chain, X-Chain",
        icon: ArrowLeftRight,
        href: "/docs/rpcs/c-chain"
      },
      {
        title: "API Reference",
        description: "Data and webhooks",
        icon: BookOpen,
        href: "/docs/api-reference"
      },
      {
        title: "Developer Tools",
        description: "SDKs and CLIs",
        icon: CodeIcon,
        href: "/docs/tooling"
      },
    ]
  },
  {
    title: "Ecosystem",
    links: [
      {
        title: "Network Stats",
        description: "Live metrics",
        icon: ActivityIcon,
        href: "/stats/overview"
      },
      {
        title: "Integrations",
        description: "Oracles, indexers, tools",
        icon: PackageIcon,
        href: "/integrations"
      },
      {
        title: "ACPs",
        description: "Community proposals",
        icon: GitBranch,
        href: "/docs/acps"
      },
    ]
  }
];

export default function QuickLinks() {
  return (
    <div className="px-4 mb-20">
      <div className="mx-auto max-w-7xl space-y-10">
        {sections.map((section) => (
          <div key={section.title}>
            <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4">
              {section.title}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {section.links.map((link) => (
                <Link
                  key={link.title}
                  href={link.href}
                  className={cn(
                    "group flex items-start gap-3 p-4 rounded-lg",
                    "bg-zinc-50/50 dark:bg-zinc-900/50",
                    "border border-zinc-200/50 dark:border-zinc-800/50",
                    "hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50",
                    "hover:border-zinc-300/50 dark:hover:border-zinc-700/50",
                    "transition-colors"
                  )}
                >
                  <link.icon className="w-5 h-5 text-zinc-400 dark:text-zinc-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {link.title}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-500">
                      {link.description}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 