"use client";

import React from "react";
import {
  Code,
  Rocket,
  Network,
  Server,
  DollarSign,
  ArrowRight
} from "lucide-react";
import { cn } from "@/utils/cn";
import Link from "next/link";

const paths = [
  {
    id: 1,
    title: "Launch an L1",
    description: "Launch your own L1",
    icon: Rocket,
    href: "/academy/avalanche-l1/avalanche-fundamentals/04-creating-an-l1/01-creating-an-l1"
  },
  {
    id: 2,
    title: "Interoperability",
    description: "Build cross-chain apps",
    icon: Network,
    href: "/academy/interchain-messaging"
  },
  {
    id: 3,
    title: "Primary Network",
    description: "Run validators",
    icon: Server,
    href: "/docs/nodes"
  },
  {
    id: 4,
    title: "Fund",
    description: "Grants Program",
    icon: DollarSign,
    href: "/grants"
  }
];

export default function Paths() {
  return (
    <div className="flex flex-col px-4 mb-20">
      <div className="flex items-center gap-3 mb-6 mx-auto max-w-7xl w-full">
        <h2 className="text-sm font-medium tracking-wider text-zinc-500 dark:text-zinc-400 uppercase">
          Choose your path
        </h2>
      </div>
      
      <div className="mx-auto font-geist relative max-w-7xl w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {paths.map((path, index) => (
            <Link
              key={path.id}
              href={path.href}
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
                  <path.icon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                </div>
                
                {/* Content */}
                <div className="flex-1">
                  <h3 className="text-base font-medium mb-1 text-zinc-900 dark:text-zinc-100">
                    {path.title}
                  </h3>
                  
                  <p className="text-xs text-zinc-500 dark:text-zinc-500 leading-snug">
                    {path.description}
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