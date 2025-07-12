"use client";

import React from "react";
import { GraduationCap, ChevronRight, Code2, Sparkles, TrendingUp, Trophy, Flame, ArrowRight, BookOpen } from "lucide-react";
import { cn } from "@/utils/cn";
import Link from "next/link";
import Image from "next/image";

export default function AcademySplash() {
  return (
    <div className="flex flex-col px-4 mb-20 py-16 lg:py-24">
      <div className="mt-12 mx-auto relative max-w-7xl w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left side - Academy Info */}
          <div className="flex flex-col justify-center space-y-8">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2">
                <GraduationCap className="size-5 text-zinc-600 dark:text-zinc-400" />
                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">
                  Learn & Build
                </span>
              </div>
              
              <h2 className="text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight">
                <span className="text-zinc-900 dark:text-white">
                  Avalanche
                </span>
                <span className="block text-red-600">
                  Academy
                </span>
              </h2>
              
              <p className="text-lg lg:text-xl text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-xl">
                Join thousands of developers learning blockchain through hands-on courses, 
                hackathons, and real bounties. Track your progress and earn rewards.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/academy"
                className={cn(
                  "group inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl",
                  "bg-blue-600 hover:bg-blue-700 text-white font-medium",
                  "transition-all duration-200",
                  "shadow-lg hover:shadow-xl"
                )}
              >
                <span>Start Learning</span>
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              
              <Link
                href="/hackathons"
                className={cn(
                  "group inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl",
                  "bg-white dark:bg-zinc-900/50 text-zinc-900 dark:text-white",
                  "border border-zinc-200 dark:border-zinc-800",
                  "font-medium",
                  "transition-all duration-200",
                  "hover:border-zinc-300 dark:hover:border-zinc-700"
                )}
              >
                <Trophy className="size-5" />
                <span>Join Hackathons</span>
              </Link>
            </div>
          </div>
          
          {/* Right side - Wolfie Profile Card */}
          <div className="relative">
            {/* Main Profile Card */}
            <div className={cn(
              "relative bg-white dark:bg-zinc-900/50 rounded-2xl",
              "border border-zinc-200 dark:border-zinc-800",
              "shadow-xl dark:shadow-2xl p-8"
            )}>
              {/* Header with Wolfie */}
              <div className="flex items-center gap-6 mb-8">
                <div className="relative">
                  <div className="size-20 rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                    <Image 
                      src="/wolfie/wolfie-hack.png" 
                      alt="Intern Wolfie"
                      width={80}
                      height={80}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute -bottom-2 -right-2 flex items-center gap-1 bg-red-600 text-white px-2 py-1 rounded-lg">
                    <Flame className="size-3" />
                    <span className="text-xs font-bold">42</span>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-1">
                    Wolfie Hacks
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Level 15 • Master Builder
                  </p>
                </div>
              </div>

              {/* Progress */}
              <div className="space-y-6 mb-8">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Academy Progress
                    </span>
                    <span className="text-sm font-bold text-zinc-900 dark:text-white">78%</span>
                  </div>
                  <div className="relative h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-blue-600 rounded-full w-[78%] transition-all duration-700"></div>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="text-center">
                  <div className="text-2xl font-bold text-zinc-900 dark:text-white">12</div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">Certificates</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-zinc-900 dark:text-white">7</div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">Bounties</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-zinc-900 dark:text-white">3</div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">Hackathons</div>
                </div>
              </div>

              {/* Current Focus */}
              <Link 
                href="/academy/icm-chainlink"
                className="block relative overflow-hidden bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 mb-6 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors group"
              >
                <div className="relative flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700 transition-colors">
                    <BookOpen className="size-5 text-zinc-700 dark:text-zinc-300" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">
                      Currently Learning
                    </p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      Chainlink VRF with Avalanche ICM
                    </p>
                  </div>
                  <ChevronRight className="size-4 text-zinc-400 dark:text-zinc-600 group-hover:text-zinc-600 dark:group-hover:text-zinc-400 transition-colors" />
                </div>
              </Link>

              {/* CTA */}
              <Link
                href="/login"
                className={cn(
                  "w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl",
                  "bg-blue-600 hover:bg-blue-700",
                  "text-white font-medium text-sm",
                  "transition-all duration-200 group"
                )}
              >
                <span>Create Account</span>
                <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 