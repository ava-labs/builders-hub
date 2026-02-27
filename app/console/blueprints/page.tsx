"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { LayoutGrid, Table2 } from "lucide-react";
import { BlueprintComparison } from "@/components/console/blueprints/blueprint-comparison";

const blueprints = [
  {
    id: "gaming",
    title: "Gaming",
    subtitle: "10,000 TPS · Sub-second finality",
    description: "For studios building fully on-chain games where every player action needs to settle instantly.",
    href: "/console/blueprints/gaming",
  },
  {
    id: "rwa",
    title: "Tokenization",
    subtitle: "KYC-native · Permissioned",
    description: "For regulated assets—securities, real estate, private equity—with built-in compliance.",
    href: "/console/blueprints/rwa",
  },
  {
    id: "defi",
    title: "DeFi",
    subtitle: "MEV-protected · Atomic settlement",
    description: "For trading applications where fair ordering and instant finality are non-negotiable.",
    href: "/console/blueprints/defi",
  },
];

type ViewMode = "cards" | "table";

export default function BlueprintsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  return (
    <div className="relative -m-8 p-8 min-h-full">
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-[0.35] dark:opacity-[0.12]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgb(148 163 184 / 0.4) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(148 163 184 / 0.4) 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px',
        }}
      />

      <div className={cn(
        "relative mx-auto py-8",
        viewMode === "cards" ? "max-w-2xl" : "max-w-5xl"
      )}>
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div className="text-center flex-1">
            <h1 className="text-4xl font-medium text-zinc-900 dark:text-zinc-100 tracking-tight">
              Blueprints
            </h1>
            <p className="mt-3 text-zinc-500 dark:text-zinc-400">
              Pre-configured L1s for common use cases
            </p>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800">
            <button
              onClick={() => setViewMode("cards")}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                viewMode === "cards"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              )}
            >
              <LayoutGrid className="w-4 h-4" />
              Cards
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                viewMode === "table"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              )}
            >
              <Table2 className="w-4 h-4" />
              Compare
            </button>
          </div>
        </div>

        {/* Content based on view mode */}
        {viewMode === "cards" ? (
          <>
            {/* Blueprint Cards */}
            <div className="space-y-4">
              {blueprints.map((blueprint, index) => (
                <Link
                  key={blueprint.id}
                  href={blueprint.href}
                  className="group block"
                >
                  <div className="relative p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 transition-all duration-300 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-xl hover:shadow-zinc-200/50 dark:hover:shadow-zinc-900/50">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-baseline gap-3">
                          <span className="text-[13px] tabular-nums text-zinc-400 dark:text-zinc-500">
                            0{index + 1}
                          </span>
                          <h2 className="text-xl font-medium text-zinc-900 dark:text-zinc-100">
                            {blueprint.title}
                          </h2>
                        </div>
                        <p className="mt-1 ml-7 text-[13px] text-zinc-500 dark:text-zinc-500 font-medium">
                          {blueprint.subtitle}
                        </p>
                        <p className="mt-3 ml-7 text-[15px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                          {blueprint.description}
                        </p>
                      </div>
                      <div className="shrink-0 mt-1 w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-zinc-900 dark:group-hover:bg-zinc-100 transition-colors">
                        <svg
                          className="w-4 h-4 text-zinc-400 group-hover:text-white dark:group-hover:text-zinc-900 transition-colors"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Divider */}
            <div className="my-12 flex items-center gap-4">
              <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
              <span className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">or</span>
              <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
            </div>

            {/* Custom L1 Option */}
            <Link
              href="/console/layer-1/create"
              className="group block text-center"
            >
              <span className="text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">
                Start from scratch
              </span>
              <span className="ml-2 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">
                →
              </span>
            </Link>
          </>
        ) : (
          <>
            {/* Comparison Table */}
            <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 overflow-hidden">
              <BlueprintComparison />
            </div>

            {/* Divider */}
            <div className="my-12 flex items-center gap-4">
              <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
              <span className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">or</span>
              <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
            </div>

            {/* Custom L1 Option */}
            <Link
              href="/console/layer-1/create"
              className="group block text-center"
            >
              <span className="text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">
                Start from scratch
              </span>
              <span className="ml-2 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">
                →
              </span>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
