"use client";

import React from "react";
import { Book, Wrench, Droplets } from "lucide-react";
import { cn } from "@/utils/cn";
import Link from "next/link";

const development = [
  {
    id: 2,
    label: "Documentation",
    title: "Explore our <strong>Docs</strong>.",
    description:
      "Find references for all Avalanche SDKs, APIs, and tools.",
    icon: Book,
    href: "/docs",
  },
  {
    id: 5,
    label: "Tools",
    title: "Builder Console",
    description:
      "Leverage our Builder Console to launch your L1 blockchain.",
    icon: Wrench,
    href: "/console"
  },
  {
    id: 6,
    label: "Faucet",
    title: "Free Testnet Tokens",
    description:
      "Instant access to testnet tokens for seamless development and testing across multiple Avalanche L1s.",
    icon: Droplets,
    href: "/console/primary-network/faucet"
  },
];

export default function Development() {
  return (
    <div className="flex flex-col justify-center items-center px-4 mb-20" id="development">
      <div className="flex items-center justify-center gap-3 mb-4">
        <h2 className="font-display text-3xl tracking-tight sm:text-5xl text-center font-bold
          text-gray-900 dark:text-white">
          🛠️ Build
        </h2>
      </div>
      
      <div className="mt-12 mx-auto font-geist relative max-w-7xl w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-0">
          {development.map((item, index) => (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "group block relative overflow-hidden",
                "transition-all duration-400 cubic-bezier(0.4, 0, 0.2, 1)",
                /* Light mode - clean professional */
                "bg-white border border-gray-200/60 hover:border-gray-300/80",
                "shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1),0_10px_10px_-5px_rgba(0,0,0,0.04)]",
                "hover:shadow-[0_20px_40px_-5px_rgba(0,0,0,0.15),0_10px_15px_-5px_rgba(0,0,0,0.08)]",
                "hover:-translate-y-2",
                /* Dark mode - refined glass morphism */
                "dark:bg-[rgba(15,15,15,0.7)] dark:backdrop-filter dark:backdrop-blur-[20px]",
                "dark:border-transparent dark:hover:border-transparent",
                "dark:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.5),0_10px_10px_-5px_rgba(0,0,0,0.3)]",
                "dark:hover:shadow-[0_20px_40px_-5px_rgba(0,0,0,0.6),0_15px_20px_-5px_rgba(0,0,0,0.4)]",
                "dark:hover:-translate-y-2 dark:hover:scale-[1.02]",
                // Professional grid borders
                index === 1 && "lg:border-x-0 lg:border-l lg:border-r dark:lg:border-l-transparent dark:lg:border-r-transparent",
              )}
            >
              <div className="relative z-10 p-8 lg:p-10 h-full min-h-[280px] flex flex-col">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 rounded-xl bg-gray-100/80 dark:bg-[rgba(255,255,255,0.06)] 
                                  backdrop-filter backdrop-blur-sm
                                  transition-all duration-300 group-hover:bg-gray-200/80 dark:group-hover:bg-[rgba(255,255,255,0.12)]
                                  shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
                    <item.icon className="w-6 h-6 text-gray-700 dark:text-slate-200 transition-transform duration-300 group-hover:scale-110" />
                  </div>
                  <span className="text-sm font-medium text-gray-600 dark:text-slate-400 tracking-wide uppercase">
                    {item.label}
                  </span>
                </div>
                
                {/* Content */}
                <div className="flex-1">
                  <h3
                    className="text-2xl lg:text-3xl font-semibold leading-tight mb-4
                      text-gray-900 dark:text-slate-100 tracking-tight"
                    dangerouslySetInnerHTML={{ __html: item.title }}
                  />
                  
                  <p className="text-gray-600 dark:text-slate-300 leading-relaxed text-base">
                    {item.description}
                  </p>
                </div>
                
                {/* CTA */}
                <div className="mt-8 flex items-center text-gray-800 dark:text-slate-300 font-medium 
                              group-hover:text-gray-900 dark:group-hover:text-slate-200 transition-colors duration-300">
                  <span className="mr-2">Get started</span>
                  <svg
                    className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
              </div>
              
              {/* Subtle inner highlight */}
              <div className="absolute inset-[1px] rounded-lg bg-gradient-to-br from-white/3 to-transparent pointer-events-none dark:from-white/8"></div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}