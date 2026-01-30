"use client";

import Link from "next/link";
import { ConfigViewer, IntegrationsSection } from "@/components/console/blueprints/config-viewer";
import { defiConfig } from "@/components/console/blueprints/blueprint-configs";
import { DefiDemo } from "@/components/console/blueprints/defi-demo";

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

        {/* Interactive Demo */}
        <div className="mb-12">
          <DefiDemo />
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
            blueprintType="defi"
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
