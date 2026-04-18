'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Sparkles, Zap } from 'lucide-react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useStartDeployment } from '@/hooks/useQuickL1Deploy';
import { cn } from '@/lib/utils';

/**
 * Basic Setup intake form.
 *
 * Deliberately minimal: chain name, token symbol, owner address
 * (pre-filled from connected wallet). Everything else — genesis config,
 * node count, validator type, interoperability — is chosen for them.
 * The whole point of Basic is "do it for me."
 */
export default function BasicSetupForm() {
  const router = useRouter();
  const { walletEVMAddress, isTestnet } = useWalletStore();
  const { deploy, submitting, error } = useStartDeployment();

  const [chainName, setChainName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [ownerAddress, setOwnerAddress] = useState<string>(walletEVMAddress || '');

  // Keep the owner field in sync with the connected wallet when the user
  // hasn't manually edited it. `touched` prevents us from stomping a
  // deliberate override.
  const [ownerTouched, setOwnerTouched] = useState(false);
  useMemo(() => {
    if (!ownerTouched && walletEVMAddress && !ownerAddress) setOwnerAddress(walletEVMAddress);
  }, [walletEVMAddress, ownerAddress, ownerTouched]);

  const canSubmit =
    chainName.trim().length >= 2 && tokenSymbol.trim().length >= 2 && /^0x[a-fA-F0-9]{40}$/.test(ownerAddress);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;

    const jobId = await deploy({
      chainName: chainName.trim(),
      tokenSymbol: tokenSymbol.trim().toUpperCase(),
      ownerEvmAddress: ownerAddress as `0x${string}`,
      network: 'fuji',
    });

    if (jobId) router.push(`/console/create-l1/basic/${jobId}`);
  }

  return (
    <div className="mx-auto max-w-2xl py-8">
      {/* Back link — takes the user back to the setup choice card */}
      <button
        type="button"
        onClick={() => router.push('/console/create-l1')}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="mb-8">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 px-3 py-1 text-[11px] font-semibold tracking-wide uppercase text-blue-700 dark:text-blue-300">
          <Zap className="h-3 w-3" />
          Basic setup
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Deploy your L1</h1>
        <p className="mt-2 text-[15px] text-zinc-500 dark:text-zinc-400">
          Give your chain a name and we&apos;ll handle everything else — subnet, genesis, validator node, conversion,
          and validator manager.
        </p>
      </div>

      {/* Testnet-only banner for MVP */}
      {!isTestnet && (
        <div className="mb-6 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-4 py-3">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Basic setup is Fuji-testnet only right now. Switch your wallet to Fuji to continue — or pick Advanced for
            mainnet deploys.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field
          label="Chain name"
          hint="Shown in wallets and explorers. 2–32 characters."
          value={chainName}
          onChange={setChainName}
          placeholder="My Awesome L1"
          maxLength={32}
          autoFocus
        />
        <Field
          label="Token symbol"
          hint="Native currency ticker. 2–6 characters, uppercase."
          value={tokenSymbol}
          onChange={(v) => setTokenSymbol(v.toUpperCase())}
          placeholder="MYTOKEN"
          maxLength={6}
          mono
        />
        <Field
          label="Owner address"
          hint="Will receive 1M initial tokens and own the Validator Manager."
          value={ownerAddress}
          onChange={(v) => {
            setOwnerTouched(true);
            setOwnerAddress(v);
          }}
          placeholder="0x…"
          mono
        />

        {/* Mini summary of what we'll configure for them */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            <Sparkles className="h-3 w-3" />
            What we&apos;ll set up
          </div>
          <ul className="space-y-1.5 text-sm text-zinc-600 dark:text-zinc-300">
            <li>• Subnet-EVM chain with sensible gas + genesis defaults</li>
            <li>• Warp + Teleporter messenger preinstalled for cross-chain messaging</li>
            <li>• 1 managed Fuji validator node (3-day TTL)</li>
            <li>• Proof-of-Authority Validator Manager deployed on the L1</li>
            <li>• Subnet + Validator Manager ownership transferred to your address</li>
          </ul>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end pt-2">
          <motion.button
            type="submit"
            disabled={!canSubmit || submitting}
            whileHover={canSubmit && !submitting ? { y: -2, scale: 1.01 } : {}}
            whileTap={canSubmit && !submitting ? { scale: 0.98 } : {}}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={cn(
              'group inline-flex items-center gap-3 rounded-xl px-8 py-3.5 text-base font-semibold transition-colors',
              canSubmit && !submitting
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100'
                : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed',
            )}
            style={
              canSubmit && !submitting
                ? { boxShadow: '0 4px 14px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1)' }
                : undefined
            }
          >
            {submitting ? 'Starting deployment…' : 'Deploy L1'}
            {!submitting && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
          </motion.button>
        </div>
      </form>
    </div>
  );
}

/** Simple labeled text field with hint + optional mono font. */
function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  maxLength,
  mono,
  autoFocus,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  mono?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-200">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus={autoFocus}
        className={cn(
          'w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:border-zinc-400 dark:focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-800 transition-colors',
          mono && 'font-mono',
        )}
      />
      {hint && <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
    </div>
  );
}
