"use client";

import React from "react";
import { Trophy, ArrowRight, BookOpen, Award, Zap } from "lucide-react";
import { cn } from "@/utils/cn";
import Link from "next/link";
import Image from "next/image";

const features = [
  {
    id: 1,
    title: "Interactive Courses",
    description: "Hands-on blockchain courses",
    icon: BookOpen,
    href: "/academy"
  },
  {
    id: 2,
    title: "Hackathons",
    description: "Compete for prizes",
    icon: Trophy,
    href: "/hackathons"
  },
  {
    id: 3,
    title: "Bounties",
    description: "Earn by contributing",
    icon: Zap,
    href: "/grants"
  },
  {
    id: 4,
    title: "Certificates",
    description: "Showcase your skills",
    icon: Award,
    href: "/login"
  }
];

export default function AcademySplash() {
  return (
    <div className="flex flex-col px-4 mb-20">
      <div className="flex items-center gap-3 mb-6 mx-auto max-w-7xl w-full">
        <h2 className="text-sm font-medium tracking-wider text-zinc-500 dark:text-zinc-400 uppercase">
          Avalanche Academy
        </h2>
      </div>
      
      <div className="mx-auto font-geist relative max-w-7xl w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Left - Description */}
          <div className={cn(
            "p-8 rounded-lg",
            "bg-zinc-50/50 dark:bg-zinc-900/50",
            "border border-zinc-200/50 dark:border-zinc-800/50"
          )}>
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">
              Learn. Build. Earn.
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
              Join thousands of developers learning blockchain through hands-on courses, 
              hackathons, and real bounties. Track your progress and earn rewards.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/academy"
                className={cn(
                  "group inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg",
                  "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium",
                  "hover:bg-zinc-800 dark:hover:bg-zinc-200",
                  "transition-all duration-150"
                )}
              >
                <span>Start Learning</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              
              <Link
                href="/login"
                className={cn(
                  "group inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg",
                  "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium",
                  "hover:bg-zinc-200 dark:hover:bg-zinc-700",
                  "transition-all duration-150"
                )}
              >
                <span>Create Account</span>
              </Link>
            </div>
          </div>

          {/* Right - Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className={cn(
              "p-6 rounded-lg",
              "bg-zinc-50/50 dark:bg-zinc-900/50",
              "border border-zinc-200/50 dark:border-zinc-800/50"
            )}>
              <div className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">12+</div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">Courses</div>
            </div>
            <div className={cn(
              "p-6 rounded-lg",
              "bg-zinc-50/50 dark:bg-zinc-900/50",
              "border border-zinc-200/50 dark:border-zinc-800/50"
            )}>
              <div className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">5K+</div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">Students</div>
            </div>
            <div className={cn(
              "p-6 rounded-lg",
              "bg-zinc-50/50 dark:bg-zinc-900/50",
              "border border-zinc-200/50 dark:border-zinc-800/50"
            )}>
              <div className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">$50K+</div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">In Prizes</div>
            </div>
            <div className={cn(
              "p-6 rounded-lg",
              "bg-zinc-50/50 dark:bg-zinc-900/50",
              "border border-zinc-200/50 dark:border-zinc-800/50"
            )}>
              <div className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">100%</div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">Free</div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {features.map((feature) => (
            <Link
              key={feature.id}
              href={feature.href}
              className={cn(
                "group block p-4 rounded-lg transition-all duration-150",
                "bg-zinc-50/50 dark:bg-zinc-900/50",
                "border border-zinc-200/50 dark:border-zinc-800/50",
                "hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50",
                "hover:border-zinc-300/50 dark:hover:border-zinc-700/50"
              )}
            >
              <div className="flex flex-col h-full min-h-[100px]">
                <div className="mb-3">
                  <feature.icon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-medium mb-1 text-zinc-900 dark:text-zinc-100">
                    {feature.title}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-500 leading-snug">
                    {feature.description}
                  </p>
                </div>
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