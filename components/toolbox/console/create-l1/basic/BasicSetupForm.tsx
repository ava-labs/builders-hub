'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Sparkles, Loader2 } from 'lucide-react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useStartDeployment } from '@/hooks/useQuickL1Deploy';
import { DEFAULT_PRECOMPILES, type PrecompileConfig } from '@/lib/quick-l1/types';
import { cn } from '@/lib/utils';

/**
 * Basic Setup intake form.
 *
 * Three inputs, one big button. The rest of the console lives inside
 * tool containers (with the Container chrome); this page is the front
 * door to the one-click flow and deliberately breaks the pattern to
 * feel welcoming and airy.
 *
 * Design goals:
 *   - Generous vertical breathing room, not cramped
 *   - Inputs feel substantial — rounded-xl, soft bg, large text
 *   - Only one primary CTA; everything else is muted link-level
 *   - Staggered entrance animation to establish "this is a moment"
 */
export default function BasicSetupForm() {
  const router = useRouter();
  const { walletEVMAddress, isTestnet } = useWalletStore();
  const { deploy, submitting, error } = useStartDeployment();

  const [chainName, setChainName] = useState('');
  const [ownerAddress, setOwnerAddress] = useState<string>('');
  const [ownerTouched, setOwnerTouched] = useState(false);
  const [precompiles, setPrecompiles] = useState<Required<PrecompileConfig>>(DEFAULT_PRECOMPILES);

  const togglePrecompile = (key: keyof PrecompileConfig) => {
    setPrecompiles((p) => ({ ...p, [key]: !p[key] }));
  };

  // Pre-fill owner with the connected wallet address on first render
  // (and only when the user hasn't typed yet). Prevents stomping a
  // deliberate override on rerenders.
  useEffect(() => {
    if (!ownerTouched && walletEVMAddress && !ownerAddress) {
      setOwnerAddress(walletEVMAddress);
    }
  }, [walletEVMAddress, ownerAddress, ownerTouched]);

  const canSubmit = chainName.trim().length >= 2 && /^0x[a-fA-F0-9]{40}$/.test(ownerAddress);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!canSubmit || submitting) return;
    // Token symbol is cosmetic — it only shows up in wallet network
    // metadata and explorer labels. Derive a sensible default from the
    // chain name (first 5 uppercase letters, stripped of non-alpha)
    // so users don't have to think about it. Falls back to "COIN" if
    // the name has no alpha characters.
    const derived = chainName
      .replace(/[^A-Za-z]/g, '')
      .toUpperCase()
      .slice(0, 5);
    const tokenSymbol = derived.length >= 2 ? derived : 'COIN';

    const jobId = await deploy({
      chainName: chainName.trim(),
      tokenSymbol,
      ownerEvmAddress: ownerAddress as `0x${string}`,
      network: 'fuji',
      precompiles,
    });
    if (jobId) router.push(`/console/create-l1/basic/${jobId}`);
  }

  return (
    <div className="mx-auto max-w-5xl py-6 px-4">
      {/* Back link — subtle, top-left */}
      <motion.button
        type="button"
        onClick={() => router.push('/console/create-l1')}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        whileHover={{ x: -2 }}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to setup choice
      </motion.button>

      {/* Hero — tighter so the form below fits without scroll */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="mb-6"
      >
        <div className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
          <Sparkles className="h-3 w-3" />
          Basic setup
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Create your L1</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400 max-w-2xl">
          Name your chain and pick an owner. We&apos;ll configure the subnet, genesis, a managed validator node, and the
          Validator Manager for you.
        </p>
      </motion.div>

      {/* Testnet preflight */}
      {!isTestnet && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="mb-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-200"
        >
          Basic setup is Fuji-testnet only. Switch your wallet to Fuji to continue.
        </motion.div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Split-pane: fields on the left, precompiles on the right.
            Stacks on narrow screens (below lg) so mobile stays usable. */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } },
          }}
          className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-5 lg:gap-6"
        >
          {/* Left: chain name + owner */}
          <div className="space-y-4">
            <BigField
              label="Chain name"
              hint="Registered on the Avalanche P-Chain. 2–32 characters."
              value={chainName}
              onChange={setChainName}
              placeholder="My Awesome L1"
              maxLength={32}
            />
            <BigField
              label="Owner address"
              hint="Receives 1M initial tokens and owns the Validator Manager."
              value={ownerAddress}
              onChange={(v) => {
                setOwnerTouched(true);
                setOwnerAddress(v);
              }}
              placeholder="0x…"
              mono
            />
          </div>

          {/* Right: precompile toggles — admin-listed to the owner address */}
          <PrecompileCard precompiles={precompiles} onToggle={togglePrecompile} />
        </motion.div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-300"
          >
            {error}
          </motion.div>
        )}

        {/* CTA — deliberately prominent; full-width below the split */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.45 }}
          className="mt-6"
        >
          <motion.button
            type="submit"
            disabled={!canSubmit || submitting}
            whileHover={canSubmit && !submitting ? { y: -2 } : {}}
            whileTap={canSubmit && !submitting ? { scale: 0.99 } : {}}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={cn(
              'group relative w-full inline-flex items-center justify-center gap-3 rounded-xl px-6 py-3.5 text-base font-semibold transition-colors',
              canSubmit && !submitting
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed',
            )}
            style={
              canSubmit && !submitting
                ? { boxShadow: '0 4px 14px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08)' }
                : undefined
            }
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Starting deployment…
              </>
            ) : (
              <>
                Create Chain
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </motion.button>

          {/* Reassurance line — small, muted */}
          <p className="mt-3 text-center text-xs text-zinc-400 dark:text-zinc-500">
            Usually takes 1–2 minutes. You can leave the tab open.
          </p>
        </motion.div>
      </form>
    </div>
  );
}

/**
 * Substantial, airy input field. Custom design (not shared Input) to
 * keep the onboarding surface feeling intentional — large label,
 * generous padding, subtle focus ring, hint below in muted text.
 */
function BigField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  maxLength,
  mono,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  mono?: boolean;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { type: 'spring', stiffness: 240, damping: 24 },
        },
      }}
      className="space-y-2"
    >
      <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className={cn(
          'w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900',
          'px-4 py-3.5 text-[15px] text-zinc-900 dark:text-zinc-100',
          'placeholder:text-zinc-400 dark:placeholder:text-zinc-600',
          'transition-all duration-200',
          'focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 focus:ring-4 focus:ring-zinc-900/5 dark:focus:ring-white/5',
          'hover:border-zinc-300 dark:hover:border-zinc-700',
          mono && 'font-mono',
        )}
      />
      {hint && <p className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
    </motion.div>
  );
}

/**
 * Precompile toggles. Each toggle corresponds to a Subnet-EVM
 * precompile; enabled precompiles seed their admin list with the
 * owner address. Defaults mirror DEFAULT_PRECOMPILES (native minter +
 * interoperability on).
 */
const PRECOMPILE_META: Array<{
  key: keyof PrecompileConfig;
  title: string;
  description: string;
}> = [
  {
    key: 'nativeMinter',
    title: 'Native Minter',
    description: 'Mint the native token at runtime.',
  },
  {
    key: 'interoperability',
    title: 'Interoperability',
    description: 'Warp messaging + Teleporter (ICM) for cross-chain messages.',
  },
  {
    key: 'feeManager',
    title: 'Fee Manager',
    description: 'Adjust the dynamic fee config without a network upgrade.',
  },
  {
    key: 'rewardManager',
    title: 'Reward Manager',
    description: 'Redirect the base fee to a recipient instead of burning it.',
  },
  {
    key: 'txAllowList',
    title: 'Tx Allow List',
    description: 'Gate transaction senders to an allow list.',
  },
  {
    key: 'contractDeployerAllowList',
    title: 'Contract Deployer Allow List',
    description: 'Gate contract deployers to an allow list.',
  },
];

function PrecompileCard({
  precompiles,
  onToggle,
}: {
  precompiles: Required<PrecompileConfig>;
  onToggle: (key: keyof PrecompileConfig) => void;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 240, damping: 24 } },
      }}
      className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden h-fit"
    >
      <div className="px-3.5 py-2.5 border-b border-zinc-100 dark:border-zinc-900">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Precompiles</h3>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
          Baked into genesis. Admin list seeded with your owner address.
        </p>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
        {PRECOMPILE_META.map((p) => (
          <PrecompileRow
            key={p.key}
            title={p.title}
            description={p.description}
            enabled={precompiles[p.key]}
            onToggle={() => onToggle(p.key)}
          />
        ))}
      </div>
    </motion.div>
  );
}

function PrecompileRow({
  title,
  description,
  enabled,
  onToggle,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-3.5 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100 leading-tight">{title}</div>
        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">{description}</div>
      </div>
      <Toggle checked={enabled} />
    </button>
  );
}

/** Small switch-style toggle. Controlled — parent handles state. */
function Toggle({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 mt-0.5 rounded-full border transition-colors',
        checked
          ? 'bg-zinc-900 dark:bg-white border-zinc-900 dark:border-white'
          : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all duration-200',
          checked ? 'left-[18px] bg-white dark:bg-zinc-900' : 'left-0.5 bg-white dark:bg-zinc-600',
        )}
      />
    </span>
  );
}
