'use client';

import React from 'react';
import Link from 'next/link';
import { BookOpen, GraduationCap, Coins, Shuffle } from 'lucide-react';
import { Input } from '@/components/toolbox/components/Input';
import { useEERCDeployStore } from '@/components/toolbox/stores/eercDeployStore';
import { ContractDeployViewer } from '@/components/console/contract-deploy-viewer';
import { ENCRYPTED_ERC_SOURCES, EERC_COMMIT } from '@/lib/eerc/contractSources';

export default function ConfigureStep() {
  const { mode, name, symbol, decimals, setMode, setName, setSymbol, setDecimals } = useEERCDeployStore();

  return (
    <ContractDeployViewer contracts={ENCRYPTED_ERC_SOURCES}>
      <div className="flex flex-col h-[500px] rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="flex-1 overflow-auto p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Configure your Encrypted ERC</h2>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Pick the mode and (for standalone) token metadata. All other parameters are protocol-defined. Decimals
              default to 2 — protocol-standard for eERC.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Mode</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ModeCard
                active={mode === 'standalone'}
                onClick={() => setMode('standalone')}
                icon={<Coins className="w-4 h-4" />}
                title="Standalone"
                description="Fresh private-native token. Owner mints to users via ZK proofs. No underlying ERC20."
              />
              <ModeCard
                active={mode === 'converter'}
                onClick={() => setMode('converter')}
                icon={<Shuffle className="w-4 h-4" />}
                title="Converter"
                description="Wraps existing ERC20s. Users deposit to encrypt, withdraw to unwrap. Multiple tokens per deployment."
              />
            </div>
          </div>

          {mode === 'standalone' ? (
            <div className="space-y-3">
              <Input label="Token name" value={name} onChange={setName} placeholder="Demo Private Token" />
              <Input label="Token symbol" value={symbol} onChange={setSymbol} placeholder="PRIV" />
            </div>
          ) : (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
              Converter mode ignores name/symbol — the contract rejects them at construction. Each wrapped ERC20 keeps
              its own metadata.
            </p>
          )}

          <Input
            label="Decimals (eERC internal)"
            value={String(decimals)}
            onChange={(v) => setDecimals(Number(v) || 2)}
            type="number"
            step="1"
          />
          <p className="-mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            Lower decimals = larger usable amounts; higher = finer granularity + more converter dust.
          </p>
        </div>

        <div className="shrink-0 px-5 py-4 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link
                href="/academy/encrypted-erc"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                Academy
              </Link>
              <a
                href={`https://github.com/ava-labs/EncryptedERC/blob/${EERC_COMMIT}/README.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Protocol README
              </a>
            </div>
            <a
              href={`https://github.com/ava-labs/EncryptedERC/tree/${EERC_COMMIT}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 font-mono transition-colors"
            >
              @{EERC_COMMIT.slice(0, 7)}
            </a>
          </div>
        </div>
      </div>
    </ContractDeployViewer>
  );
}

function ModeCard({
  active,
  onClick,
  icon,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'rounded-xl border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 p-3 text-left transition-colors'
          : 'rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-3 text-left hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors'
      }
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className={
            active
              ? 'inline-flex items-center justify-center size-7 rounded-full bg-blue-500 text-white'
              : 'inline-flex items-center justify-center size-7 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
          }
        >
          {icon}
        </span>
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</span>
      </div>
      <div className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">{description}</div>
    </button>
  );
}
