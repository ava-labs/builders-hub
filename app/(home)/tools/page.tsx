"use client";

import React from "react";
import Image from 'next/image';
import Link from "next/link";
import {
  CircleFadingPlus,
  Plus,
  SendHorizontal,
  AlertCircle
} from "lucide-react";
import { cn } from "@/utils/cn";

const features = [
  {
    id: 1,
    label: "L1 Modules",
    title: "<strong>L1 Toolbox</strong>.",
    description: "Manage your L1 with a highly granular set of tools.",
    icon: CircleFadingPlus,
    href: "/tools/l1-toolbox"
  },
  {
    id: 2,
    label: "L1 Modules",
    title: "<strong>Interchain Messaging Tools</strong>.",
    description: "Set up Interchain Messaging (ICM) for your L1.",
    icon: CircleFadingPlus,
    href: "/tools/l1-toolbox"
  },
  {
    id: 3,
    label: "Faucet",
    title: "<strong>Fuji Testnet Faucet</strong>.",
    description: "Claim Fuji AVAX tokens from the testnet faucet to test your dApps.",
    icon: CircleFadingPlus,
    href: "https://core.app/tools/testnet-faucet/?subnet=c&token=c"
  },
  {
    id: 4,
    label: "dApp Development",
    title: "<strong>Avalanche Starter Kit</strong>.",
    description: "Spin up short-lived test environments for building dApps using interoperability features like ICM and ICTT.",
    icon: CircleFadingPlus,
    href: "https://github.com/ava-labs/avalanche-starter-kit"
  }
];

export default function Page() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      <main className="relative container mx-auto px-4 py-12 space-y-12 tools-page">
        <section className="text-center space-y-6 pt-8">
          <div className="flex justify-center mb-6">
            <Image
              src="/logo-black.png"
              alt="Avalanche Logo"
              width={200}
              height={50}
              className="dark:hidden"
            />
            <Image
              src="/logo-white.png"
              alt="Avalanche Logo"
              width={200}
              height={50}
              className="hidden dark:block"
            />
          </div>
          <h1 className="text-4xl md:text-7xl font-bold tracking-tighter">
            Builder <span className="pb-1 text-[#EB4C50]">Tooling</span>
          </h1>
        </section>

        <section className="flex flex-col justify-center items-center px-4 mb-16">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <p className="text-xl tracking-tight text-zinc-500 text-center">
              Find all the tools you will ever need to build on Avalanche.
            </p>
          </div>
          <div className="mt-10 mx-auto font-geist relative md:border-l-0 md:border-b-0 md:border-[1.2px] rounded-none -pr-2">
            <div className="w-full md:mx-0">
              <div className="grid grid-cols-1 relative md:grid-cols-2 border-b-[1.2px]">
                <div className="hidden md:grid top-1/2 left-0 -translate-y-1/2 w-full grid-cols-2 z-10 pointer-events-none select-none absolute">
                  <Plus className="w-8 h-8 text-neutral-300 translate-x-[16.5px] translate-y-[.5px] ml-auto dark:text-neutral-600" />
                </div>
                {features.map((feature, index) => (
                  <Link
                    key={feature.id}
                    href={feature.href}
                    className={cn(
                      "group block border-l-[1.2px] border-r-[1.2px] md:border-r-0 md:min-h-[200px] border-t-[1.2px] md:border-t-0 transform-gpu hover:bg-[#dfe3e8] dark:hover:bg-[#1c1c1c]",
                      index >= 2 && "md:border-t-[1.2px]",
                      feature.href === "#" && "opacity-50 cursor-not-allowed pointer-events-none",
                      "transition-all duration-300 ease-in-out"
                    )}
                  >
                    <div className="flex flex-col p-10 h-full">
                      <div className="flex items-center gap-2 my-1">
                        <feature.icon className="w-4 h-4 transition-transform group-hover:scale-110 group-hover:text-gray-800 dark:group-hover:text-zinc-300" />
                        <p className="text-gray-600 dark:text-gray-400">
                          {feature.label}
                        </p>
                      </div>
                      <div className="mt-2">
                        <div className="max-w-full">
                          <div className="flex gap-3">
                            <p
                              className="max-w-lg text-xl font-normal tracking-tighter md:text-2xl"
                              dangerouslySetInnerHTML={{
                                __html: feature.title,
                              }}
                            />
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-left text-muted-foreground">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
