"use client";

import React from "react";
import { cn } from "@/utils/cn";
import Link from "next/link";
import { Sponsors } from '@/components/landing/globe';

export default function Hero() {
  return (
    <section className="h-screen md:h-[40rem] w-full flex items-center justify-center antialiased bg-grid-white/[0.02] relative overflow-hidden px-4 md:px-8">
      <div className="absolute inset-0 h-screen md:h-[40rem] overflow-hidden pointer-events-none">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(80, 80, 80, 0.3)" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="w-full max-w-fd-container bg-transparent md:px-10 dark:-mb-32 dark:mt-[-4.75rem] dark:pb-32 dark:pt-[4.75rem]">
        <div className="lg:max-w-8xl mx-auto grid max-w-full grid-cols-1 items-center gap-y-8 md:gap-y-16 px-0 py-8 lg:grid-cols-2 lg:gap-x-8 lg:px-8 xl:gap-x-16 xl:px-12">
          <div className="relative z-10 text-center lg:text-left">
            <div className="relative">
              <div className="flex flex-col items-center lg:items-start gap-2">
                <div className="flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="1.25em" height="1.25em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide-infinity"><path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z"/></svg>
                  <span className="text-sm text-opacity-75">Scale Without Limits</span>
                </div>
              </div>

              <p className="text-zinc-800 dark:text-zinc-300 mt-3 tracking-tight text-xl md:text-2xl lg:text-3xl px-4 md:px-0">
                Build your Fast & Interoperable Layer 1 Blockchain with Avalanche.
              </p>

              <div className="mt-8 flex flex-col gap-4 items-center lg:items-start lg:flex-row">
                <Link
                  href="/academy/avalanche-fundamentals"
                  className="w-full md:w-auto hover:shadow-sm dark:border-stone-100 dark:hover:shadow-sm border-2 border-black bg-white px-4 py-1.5 text-sm uppercase text-black shadow-[1px_1px_rgba(0,0,0),2px_2px_rgba(0,0,0),3px_3px_rgba(0,0,0),4px_4px_rgba(0,0,0),5px_5px_0px_0px_rgba(0,0,0)] transition duration-200 md:px-8 dark:shadow-[1px_1px_rgba(255,255,255),2px_2px_rgba(255,255,255),3px_3px_rgba(255,255,255),4px_4px_rgba(255,255,255),5px_5px_0px_0px_rgba(255,255,255)]"
                >
                  Start Learning
                </Link>
                <Link 
                  href="/academy" 
                  className="w-full md:w-auto bg-stone-950 no-underline group cursor-pointer relative p-px text-xs font-semibold leading-6 text-white inline-block"
                  type="button"
                >
                  <span className="absolute inset-0 overflow-hidden rounded-sm">
                    <span className="absolute inset-0 rounded-sm bg-[image:radial-gradient(75%_100%_at_50%_0%,rgba(56,189,248,0.6)_0%,rgba(56,189,248,0)_75%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"></span>
                  </span>
                  <div className="relative flex space-x-2 items-center justify-center z-10 rounded-none bg-zinc-950 py-2 px-4 ring-1 ring-white/10">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-graduation-cap"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></svg>
                    <span>Explore all Courses</span>
                  </div>
                  <span className="absolute -bottom-0 left-[1.125rem] h-px w-[calc(100%-2.25rem)] bg-gradient-to-r from-emerald-400/0 via-stone-800/90 to-emerald-400/0 transition-opacity duration-500 group-hover:opacity-40"></span>
                </Link>
              </div>
            </div>
          </div>

          <div className="hidden xl:block lg:static xl:pl-10">
            <div className="relative">
              <div className="absolute inset-0 rounded-none bg-gradient-to-tr opacity-5 blur-lg" />
              <div className="absolute inset-0 rounded-none bg-gradient-to-tr opacity-5" />
              <Sponsors />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function GradientBG({
	children,
	className,
	...props
}: React.PropsWithChildren<
	{
		className?: string;
	} & React.HTMLAttributes<HTMLElement>
>) {
	return (
		<div
			className={cn(
				"relative flex content-center items-center flex-col flex-nowrap h-min justify-center overflow-visible p-px w-full",
			)}
			{...props}
		>
			<div className={cn("w-auto z-10 px-4 py-2 rounded-none", className)}>
				{children}
			</div>
			<div className="bg-zinc-100 dark:bg-zinc-950 absolute z-1 flex-none inset-[2px] " />
		</div>
	);
}