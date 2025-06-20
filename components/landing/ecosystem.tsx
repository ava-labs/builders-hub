"use client";

import React from "react";
import { AudioLines, ArrowUpRight } from "lucide-react";
import { cn } from "@/utils/cn";
import Link from "next/link";

const ecosystem = [
  {
    id: 1,
    title: "Join <strong>Team1 DAO</strong>.",
    description:
      "Contribute to the Avalanche community initiatives, and get rewarded with exclusive paid bounties.",
    href: "https://www.avax.network/ambassador"
  },
  {
    id: 2,
    title: "Check our <strong>Events</strong>.",
    description:
      "Connect with our team at Summit, participate in sponsored hackathons, and organize workshops and meetups.",
    href: "https://www.avalanchesummitemea.com/"
  },
  {
    id: 3,
    title: "Try <strong>Avalanche</strong>.",
    description:
      "Discover and try out different applications and L1s in the Avalanche ecosystem.",
    href: "https://core.app/discover/"
  }
];

export default function Ecosystem() {
  return (
    <div className="flex flex-col justify-center items-center px-4 mb-20" id="ecosystem">
      <div className="flex items-center justify-center gap-4 mb-4">
        <AudioLines className="w-8 h-8 sm:w-10 sm:h-10 text-gray-900 dark:text-white" />
        <h2 className="font-display text-3xl tracking-tight sm:text-5xl text-center font-bold
          text-gray-900 dark:text-white">
          Ecosystem
        </h2>
      </div>
      
      <div className="mt-12 mx-auto font-geist relative max-w-7xl w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-0">
          {ecosystem.map((item, index) => (
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
                "dark:border-[rgba(255,255,255,0.08)] dark:hover:border-[rgba(255,255,255,0.15)]",
                "dark:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.5),0_10px_10px_-5px_rgba(0,0,0,0.3)]",
                "dark:hover:shadow-[0_20px_40px_-5px_rgba(0,0,0,0.6),0_15px_20px_-5px_rgba(0,0,0,0.4)]",
                "dark:hover:-translate-y-2 dark:hover:scale-[1.02]",
                // Professional grid borders
                index === 1 && "lg:border-x-0 lg:border-l lg:border-r dark:lg:border-l-[rgba(255,255,255,0.08)] dark:lg:border-r-[rgba(255,255,255,0.08)]",
              )}
            >
              {/* Premium hover glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10"></div>
              
              <div className="relative z-10 p-8 lg:p-10 h-full min-h-[240px] flex flex-col justify-between">
                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4 mb-6">
                    <h3
                      className="text-2xl lg:text-3xl font-semibold leading-tight
                        text-gray-900 dark:text-slate-100 tracking-tight flex-1"
                      dangerouslySetInnerHTML={{ __html: item.title }}
                    />
                    <div className="p-2 rounded-full bg-gray-100/80 dark:bg-[rgba(255,255,255,0.06)] 
                                    backdrop-filter backdrop-blur-sm
                                    transition-all duration-300 group-hover:bg-gray-200/80 dark:group-hover:bg-[rgba(255,255,255,0.12)]
                                    shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]
                                    group-hover:-translate-y-1 group-hover:translate-x-1">
                      <ArrowUpRight 
                        className="w-5 h-5 text-gray-600 dark:text-slate-400 
                          transform transition-all duration-300 ease-out
                          group-hover:text-gray-800 dark:group-hover:text-slate-200"
                      />
                    </div>
                  </div>
                  
                  <p className="text-gray-600 dark:text-slate-300 leading-relaxed text-base mb-6">
                    {item.description}
                  </p>
                </div>
                
                {/* CTA */}
                <div className="flex items-center text-gray-800 dark:text-slate-300 font-medium 
                              group-hover:text-gray-900 dark:group-hover:text-slate-200 transition-colors duration-300">
                  <span className="mr-2">Learn more</span>
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