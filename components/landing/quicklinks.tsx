"use client";

import {
  Droplet,
  Wrench,
  Search,
  BookOpen,
  ArrowRight,
  ArrowLeftRight
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
    title: "Bridge",
    description: "Bridge assets to and from Avalanche",
    icon: ArrowLeftRight,
    href: "https://core.app/en/bridge/"
  },
  {
    id: 3,
    title: "Create New L1",
    description: "Create a blockchain with the Builder Console",
    icon: Wrench,
    href: "/console/layer-1/create"
  },
  {
    id: 4,
    title: "Explorer",
    description: "Explore activity on the network",
    icon: Search,
    href: "https://subnets.avax.network"
  },
  {
    id: 5,
    title: "API References",
    description: "Avalanche APIs",
    icon: BookOpen,
    href: "/docs/api-reference"
  }
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