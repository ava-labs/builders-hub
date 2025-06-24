"use client";

import React from "react";
import {
  Droplet,
  Wrench,
  Search,
  BookOpen,
  ArrowRight
} from "lucide-react";
import { cn } from "@/utils/cn";
import Link from "next/link";

const quickLinks = [
  {
    id: 1,
    title: "Faucet",
    description: "Get testnet AVAX",
    icon: Droplet,
    href: "https://core.app/tools/testnet-faucet/?subnet=c&token=c"
  },
  {
    id: 2,
    title: "L1 Toolbox",
    description: "Launch your own L1",
    icon: Wrench,
    href: "/tools/l1-toolbox"
  },
  {
    id: 3,
    title: "Explorer",
    description: "Learn from zero to hero",
    icon: Search,
    href: "https://subnets.avax.network"
  },
  {
    id: 4,
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
        <h2 className="text-xl font-medium tracking-wide text-gray-700 dark:text-gray-300 uppercase">
          Quick Links
        </h2>
      </div>
      
      <div className="mt-12 mx-auto font-geist relative max-w-7xl w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {quickLinks.map((link, index) => (
            <Link
              key={link.id}
              href={link.href}
              className={cn(
                "group block p-6 rounded-2xl transition-all duration-200",
                "bg-white dark:bg-gray-900/50",
                "border border-gray-200/80 dark:border-gray-800/80",
                "shadow-[0_2px_10px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.3)]",
                "hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)]",
                "hover:border-gray-300/80 dark:hover:border-gray-700/80"
              )}
            >
              <div className="h-full min-h-[140px] flex flex-col">
                {/* Icon */}
                <div className="mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <link.icon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                  </div>
                </div>
                
                {/* Content */}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                    {link.title}
                  </h3>
                  
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    {link.description}
                  </p>
                </div>
                
                {/* Arrow */}
                <div className="mt-4 flex justify-end">
                  <ArrowRight className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-colors" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
} 