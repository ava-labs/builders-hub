"use client";

import React from "react";
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
    description: "Bridge assets to and from the C-Chain",
    icon: ArrowLeftRight,
    href: "https://core.app/en/bridge/"
  },
  {
    id: 3,
    title: "Create New L1",
    description: "Use our Builder Console to create a new L1",
    icon: Wrench,
    href: "/console/layer-1/create"
  },
  {
    id: 4,
    title: "Explorer",
    description: "Learn from zero to hero",
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
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-xl font-bold tracking-wide text-zinc-700 dark:text-zinc-300 uppercase">
          Quick Links
        </h2>
      </div>
      
      <div className="mt-12 mx-auto font-geist relative max-w-7xl w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {quickLinks.map((link, index) => (
            <Link
              key={link.id}
              href={link.href}
              className={cn(
                "group block p-6 rounded-2xl transition-all duration-200",
                "bg-white dark:bg-zinc-900/50",
                "border border-zinc-200/80 dark:border-zinc-800/80",
                "shadow-[0_2px_10px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.3)]",
                "hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)]",
                "hover:border-zinc-300/80 dark:hover:border-zinc-700/80"
              )}
            >
              <div className="h-full min-h-[140px] flex flex-col">
                {/* Icon */}
                <div className="mb-4">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <link.icon className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
                  </div>
                </div>
                
                {/* Content */}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2 text-zinc-900 dark:text-white">
                    {link.title}
                  </h3>
                  
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {link.description}
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