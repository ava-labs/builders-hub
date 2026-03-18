"use client";

import {
  Droplet,
  Wrench,
  BookOpen,
  ArrowRight,
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

const quickLinks = [
  {
    id: 1,
    title: "Faucet",
    description: "Get testnet AVAX",
    icon: Droplet,
    href: "/console/primary-network/faucet"
  },
  {
    id: 2,
    title: "Create New L1",
    description: "Create a blockchain with the Builder Console",
    icon: Wrench,
    href: "/console/layer-1/create"
  },
  {
    id: 3,
    title: "Setup a Node",
    description: "Run a node on your own hardware or cloud provider.",
    icon: Computer,
    href: "/docs/nodes/run-a-node/using-docker"
  },
  {
    id: 4,
    title: "RPC References",
    description: "Explore the RPC Methods for the C-Chain, P-Chain, and X-Chain.",
    icon: ArrowLeftRight,
    href: "/docs/rpcs/c-chain"
  },
  {
    id: 5,
    title: "API References",
    description: "Avalanche Data, Metrics, and Webhook APIs",
    icon: BookOpen,
    href: "/docs/api-reference"
  },
  {
    id: 6,
    title: "Avalanche Fundamentals",
    description: "Learn about the basics of Avalanche.",
    icon: Triangle,
    href: "/academy/avalanche-fundamentals"
  },
  {
    id: 7,
    title: "Network Stats",
    description: "View the latest metrics for the Avalanche Network.",
    icon: ActivityIcon,
    href: "/stats/overview"
  },
  {
    id: 8,
    title: "ACPs",
    description: "Explore Avalanche's Community Proposals (ACPs) for network improvements and best practices.",
    icon: GitBranch,
    href: "/docs/acps"
  },
  {
    id: 9,
    title: "Integrations",
    description: "Explore the integrations with Avalanche.",
    icon: PackageIcon,
    href: "/integrations"
  },
  {
    id: 10,
    title: "Developer Tools",
    description: "Explore the developer tools for Avalanche.",
    icon: CodeIcon,
    href: "/docs/tooling"
  },
];

export default function QuickLinks() {
  return (
    <div className="flex flex-col px-4 mb-20">
      <div className="flex items-center gap-3 mb-6 mx-auto max-w-7xl w-full">
        <h2 className="text-sm font-medium tracking-wider text-zinc-500 dark:text-zinc-400 uppercase">
          Quick Links
        </h2>
      </div>
      
      <div className="mx-auto font-geist relative max-w-7xl w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {quickLinks.map((link, index) => (
            <Link
              key={link.id}
              href={link.href}
              className={cn(
                "group block p-4 rounded-lg transition-all duration-150",
                "bg-zinc-50/50 dark:bg-zinc-900/50",
                "border border-zinc-200/50 dark:border-zinc-800/50",
                "hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50",
                "hover:border-zinc-300/50 dark:hover:border-zinc-700/50"
              )}
            >
              <div className="h-full min-h-[100px] flex flex-col">
                {/* Icon */}
                <div className="mb-3">
                  <link.icon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                </div>
                
                {/* Content */}
                <div className="flex-1">
                  <h3 className="text-base font-medium mb-1 text-zinc-900 dark:text-zinc-100">
                    {link.title}
                  </h3>
                  
                  <p className="text-xs text-zinc-500 dark:text-zinc-500 leading-snug">
                    {link.description}
                  </p>
                </div>
                
                {/* Arrow */}
                <div className="mt-3 flex justify-end">
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-500 dark:group-hover:text-zinc-500 transition-colors" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
} 