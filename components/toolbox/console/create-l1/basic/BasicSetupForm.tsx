'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from 'lucide-react';
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

// Avalanche-themed word pools for the default chain name. Chosen so any
// adjective × noun pairing reads naturally ("Alpine Ridge", "Crystal
// Basin") and produces a 2-word name that derives a usable token
// symbol via the existing first-5-alpha-chars rule ("ALPIN", "CRYST").
const CHAIN_NAME_ADJECTIVES = [
  'Alpine',
  'Arctic',
  'Bold',
  'Bright',
  'Crystal',
  'Drift',
  'Frozen',
  'Glacial',
  'Lumen',
  'Misty',
  'Nimble',
  'North',
  'Pine',
  'Prism',
  'Quiet',
  'Radiant',
  'Silver',
  'Solar',
  'Summit',
  'Swift',
  'Wild',
];

const CHAIN_NAME_NOUNS = [
  'Basin',
  'Boulder',
  'Canyon',
  'Cedar',
  'Crest',
  'Drift',
  'Fjord',
  'Glacier',
  'Harbor',
  'Meadow',
  'Peak',
  'Pine',
  'Ridge',
  'Shore',
  'Summit',
  'Trail',
  'Valley',
];

/** Random two-word name like "Alpine Ridge". Adjective ≠ noun so we
 * never get awkward "Pine Pine" style duplicates. */
function generateChainName(): string {
  const adj = CHAIN_NAME_ADJECTIVES[Math.floor(Math.random() * CHAIN_NAME_ADJECTIVES.length)];
  let noun = CHAIN_NAME_NOUNS[Math.floor(Math.random() * CHAIN_NAME_NOUNS.length)];
  // Avoid echoes like "Pine Pine" or "Summit Summit".
  while (noun === adj) {
    noun = CHAIN_NAME_NOUNS[Math.floor(Math.random() * CHAIN_NAME_NOUNS.length)];
  }
  return `${adj} ${noun}`;
}
export default function BasicSetupForm() {
  const router = useRouter();
  // walletEVMAddress only — connection + testnet + login are now gated
  // at the page level by <CheckRequirements>, so we can assume the
  // wallet is connected on Fuji and the user is logged in by the time
  // this component mounts.
  const { walletEVMAddress } = useWalletStore();
  const { deploy, submitting, error } = useStartDeployment();

  const [chainName, setChainName] = useState('');
  const [ownerAddress, setOwnerAddress] = useState<string>('');
  const [ownerTouched, setOwnerTouched] = useState(false);
  const [precompiles, setPrecompiles] = useState<Required<PrecompileConfig>>(DEFAULT_PRECOMPILES);
  // Managed ICM relayer + MockUSDC bridge — opt-in, off by default so
  // the common path (baseline L1 deploy) stays ~30s. Enabling it costs
  // ~60-120s for relayer boot + ICTT deploys. Requires Warp/ICM to be
  // on in genesis; we enforce that dependency on submit and visually
  // in the UI below.
  const [enableManagedRelayer, setEnableManagedRelayer] = useState(false);

  const togglePrecompile = (key: keyof PrecompileConfig) => {
    setPrecompiles((p) => {
      const next = { ...p, [key]: !p[key] };
      // Relayer can't run without Warp — auto-untick relayer if the
      // user flips interop off. (The reverse is fine: Warp alone is
      // a valid standalone capability.)
      if (key === 'interoperability' && !next.interoperability) {
        setEnableManagedRelayer(false);
      }
      return next;
    });
  };

  const toggleManagedRelayer = () => {
    // Compute the new value directly (no nested setter). Avoids a
    // React foot-gun: calling setPrecompiles inside a
    // setEnableManagedRelayer updater can double-fire under Strict
    // Mode because updater functions may be replayed. Side-by-side
    // setters batch to a single render without that risk.
    const next = !enableManagedRelayer;
    setEnableManagedRelayer(next);
    // Turning the relayer ON implies Warp/Interop must be ON. Auto-
    // enable rather than blocking the click — fewer clicks to a valid
    // config. The linkage is bidirectional: turning Interop OFF while
    // relayer is on auto-disables the relayer (see togglePrecompile).
    if (next && !precompiles.interoperability) {
      setPrecompiles((p) => ({ ...p, interoperability: true }));
    }
  };

  // Pre-fill owner with the connected wallet address on first render
  // (and only when the user hasn't typed yet). Prevents stomping a
  // deliberate override on rerenders.
  useEffect(() => {
    if (!ownerTouched && walletEVMAddress && !ownerAddress) {
      setOwnerAddress(walletEVMAddress);
    }
  }, [walletEVMAddress, ownerAddress, ownerTouched]);

  // Pre-fill chain name with a generated "Alpine Ridge" style default
  // on mount so the Create Chain button is active immediately — user
  // can still override. Generated client-side only (not in useState
  // initializer) to avoid server/client hydration mismatches from
  // randomness running twice.
  // Run exactly once on mount. `setChainName` is stable (React setter)
  // so no deps needed — the empty array is correct for a mount-only
  // side effect that seeds a default name.
  useEffect(() => {
    setChainName((prev) => (prev ? prev : generateChainName()));
  }, []);

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
      // Safety: if Warp got toggled off at the last instant, strip the
      // relayer flag before sending. Orchestrator also rejects, but
      // this avoids a round-trip error.
      enableManagedRelayer: precompiles.interoperability ? enableManagedRelayer : false,
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

      {/* Testnet + wallet + login preflight is handled upstream by
          <CheckRequirements> in the page wrapper — no inline banner
          needed here. By the time this form renders, we're guaranteed
          on Fuji with a connected wallet and an authenticated session. */}

      <form onSubmit={handleSubmit}>
        {/* Split-pane: identity card on the left, configuration cards on
            the right. Both columns now use the same card chrome, so the
            pair reads as siblings instead of "cards + floating atoms". */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } },
          }}
          className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-5 lg:gap-6"
        >
          {/* Left: 2-card stack (Chain details + Included) to match the
              right's 2-card stack (Precompiles + Managed Relayer). Equal
              card counts + equal spacing = naturally balanced columns. */}
          <div className="space-y-4">
            <ChainDetailsCard
              chainName={chainName}
              setChainName={setChainName}
              ownerAddress={ownerAddress}
              onOwnerChange={(v) => {
                setOwnerTouched(true);
                setOwnerAddress(v);
              }}
            />
            <IncludedCard interopEnabled={precompiles.interoperability} relayerEnabled={enableManagedRelayer} />
          </div>

          {/* Right: precompile toggles + managed-relayer opt-in + CTA.
              Placing the Create Chain button inside this column (rather
              than as a full-width footer) closes the 2-column grid into
              a clean rectangle — no orphan element below. Error message
              sits just above the button so it's never far from the
              action it blocks. */}
          <div className="space-y-4">
            <PrecompileCard precompiles={precompiles} onToggle={togglePrecompile} />
            <ManagedRelayerCard
              enabled={enableManagedRelayer}
              onToggle={toggleManagedRelayer}
              warpEnabled={precompiles.interoperability}
            />

            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-300"
              >
                {error}
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.45 }}
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
              <p className="mt-2 text-center text-[11px] text-zinc-400 dark:text-zinc-500">
                Usually takes 1–2 minutes. You can leave the tab open.
              </p>
            </motion.div>
          </div>
        </motion.div>
      </form>
    </div>
  );
}

/**
 * Identity section — chain name + owner, wrapped in a card with the
 * same chrome as PrecompileCard / ManagedRelayerCard on the right. The
 * card wrapper is the whole reason this page suddenly feels balanced:
 * before, the left column was two floating inputs next to two bordered
 * cards, which read as "cards + orphans". A single card on the left
 * normalises the visual weight.
 */
function ChainDetailsCard({
  chainName,
  setChainName,
  ownerAddress,
  onOwnerChange,
}: {
  chainName: string;
  setChainName: (v: string) => void;
  ownerAddress: string;
  onOwnerChange: (v: string) => void;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 240, damping: 24 } },
      }}
      className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden h-fit flex flex-col"
    >
      <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-900">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Chain details</h3>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
          Name your L1 and pick the address that owns it.
        </p>
      </div>

      <div className="px-5 py-5 space-y-5 flex-1">
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
          onChange={onOwnerChange}
          placeholder="0x…"
          mono
        />
      </div>
    </motion.div>
  );
}

/**
 * "Included" card — dynamic checklist of what the user's current choices
 * will produce. Items light up as toggles flip on the right: turning on
 * Interoperability reveals the cross-chain bridge line; turning on the
 * managed relayer reveals the MockUSDC bridge line.
 *
 * Serves two purposes:
 *   - Reassurance: users see exactly what happens when they hit "Create
 *     Chain", which reduces the pre-click hesitation.
 *   - Layout balance: gives the left column a second card so it has the
 *     same card-count as the right (2 on 2), and heights naturally match.
 */
function IncludedCard({ interopEnabled, relayerEnabled }: { interopEnabled: boolean; relayerEnabled: boolean }) {
  const items: Array<{ label: string; sub: string; enabled: boolean }> = [
    { label: 'Subnet on P-Chain', sub: 'Registered + owned by your address', enabled: true },
    { label: 'Genesis + precompiles', sub: 'Built from your selections on the right', enabled: true },
    { label: 'Managed validator node', sub: 'Provisioned on Fuji and joined to the L1', enabled: true },
    { label: 'Validator Manager', sub: 'Deployed on C-Chain', enabled: true },
    { label: 'ICM messaging', sub: 'Warp + Teleporter for cross-chain calls', enabled: interopEnabled },
    { label: 'MockUSDC bridge', sub: 'Managed relayer + 10 MockUSDC to you', enabled: relayerEnabled },
  ];

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 240, damping: 24 } },
      }}
      className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden"
    >
      <div className="px-3.5 py-2.5 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Included</h3>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
            What this deploy will create for you.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-500 shrink-0">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Fuji
        </span>
      </div>
      <ul className="px-3.5 py-2 space-y-1.5">
        {items.map((item) => (
          <li
            key={item.label}
            className={cn('flex items-start gap-2 py-0.5 transition-opacity', !item.enabled && 'opacity-40')}
          >
            <span
              className={cn(
                'shrink-0 mt-[3px] flex h-3.5 w-3.5 items-center justify-center rounded-full transition-colors',
                item.enabled
                  ? 'bg-emerald-500 text-white'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600',
              )}
            >
              <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
            </span>
            <div className="min-w-0">
              <div className="text-[12.5px] font-medium text-zinc-900 dark:text-zinc-100 leading-tight">
                {item.label}
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug mt-0.5">{item.sub}</div>
            </div>
          </li>
        ))}
      </ul>
    </motion.div>
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

/**
 * Managed ICM relayer opt-in. Separate card below Precompiles so it
 * reads as an add-on service rather than an on-chain capability.
 *
 * Disabled state (when Warp is off) uses a muted look + helper text
 * so the requirement is legible before the user clicks. Clicking
 * anyway auto-enables Warp in the parent state — fewer clicks to a
 * valid config than a blocked/disabled click.
 */
function ManagedRelayerCard({
  enabled,
  onToggle,
  warpEnabled,
}: {
  enabled: boolean;
  onToggle: () => void;
  warpEnabled: boolean;
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
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Managed ICM Relayer</h3>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
          Optional. Spins up a dedicated relayer + bridges 10 MockUSDC to your owner address.
        </p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100 leading-tight">
            Run a relayer for me
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
            {enabled
              ? 'Adds ~60-120s to setup. Ready-to-use cross-chain bridge when done.'
              : warpEnabled
                ? 'Leave off for a ~30s deploy. Enable anytime later from the relayer page.'
                : 'Requires Warp/Interoperability — clicking will auto-enable it.'}
          </div>
        </div>
        <Toggle checked={enabled} />
      </button>
    </motion.div>
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
