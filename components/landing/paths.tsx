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
    title: "Build an App",
    description: "Bring your ideas to life",
    icon: Code,
    href: "/docs/dapps"
  },
  {
    id: 2,
    title: "Launch an L1",
    description: "Launch your own L1",
    icon: Rocket,
    href: "/academy/avalanche-fundamentals/04-creating-an-l1/01-creating-an-l1"
  },
  {
    id: 3,
    title: "Interoperability",
    description: "Build cross-chain apps",
    icon: Network,
    href: "/academy/interchain-messaging"
  },
  {
    id: 4,
    title: "Primary Network",
    description: "Run validators",
    icon: Server,
    href: "/docs/nodes"
  },
  {
    id: 5,
    title: "Fund",
    description: "Grants Program",
    icon: DollarSign,
    href: "/grants"
  }
];

export default function Paths() {
  return (
    <div className="flex flex-col px-4 mb-20">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-xl font-bold tracking-wide text-zinc-700 dark:text-zinc-300 uppercase">
          Choose your path
        </h2>
      </div>
      
      <div className="mt-12 mx-auto font-geist relative max-w-7xl w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {paths.map((path, index) => (
            <Link
              key={path.id}
              href={path.href}
              className={cn(
                "group block p-6 rounded-2xl transition-all duration-200",
                "bg-white dark:bg-zinc-900/50",
                "border border-zinc-200/80 dark:border-zinc-800/80",
                "shadow-[0_2px_10px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.3)]",
                "hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)]",
                "hover:border-zinc-300/80 dark:hover:border-zinc-700/80"
              )}
            >
              <div className="h-full min-h-[160px] flex flex-col">
                {/* Icon */}
                <div className="mb-4">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <path.icon className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
                  </div>
                </div>
                
                {/* Content */}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2 text-zinc-900 dark:text-white">
                    {path.title}
                  </h3>
                  
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {path.description}
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