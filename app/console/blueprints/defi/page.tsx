"use client";

import Link from "next/link";
import { ConfigViewer, IntegrationsSection } from "@/components/console/blueprints/config-viewer";
import { defiConfig } from "@/components/console/blueprints/blueprint-configs";

export default function DeFiBlueprintPage() {
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

      <div className="relative max-w-4xl mx-auto">
        {/* Back link */}
        <Link
          href="/console/blueprints"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 mb-8 transition-colors"
        >
          ← Back to Blueprints
        </Link>

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-2xl font-medium text-zinc-900 dark:text-zinc-100 mb-2">
            DeFi
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            MEV-protected · Atomic settlement · Instant finality
          </p>
        </div>

        {/* Demo placeholder */}
        <div className="mb-12 p-8 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium mb-4">
              Demo coming soon
            </div>
            <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
              Instant Swap Demo
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mb-6">
              Experience sub-second swaps with MEV protection. Watch transactions execute atomically with no front-running.
            </p>

            {/* Swap UI placeholder */}
            <div className="max-w-xs mx-auto">
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 mb-2">
                <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
                  <span>From</span>
                  <span>Balance: 0.00</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    disabled
                    placeholder="0.0"
                    className="flex-1 bg-transparent text-xl text-zinc-900 dark:text-zinc-100 font-mono outline-none placeholder-zinc-300 dark:placeholder-zinc-600"
                  />
                  <div className="px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium">
                    AVAX
                  </div>
                </div>
              </div>

              <div className="flex justify-center -my-1.5 relative z-10">
                <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-700 border-2 border-white dark:border-zinc-900 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
                  <span>To</span>
                  <span>Balance: 0.00</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    disabled
                    placeholder="0.0"
                    className="flex-1 bg-transparent text-xl text-zinc-900 dark:text-zinc-100 font-mono outline-none placeholder-zinc-300 dark:placeholder-zinc-600"
                  />
                  <div className="px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium">
                    USDC
                  </div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center justify-center gap-6 mt-6 text-xs text-zinc-500">
              <span><span className="font-medium text-zinc-700 dark:text-zinc-300">~0.3s</span> finality</span>
              <span><span className="font-medium text-zinc-700 dark:text-zinc-300">0%</span> MEV loss</span>
              <span><span className="font-medium text-zinc-700 dark:text-zinc-300">Atomic</span> execution</span>
            </div>
          </div>
        </div>

        {/* Why DeFi L1 */}
        <div className="mb-12">
          <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">Why a DeFi L1?</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <div className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">MEV Protection</div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Fair transaction ordering prevents front-running and sandwich attacks.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <div className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">Instant Finality</div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Sub-second confirmation for trading applications.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <div className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">Atomic Settlement</div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Complex DeFi operations execute as single transactions.
              </p>
            </div>
          </div>
        </div>

        {/* Use Cases */}
        <div className="mb-12">
          <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">Use Cases</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              "Decentralized exchanges",
              "Lending protocols",
              "Derivatives platforms",
              "Perpetual futures",
              "Options trading",
              "Yield aggregators",
            ].map((useCase) => (
              <div
                key={useCase}
                className="flex items-center gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">{useCase}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Config */}
        <div className="mb-12">
          <ConfigViewer
            genesis={defiConfig.genesis}
            chainConfig={defiConfig.chainConfig}
          />
        </div>

        {/* Integrations */}
        <IntegrationsSection
          title="Recommended Integrations"
          description="DeFi infrastructure for trading applications."
          integrations={defiConfig.integrations}
        />
      </div>
    </div>
  );
}
