"use client";

import Link from "next/link";
import { ConfigViewer, IntegrationsSection } from "@/components/console/blueprints/config-viewer";
import { rwaConfig } from "@/components/console/blueprints/blueprint-configs";

export default function RWABlueprintPage() {
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
            Tokenization
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            KYC-native · Permissioned access · Full audit trail
          </p>
        </div>

        {/* Demo placeholder */}
        <div className="mb-12 p-8 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium mb-4">
              Demo coming soon
            </div>
            <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
              KYC Verification Flow
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mb-6">
              Experience the compliance-gated transaction flow. Only verified wallets can transact on this permissioned L1.
            </p>

            {/* Steps */}
            <div className="flex items-center justify-center gap-3 text-sm">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                <span className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs text-zinc-500">1</span>
                <span className="text-zinc-600 dark:text-zinc-400">Connect</span>
              </div>
              <span className="text-zinc-300 dark:text-zinc-600">→</span>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                <span className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs text-zinc-500">2</span>
                <span className="text-zinc-600 dark:text-zinc-400">Verify</span>
              </div>
              <span className="text-zinc-300 dark:text-zinc-600">→</span>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                <span className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs text-zinc-500">3</span>
                <span className="text-zinc-600 dark:text-zinc-400">Transact</span>
              </div>
            </div>
          </div>
        </div>

        {/* Why Tokenization L1 */}
        <div className="mb-12">
          <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">Why a Tokenization L1?</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <div className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">Built-in KYC</div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Transactor allowlist ensures only verified addresses can interact.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <div className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">Permissioned</div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Control who can deploy contracts and send transactions.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <div className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">Audit Trail</div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Every transaction is recorded for regulatory compliance.
              </p>
            </div>
          </div>
        </div>

        {/* Use Cases */}
        <div className="mb-12">
          <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">Use Cases</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              "Securities tokenization",
              "Real estate fractionalization",
              "Private equity tokens",
              "Commodity-backed assets",
              "Bond issuance",
              "Fund administration",
            ].map((useCase) => (
              <div
                key={useCase}
                className="flex items-center gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">{useCase}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Config */}
        <div className="mb-12">
          <ConfigViewer
            genesis={rwaConfig.genesis}
            chainConfig={rwaConfig.chainConfig}
          />
        </div>

        {/* Integrations */}
        <IntegrationsSection
          title="Recommended Integrations"
          description="Enterprise services for compliant asset tokenization."
          integrations={rwaConfig.integrations}
        />
      </div>
    </div>
  );
}
