"use client";

import React from "react";
import { Award, GraduationCap } from "lucide-react";
import { cn } from "@/utils/cn";
import Link from "next/link";

export default function AcademySplash() {
  return (
    <div className="flex flex-col px-4 mb-20 py-16 lg:py-24 bg-gray-50/80 dark:bg-[rgba(15,15,15,0.4)] -mx-4">
      <div className="mt-12 mx-auto font-geist relative max-w-7xl w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Left side - Academy Info */}
          <div className="flex flex-col justify-center">
            <div className="mb-4">
              <span className="text-sm font-medium text-gray-600 dark:text-slate-400 tracking-wide uppercase">
                LEARN
              </span>
            </div>
            
            <h2 className="font-display text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight mb-6
              text-gray-900 dark:text-white">
              Avalanche Academy
            </h2>
            
            <p className="text-gray-600 dark:text-slate-300 leading-relaxed text-lg mb-8 max-w-2xl">
              We offer fundamental courses specifically designed for individuals who are new to the Avalanche 
              ecosystem, and advanced courses for those who wish to master the art of configuring, modifying, or even 
              creating entirely new Virtual Machines from scratch.
            </p>
            
            <div>
              <Link
                href="/academy"
                className={cn(
                  "inline-flex items-center gap-3 px-8 py-4 rounded-lg font-medium text-base",
                  "transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1)",
                  /* Light mode */
                  "bg-gray-900 text-white hover:bg-gray-800",
                  "border border-gray-900 hover:border-gray-800",
                  "shadow-[0_4px_14px_0_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_0_rgba(0,0,0,0.15)]",
                  /* Dark mode */
                  "dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100",
                  "dark:border-white dark:hover:border-gray-100",
                  "hover:-translate-y-0.5"
                )}
              >
                <GraduationCap className="w-5 h-5" />
                Start learning
              </Link>
            </div>
          </div>
          
          {/* Right side - Certification Bento */}
          <div className="w-full max-w-lg">
            <div className="grid grid-cols-2 gap-4">
              {/* Main Certificate Card */}
              <div className={cn(
                "col-span-2 p-6 rounded-2xl relative overflow-hidden",
                "bg-gradient-to-br from-white via-gray-50/50 to-slate-50/30 dark:from-gray-900/90 dark:via-gray-800/40 dark:to-gray-900/60",
                "border border-gray-200/60 dark:border-gray-700/50",
                "shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]",
                "backdrop-blur-sm"
              )}>
                {/* Subtle decorative elements */}
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-slate-200/20 to-gray-300/10 rounded-full blur-3xl dark:from-gray-600/20 dark:to-gray-700/10"></div>
                <div className="absolute bottom-0 left-0 w-16 h-16 bg-gradient-to-tr from-slate-300/15 to-gray-400/10 rounded-full blur-2xl dark:from-gray-500/15 dark:to-gray-600/10"></div>
                
                <div className="relative z-10 flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                      Official Certification
                    </h3>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      Avalanche Developer
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center shadow-lg shadow-slate-700/20 dark:from-slate-200 dark:to-slate-300 dark:shadow-slate-200/20">
                    <Award className="w-6 h-6 text-white dark:text-slate-800" />
                  </div>
                </div>
                <div className="relative z-10 space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-300 font-medium">Completion Progress</span>
                    <span className="font-bold text-gray-900 dark:text-white text-base">78%</span>
                  </div>
                  <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-600 to-slate-700 rounded-full w-[78%] shadow-sm dark:from-slate-300 dark:to-slate-400"></div>
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-500/40 to-slate-600/40 rounded-full w-[78%] animate-pulse dark:from-slate-200/40 dark:to-slate-300/40"></div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Complete 3 more courses to earn your certification
                  </p>
                </div>
              </div>
              
              {/* Courses Completed */}
              <div className={cn(
                "p-4 rounded-2xl relative overflow-hidden",
                "bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/30 dark:to-gray-900/50",
                "border border-slate-200/60 dark:border-slate-700/40",
                "shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
              )}>
                <div className="absolute top-0 right-0 w-8 h-8 bg-slate-300/20 rounded-full blur-sm dark:bg-slate-600/20"></div>
                <div className="relative text-center">
                  <div className="text-3xl font-black text-slate-700 dark:text-slate-300 mb-1">
                    12
                  </div>
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Courses<br />Completed
                  </div>
                </div>
              </div>
              
              {/* Hours Studied */}
              <div className={cn(
                "p-4 rounded-2xl relative overflow-hidden",
                "bg-gradient-to-br from-zinc-50 to-white dark:from-zinc-800/30 dark:to-gray-900/50",
                "border border-zinc-200/60 dark:border-zinc-700/40",
                "shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
              )}>
                <div className="absolute top-0 right-0 w-8 h-8 bg-zinc-300/20 rounded-full blur-sm dark:bg-zinc-600/20"></div>
                <div className="relative text-center">
                  <div className="text-3xl font-black text-zinc-700 dark:text-zinc-300 mb-1">
                    48
                  </div>
                  <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Hours<br />Studied
                  </div>
                </div>
              </div>
              
              {/* Skills Mastered */}
              <div className={cn(
                "col-span-2 p-5 rounded-2xl relative overflow-hidden",
                "bg-gradient-to-br from-gray-50 via-white to-slate-50/30 dark:from-gray-800/30 dark:via-gray-900/50 dark:to-slate-900/40",
                "border border-gray-200/60 dark:border-gray-700/40",
                "shadow-[0_6px_24px_rgba(0,0,0,0.05)] dark:shadow-[0_6px_24px_rgba(0,0,0,0.2)]"
              )}>
                <div className="absolute top-0 right-0 w-12 h-12 bg-gradient-to-br from-gray-300/15 to-slate-400/10 rounded-full blur-xl dark:from-gray-600/15 dark:to-slate-700/10"></div>
                <div className="relative flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    Skills Mastered
                  </h4>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-slate-500 rounded-full animate-pulse dark:bg-slate-400"></div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      8/12
                    </span>
                  </div>
                </div>
                <div className="relative flex flex-wrap gap-2">
                  <span className="px-3 py-1.5 text-xs font-semibold bg-slate-700 text-white rounded-lg shadow-sm dark:bg-slate-200 dark:text-slate-800">
                    Smart Contracts
                  </span>
                  <span className="px-3 py-1.5 text-xs font-semibold bg-gray-700 text-white rounded-lg shadow-sm dark:bg-gray-200 dark:text-gray-800">
                    Avalanche L1s
                  </span>
                  <span className="px-3 py-1.5 text-xs font-semibold bg-zinc-700 text-white rounded-lg shadow-sm dark:bg-zinc-200 dark:text-zinc-800">
                    Interoperability
                  </span>
                  <span className="px-3 py-1.5 text-xs font-semibold bg-stone-700 text-white rounded-lg shadow-sm dark:bg-stone-200 dark:text-stone-800">
                    Custom VMs
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 