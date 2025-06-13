"use client";

import React from "react";
import {
  GraduationCap,
  Ticket,
  Newspaper
} from "lucide-react";
import { cn } from "@/utils/cn";
import Link from "next/link";

const features = [
  {
    id: 1,
    label: "Academy",
    title: "Start <strong>Learning</strong>.",
    description:
      "Enroll in our free online courses to learn about Avalanche and earn certificates.",
    icon: GraduationCap,
    href: "/academy"
  },
  {
    id: 2,
    label: "Hackathons",
    title: "Register for our <strong>Hackathons</strong>.",
    description:
      "Find out about upcoming hackathons and events, and learn how to get involved.",
    icon: Ticket,
    href: "/hackathons"
  },
  {
    id: 3,
    label: "Guides",
    title: "Learn from <strong>Guides</strong>.",
    description:
      "Comprehensive technical guides with best practices and expert insights.",
    icon: Newspaper,
    href: "/guides"
  }
];

export default function Features() {
  return (
    <div className="flex flex-col justify-center items-center px-4 mb-16">
      <div className="flex items-center justify-center gap-3 mb-2">
        <h2 className="font-display text-3xl tracking-tight sm:text-5xl text-center font-bold
          /* Light mode - clean */
          text-gray-900
          /* Dark mode - subtle premium */
          dark:text-white dark:drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]">
          🎓 Learn
        </h2>
      </div>
      
  
      
      <div className="mt-10 mx-auto font-geist relative">
        <div className="w-full md:mx-0">
          <div className="grid grid-cols-1 relative md:grid-rows-1 md:grid-cols-3 gap-4 md:gap-0">
            {features.map((feature, index) => (
              <Link
                key={feature.id}
                href={feature.href}
                className={cn(
                  "group block relative transform-gpu transition-all duration-300 ease-in-out",
                  /* Light mode - subtle sketch style */
                  "border-2 border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-500",
                  "shadow-[1px_1px_rgba(0,0,0,0.1)] hover:shadow-[2px_2px_rgba(0,0,0,0.15)]",
                  "hover:translate-x-[-1px] hover:translate-y-[-1px]",
                  /* Dark mode - clean premium */
                  "dark:border-slate-700 dark:bg-slate-900/50 dark:backdrop-blur-sm",
                  "dark:hover:border-slate-600 dark:hover:bg-slate-800/60",
                  "dark:shadow-[0_0_20px_rgba(59,130,246,0.05)]",
                  "dark:hover:shadow-[0_0_30px_rgba(59,130,246,0.1)]",
                  // Remove complex grid borders, use simple approach
                  index === 1 && "md:border-x-0 md:border-l-2 md:border-r-2 dark:md:border-l-slate-700 dark:md:border-r-slate-700"
                )}
              >
                <div className="flex flex-col p-10 h-full md:min-h-[240px] relative">
                  <div className="flex items-center gap-2 my-1">
                    <feature.icon className="w-4 h-4 transition-transform group-hover:scale-110 
                      text-gray-600 group-hover:text-gray-800
                      dark:text-slate-400 dark:group-hover:text-slate-200" />
                    <p className="text-gray-600 dark:text-slate-400 transition-colors">
                      {feature.label}
                    </p>
                  </div>
                  
                  <div className="mt-2">
                    <div className="max-w-full">
                      <div className="flex gap-3">
                        <p
                          className="max-w-lg text-xl font-normal tracking-tighter md:text-2xl
                            text-gray-900 dark:text-white"
                          dangerouslySetInnerHTML={{
                            __html: feature.title,
                          }}
                        />
                      </div>
                    </div>
                    
                    <p className="mt-2 text-sm text-left text-gray-600 dark:text-slate-300">
                      {feature.description}
                    </p>
                  </div>
                  
                  <div className="text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white mt-4 inline-flex items-center transition-colors">
                    Learn more
                    <svg
                      className="w-4 h-4 ml-1 transform transition-transform group-hover:translate-x-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
