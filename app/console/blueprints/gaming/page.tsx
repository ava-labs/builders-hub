"use client";

import Link from "next/link";
import { ConfigViewer, IntegrationsSection } from "@/components/console/blueprints/config-viewer";
import { gamingConfig } from "@/components/console/blueprints/blueprint-configs";
import { GamingDemo } from "@/components/console/blueprints/gaming-demo";

export default function GamingBlueprintPage() {
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
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative max-w-5xl mx-auto">
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
            Gaming
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            Sub-second blocks · Near-zero fees · Every click is an on-chain transaction
          </p>
        </div>

        {/* Interactive Demo */}
        <div className="mb-12">
          <GamingDemo />
        </div>

        {/* Why Gaming L1 */}
        <div className="mb-12">
          <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">Why a Gaming L1?</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <div className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">Sub-Second Blocks</div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Avalanche L1s support block times down to 200ms — game actions feel instant.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <div className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">Near-Zero Fees</div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                At ~$0.00001 per tx, players can make thousands of moves.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <div className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">High Throughput</div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                20M gas limit handles many concurrent players on-chain.
              </p>
            </div>
          </div>
        </div>

        {/* Config */}
        <div className="mb-12">
          <ConfigViewer
            genesis={gamingConfig.genesis}
            chainConfig={gamingConfig.chainConfig}
            blueprintType="gaming"
          />
        </div>

        {/* Integrations */}
        <IntegrationsSection
          title="Recommended Integrations"
          description="Third-party services for gaming on Avalanche."
          integrations={gamingConfig.integrations}
        />
      </div>
    </div>
  );
}
