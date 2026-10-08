'use client';

import { CliAlternative } from '@/components/console/cli-alternative';

import { useEffect, useId, useState } from 'react';
import { AlertTriangle, ArrowRight, CalendarClock, Check, Info, Loader2, Lock, Repeat } from 'lucide-react';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import {
  BaseConsoleToolProps,
  ConsoleToolMetadata,
  withConsoleToolMetadata,
} from '../../components/WithConsoleToolMetadata';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useWallet } from '@/components/toolbox/hooks/useWallet';
import {
  prepareAddPermissionlessValidatorTxn,
  prepareAddAutoRenewedValidatorTxn,
  prepareSetAutoRenewedValidatorConfigTxn,
} from '@avalanche-sdk/client/methods/wallet/pChain';
import { createPChainClient } from '@avalanche-sdk/client';
import { avalanche, avalancheFuji } from '@avalanche-sdk/client/chains';
import { sendXPTransaction } from '@avalanche-sdk/client/methods/wallet';
import { toNanoAvax } from '@/components/toolbox/coreViem/utils/units';
import { networkIDs } from '@avalabs/avalanchejs';
import { AddValidatorControls } from '@/components/toolbox/components/ValidatorListInput/AddValidatorControls';
import type { ConvertToL1Validator } from '@/components/toolbox/components/ValidatorListInput';
import {
  BLS_PROOF_OF_POSSESSION_REGEX,
  BLS_PUBLIC_KEY_REGEX,
} from '@/components/toolbox/components/ValidatorListInput/nodeCredentials';
import { Steps, Step } from '@/components/toolbox/components/Steps';
import { ConnectedWalletIcon, useConnectedWalletName } from '@/components/toolbox/components/ConnectedWalletIcon';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import { SDKCodeViewer, type SDKCodeSource } from '@/components/console/sdk-code-viewer';
import { Board, BoardHeader, HashChip, SpecPlate, SpecRow, UNIT } from '@/components/explorer-v2/ui';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const EYEBROW = 'font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400';
const LINK =
  'text-zinc-700 underline decoration-zinc-300 underline-offset-4 transition-colors hover:text-zinc-900 dark:text-zinc-300 dark:decoration-zinc-600 dark:hover:text-zinc-100';
const BUTTON =
  'group/btn inline-flex h-10 w-full items-center justify-center gap-2 border px-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition-colors disabled:cursor-not-allowed disabled:opacity-50';
const SECONDARY_BUTTON = cn(
  BUTTON,
  'border-zinc-300 text-zinc-700 hover:border-zinc-900 hover:text-zinc-900 disabled:hover:border-zinc-300 disabled:hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-100 dark:hover:text-zinc-50',
);
const DANGER_OUTLINE_BUTTON = cn(
  BUTTON,
  'border-red-300 text-red-700 hover:border-red-600 hover:text-red-800 disabled:hover:border-red-300 dark:border-red-900 dark:text-red-400 dark:hover:border-red-500 dark:hover:text-red-300',
);
const DANGER_BUTTON = cn(
  BUTTON,
  'border-red-600 bg-red-600 text-white hover:bg-red-700 disabled:hover:bg-red-600 dark:border-red-500 dark:bg-red-500 dark:hover:bg-red-600',
);
const VALUE = 'font-mono tabular-nums';

const STAKE_VALIDATOR_SOURCE = `import type { AvalanchePChainWalletClient } from "@avalanche-sdk/client";
import { prepareAddPermissionlessValidatorTxn } from "@avalanche-sdk/client/methods/wallet/pChain";
import { sendXPTransaction } from "@avalanche-sdk/client/methods/wallet";
import { avaxToNanoAvax } from "@avalanche-sdk/client/utils";

export async function stakeOnPrimaryNetwork(
  pChainClient: AvalanchePChainWalletClient,
  params: {
    nodeId: string;
    stakeInAvax: number;
    endTime: number;
    rewardAddress: string;
    delegationFee: number;
    publicKey: string;
    signature: string;
  }
): Promise<string> {
  const { tx } = await prepareAddPermissionlessValidatorTxn(pChainClient, {
    nodeId: params.nodeId,
    stakeInNanoAvax: avaxToNanoAvax(params.stakeInAvax),
    end: BigInt(params.endTime),
    rewardAddresses: [params.rewardAddress],
    delegatorRewardAddresses: [params.rewardAddress],
    delegatorRewardPercentage: params.delegationFee,
    threshold: 1,
    locktime: 0n,
    publicKey: params.publicKey,
    signature: params.signature,
  });

  const result = await sendXPTransaction(pChainClient, {
    tx,
    chainAlias: "P",
  });

  return result.txHash;
}`;

const STAKE_AUTO_RENEWED_SOURCE = `import type { AvalanchePChainWalletClient } from "@avalanche-sdk/client";
import { prepareAddAutoRenewedValidatorTxn } from "@avalanche-sdk/client/methods/wallet/pChain";
import { sendXPTransaction } from "@avalanche-sdk/client/methods/wallet";
import { avaxToNanoAvax } from "@avalanche-sdk/client/utils";

// ACP-236 (Helicon upgrade): the stake automatically renews every cycle.
export async function stakeAutoRenewedOnPrimaryNetwork(
  pChainClient: AvalanchePChainWalletClient,
  params: {
    nodeId: string;
    stakeInAvax: number;
    periodSeconds: bigint;
    rewardAddress: string;
    delegationFee: number;
    autoCompoundRewardPercentage: number; // 0 = withdraw all rewards, 100 = restake all
    publicKey: string;
    signature: string;
  }
): Promise<string> {
  const { tx } = await prepareAddAutoRenewedValidatorTxn(pChainClient, {
    nodeId: params.nodeId,
    stakeInNanoAvax: avaxToNanoAvax(params.stakeInAvax),
    period: params.periodSeconds,
    rewardAddresses: [params.rewardAddress],
    delegatorRewardAddresses: [params.rewardAddress],
    ownerAddresses: [params.rewardAddress], // authorized to update the config or stop later
    delegatorRewardPercentage: params.delegationFee,
    autoCompoundRewardPercentage: params.autoCompoundRewardPercentage,
    threshold: 1,
    locktime: 0n,
    publicKey: params.publicKey,
    signature: params.signature,
  });

  const result = await sendXPTransaction(pChainClient, {
    tx,
    chainAlias: "P",
  });

  return result.txHash;
}`;

const FIXED_SDK_SOURCES: SDKCodeSource[] = [
  {
    name: 'TypeScript',
    filename: 'stakeOnPrimaryNetwork.ts',
    code: STAKE_VALIDATOR_SOURCE,
    description: 'Add a permissionless validator to the Primary Network using the Avalanche SDK.',
  },
];

const AUTO_RENEW_SDK_SOURCES: SDKCodeSource[] = [
  {
    name: 'TypeScript',
    filename: 'stakeAutoRenewedOnPrimaryNetwork.ts',
    code: STAKE_AUTO_RENEWED_SOURCE,
    description: 'Add an auto-renewed validator (ACP-236) to the Primary Network using the Avalanche SDK.',
  },
];

const SET_AUTO_RENEW_CONFIG_SOURCE = `import type { AvalanchePChainWalletClient } from "@avalanche-sdk/client";
import { prepareSetAutoRenewedValidatorConfigTxn } from "@avalanche-sdk/client/methods/wallet/pChain";
import { sendXPTransaction } from "@avalanche-sdk/client/methods/wallet";

// ACP-236: update an auto-renewed validator's next-cycle config.
// period = 0n stops auto-renewal — the validator exits at the end of its current cycle.
export async function setAutoRenewedValidatorConfig(
  pChainClient: AvalanchePChainWalletClient,
  params: {
    validatorTxId: string; // ID of the original AddAutoRenewedValidatorTx
    periodSeconds: bigint;
    autoCompoundRewardPercentage: number; // 0 = withdraw all rewards, 100 = restake all
  }
): Promise<string> {
  const { tx } = await prepareSetAutoRenewedValidatorConfigTxn(pChainClient, {
    validatorTxId: params.validatorTxId,
    auth: [0], // index into the validator's authority owner set
    period: params.periodSeconds,
    autoCompoundRewardPercentage: params.autoCompoundRewardPercentage,
  });

  const result = await sendXPTransaction(pChainClient, {
    tx,
    chainAlias: "P",
  });

  return result.txHash;
}`;

const SET_CONFIG_SDK_SOURCES: SDKCodeSource[] = [
  {
    name: 'TypeScript',
    filename: 'setAutoRenewedValidatorConfig.ts',
    code: SET_AUTO_RENEW_CONFIG_SOURCE,
    description: "Update or stop an auto-renewed validator's config (ACP-236) using the Avalanche SDK.",
  },
];

type ExistingValidatorInfo = {
  kind: 'autoRenewed' | 'fixed';
  txID: string;
  isAuthority: boolean;
  stakeAvax: string;
  endTime?: number;
  periodHours?: number;
  autoCompoundPct?: number;
  authorityAddresses: string[];
};

const NETWORK_CONFIG = {
  fuji: {
    minStakeAvax: 1,
    // ACP-273 lowered the primary network validator minimum to 12h on Fuji when
    // Helicon activated (2026-07-28). Mainnet becomes 48h at its activation.
    minEndSeconds: 12 * 60 * 60,
    minEndLabel: '12 hours',
    defaultDays: 1,
    presets: [
      { label: '1 day', days: 1 },
      { label: '1 week', days: 7 },
      { label: '2 weeks', days: 14 },
    ],
    minPeriodHours: 12,
    periodPresets: [
      { label: '1 day', hours: 24 },
      { label: '1 week', hours: 168 },
      { label: '2 weeks', hours: 336 },
    ],
  },
  mainnet: {
    minStakeAvax: 2000,
    minEndSeconds: 14 * 24 * 60 * 60,
    minEndLabel: '2 weeks',
    defaultDays: 14,
    presets: [
      { label: '2 weeks', days: 14 },
      { label: '1 month', days: 30 },
      { label: '3 months', days: 90 },
    ],
    minPeriodHours: 48,
    periodPresets: [
      { label: '2 weeks', hours: 336 },
      { label: '1 month', hours: 720 },
      { label: '3 months', hours: 2160 },
    ],
  },
};

const MAX_END_SECONDS = 365 * 24 * 60 * 60;
const MAX_PERIOD_HOURS = 365 * 24;
const DEFAULT_DELEGATOR_FEE = '2';
const DEFAULT_AUTO_COMPOUND = '100';
const BUFFER_MINUTES = 5;

const metadata: ConsoleToolMetadata = {
  title: 'Stake on Primary Network',
  description: (
    <>
      Add a{' '}
      <Link href="/docs/nodes/run-a-node/manually" className={LINK}>
        validator
      </Link>{' '}
      to Avalanche's{' '}
      <Link href="/docs/rpcs/p-chain/api" className={LINK}>
        Primary Network
      </Link>
      . Issues an{' '}
      <Link href="/docs/rpcs/p-chain/txn-format#unsigned-add-permissionless-validator-tx" className={LINK}>
        AddPermissionlessValidatorTx
      </Link>{' '}
      on the P-Chain, or an{' '}
      <Link href="/docs/acps/236-auto-renewed-staking" className={LINK}>
        AddAutoRenewedValidatorTx
      </Link>{' '}
      for auto-renewed staking (ACP-236).
    </>
  ),
  toolRequirements: [WalletRequirementsConfigKey.WalletConnected],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

/** A labelled square input; the hint sits under it and an error replaces the hint. */
function Field({
  label,
  hideLabel = false,
  unit,
  hint,
  error,
  onChange,
  ...props
}: {
  label: string;
  hideLabel?: boolean;
  unit?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  onChange: (value: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'className' | 'id'>) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error || hint;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : EYEBROW}>
        {label}
      </label>
      <div className="relative">
        <input
          {...props}
          id={id}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={note ? noteId : undefined}
          className={cn(
            'h-10 w-full border bg-white px-3 font-mono text-[13px] tabular-nums text-zinc-900 transition-colors placeholder:text-zinc-400 focus:outline-none dark:bg-zinc-950 dark:text-zinc-100 dark:[color-scheme:dark]',
            '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
            error
              ? 'border-red-500 focus:border-red-600 dark:border-red-500 dark:focus:border-red-400'
              : 'border-zinc-300 focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100',
            unit && 'pr-16',
          )}
        />
        {unit && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500"
          >
            {unit}
          </span>
        )}
      </div>
      {note && (
        <p
          id={noteId}
          className={cn(
            'text-[12px] leading-relaxed',
            error ? 'text-red-600 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400',
          )}
        >
          {note}
        </p>
      )}
    </div>
  );
}

/** Quick picks above a field: three cells sharing hairlines, the matching one outlined in ink. */
function Presets({
  label,
  items,
}: {
  label: string;
  items: { key: number; label: string; active: boolean; onSelect: () => void }[];
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="grid grid-cols-3 gap-px border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800"
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          aria-pressed={item.active}
          onClick={item.onSelect}
          className={cn(
            'h-9 bg-white px-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] tabular-nums transition-colors dark:bg-zinc-950',
            item.active
              ? 'relative z-10 text-zinc-900 outline outline-2 -outline-offset-2 outline-zinc-900 dark:text-zinc-50 dark:outline-zinc-100'
              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/** One choice in a radio group: a cell in a hairline grid, outlined in ink when chosen. */
function Option({
  selected,
  onSelect,
  icon,
  title,
  description,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'group/opt relative flex flex-col gap-2 bg-white p-4 text-left transition-colors dark:bg-zinc-950',
        selected
          ? 'z-10 outline outline-2 -outline-offset-2 outline-zinc-900 dark:outline-zinc-100'
          : 'hover:outline hover:outline-1 hover:-outline-offset-1 hover:outline-zinc-400 dark:hover:outline-zinc-600',
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span
          className={cn(
            'flex h-8 w-8 items-center justify-center border transition-colors',
            selected
              ? 'border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-50'
              : 'border-zinc-200 text-zinc-500 group-hover/opt:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:group-hover/opt:text-zinc-100',
          )}
        >
          {icon}
        </span>
        <span
          className={cn(
            'flex h-4 w-4 items-center justify-center rounded-full border',
            selected
              ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
              : 'border-zinc-300 dark:border-zinc-700',
          )}
        >
          {selected && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
        </span>
      </span>
      <span className="mt-1 text-[14px] font-semibold text-zinc-900 dark:text-zinc-50">{title}</span>
      <span className="text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</span>
    </button>
  );
}

function Notice({ tone, children }: { tone: 'warn' | 'error' | 'info'; children: React.ReactNode }) {
  const Icon = tone === 'info' ? Info : AlertTriangle;
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={cn(
        'flex items-start gap-3 border px-4 py-3 text-[13px] leading-relaxed',
        tone === 'warn' &&
          'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/20 dark:text-amber-200',
        tone === 'error' &&
          'border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200',
        tone === 'info' &&
          'border-zinc-200 bg-white text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300',
      )}
    >
      <Icon
        className={cn(
          'mt-0.5 h-4 w-4 shrink-0',
          tone === 'warn' && 'text-amber-600 dark:text-amber-400',
          tone === 'error' && 'text-red-600 dark:text-red-400',
          tone === 'info' && 'text-zinc-400',
        )}
      />
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{children}</span>
    </div>
  );
}

/** A state the tool can't change from here, stated with the reason. */
function Locked({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
      <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">{children}</p>
    </div>
  );
}

function Status({ tone, children }: { tone: 'ok' | 'warn' | 'idle'; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em]',
        tone === 'ok' && 'text-emerald-700 dark:text-emerald-400',
        tone === 'warn' && 'text-amber-700 dark:text-amber-400',
        tone === 'idle' && 'text-zinc-400 dark:text-zinc-500',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          tone === 'ok' && 'bg-emerald-500 dark:bg-emerald-400',
          tone === 'warn' && 'bg-amber-500 dark:bg-amber-400',
          tone === 'idle' && 'animate-pulse bg-zinc-300 dark:bg-zinc-600',
        )}
      />
      {children}
    </span>
  );
}

function Avax({ value }: { value: React.ReactNode }) {
  return (
    <span className={VALUE}>
      {value} <span className={UNIT}>AVAX</span>
    </span>
  );
}

/** A Board of key/values: the validator on record, or the transaction about to be signed. */
function Sheet({ label, action, children }: { label: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Board className="border-x border-t">
      <BoardHeader label={label} action={action} />
      <SpecPlate className="px-5 md:px-6">{children}</SpecPlate>
    </Board>
  );
}

/** Summary key/values set as right-aligned mono figures. */
function Summary({ rows }: { rows: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 px-5 py-4 text-[13px] md:px-6">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-zinc-500 dark:text-zinc-400">{row.label}</dt>
          <dd className="flex min-w-0 justify-end text-right font-mono tabular-nums text-zinc-900 dark:text-zinc-50">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** The square ink signing action, marked with the wallet that will sign. */
function SignButton({
  onClick,
  disabled,
  loading,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}) {
  const walletName = useConnectedWalletName();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="group flex w-full items-center gap-4 border border-zinc-900 bg-zinc-900 px-5 py-4 text-left text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-50 disabled:text-zinc-400 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:disabled:border-zinc-800 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-500"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-current/20 bg-white/10 group-disabled:bg-transparent dark:bg-zinc-900/10">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ConnectedWalletIcon className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[12px] font-bold uppercase tracking-[0.14em]">
          {loading ? 'Processing...' : children}
        </span>
        <span className="mt-0.5 block text-[12px] opacity-70">
          {loading ? 'Waiting on the P-Chain' : `Signs with ${walletName}`}
        </span>
      </span>
      {!loading && (
        <ArrowRight className="h-4 w-4 shrink-0 text-[#E6212F] transition-transform group-hover:translate-x-0.5 group-disabled:text-current" />
      )}
    </button>
  );
}

function Stake({ onSuccess }: BaseConsoleToolProps) {
  const { pChainAddress, isTestnet, avalancheNetworkID } = useWalletStore();
  const { avalancheWalletClient } = useWallet();

  const [validator, setValidator] = useState<ConvertToL1Validator | null>(null);
  const [stakingMode, setStakingMode] = useState<'fixed' | 'autoRenew'>('fixed');
  const [stakeInAvax, setStakeInAvax] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [periodHours, setPeriodHours] = useState<string>('336');
  const [autoCompound, setAutoCompound] = useState<string>(DEFAULT_AUTO_COMPOUND);
  const [delegationFee, setDelegationFee] = useState<string>(DEFAULT_DELEGATOR_FEE);

  const [existingValidator, setExistingValidator] = useState<ExistingValidatorInfo | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [updPeriodHours, setUpdPeriodHours] = useState<string>('');
  const [updAutoCompound, setUpdAutoCompound] = useState<string>('');
  const [confirmStop, setConfirmStop] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txId, setTxId] = useState<string>('');

  const { notify } = useConsoleNotifications();

  const onFuji = isTestnet === true || avalancheNetworkID === networkIDs.FujiID;
  const config = onFuji ? NETWORK_CONFIG.fuji : NETWORK_CONFIG.mainnet;
  const networkName = onFuji ? 'Fuji' : 'Mainnet';
  const isAutoRenew = stakingMode === 'autoRenew';
  const isUpdateMode = existingValidator?.kind === 'autoRenewed' && existingValidator.isAuthority;

  // Once a NodeID is entered, check whether it is already an active validator:
  // an auto-renewed one owned by this wallet switches the tool to config-update mode.
  useEffect(() => {
    const nodeID = validator?.nodeID;
    setExistingValidator(null);
    setConfirmStop(false);
    if (!nodeID?.startsWith('NodeID-')) return;

    let cancelled = false;
    setCheckingExisting(true);
    const client = createPChainClient({
      chain: onFuji ? avalancheFuji : avalanche,
      transport: { type: 'http' },
    });
    client
      .getCurrentValidators({ nodeIDs: [nodeID] })
      .then(({ validators }) => {
        if (cancelled) return;
        const v = validators?.[0];
        if (!v) return;
        const stakeAvax = (Number(v.stakeAmount ?? v.weight ?? 0) / 1e9).toLocaleString();
        const walletAddr = pChainAddress?.replace(/^P-/, '');
        if (v.nextPeriod !== undefined || v.validatorAuthority) {
          const authorityAddresses = (v.validatorAuthority?.addresses ?? []).map((a) =>
            a.startsWith('P-') ? a : `P-${a}`,
          );
          const isAuthority = !!walletAddr && authorityAddresses.some((a) => a.replace(/^P-/, '') === walletAddr);
          const currentPeriodHours = Math.round(Number(v.nextPeriod ?? 0) / 3600);
          const autoCompoundPct = Number(v.autoCompoundRewardShares ?? 0) / 10_000;
          setExistingValidator({
            kind: 'autoRenewed',
            txID: v.txID,
            isAuthority,
            stakeAvax,
            periodHours: currentPeriodHours,
            autoCompoundPct,
            authorityAddresses,
          });
          setUpdPeriodHours(String(currentPeriodHours));
          setUpdAutoCompound(String(autoCompoundPct));
        } else {
          setExistingValidator({
            kind: 'fixed',
            txID: v.txID,
            isAuthority: false,
            stakeAvax,
            endTime: Number(v.endTime ?? 0),
            authorityAddresses: [],
          });
        }
      })
      .catch(() => {
        // Lookup is best-effort; the add flow still works without it.
      })
      .finally(() => {
        if (!cancelled) setCheckingExisting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [validator?.nodeID, onFuji, pChainAddress]);

  // Initialize defaults
  if (!stakeInAvax) {
    setStakeInAvax(String(config.minStakeAvax));
  }

  if (!endTime) {
    const d = new Date();
    d.setDate(d.getDate() + config.defaultDays);
    d.setMinutes(d.getMinutes() + BUFFER_MINUTES);
    const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setEndTime(iso);
  }

  const setEndInDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setMinutes(d.getMinutes() + BUFFER_MINUTES);
    const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setEndTime(iso);
  };

  const isDateButtonActive = (days: number) => {
    if (!endTime) return false;
    const targetDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const selectedDate = new Date(endTime);
    return Math.abs(targetDate.getTime() - selectedDate.getTime()) < 24 * 60 * 60 * 1000;
  };

  const getDurationHours = () => {
    if (!endTime) return 0;
    const endUnix = Math.floor(new Date(endTime).getTime() / 1000);
    const nowUnix = Math.floor(Date.now() / 1000);
    return Math.max(0, Math.floor((endUnix - nowUnix) / 3600));
  };

  const validateForm = (): string | null => {
    if (!pChainAddress) return 'Connect Core or a Console wallet to get your P-Chain address';
    if (!validator) return 'Please provide validator credentials';
    if (!validator.nodeID?.startsWith('NodeID-')) return 'Invalid NodeID format';
    if (!BLS_PUBLIC_KEY_REGEX.test(validator.nodePOP.publicKey))
      return 'Invalid BLS public key: expected 0x plus 96 hex characters (48 bytes)';
    if (!BLS_PROOF_OF_POSSESSION_REGEX.test(validator.nodePOP.proofOfPossession))
      return 'Invalid BLS proof of possession: expected 0x plus 192 hex characters (96 bytes)';

    const stakeNum = Number(stakeInAvax);
    if (!Number.isFinite(stakeNum) || stakeNum < config.minStakeAvax) {
      return `Minimum stake is ${config.minStakeAvax.toLocaleString()} AVAX on ${networkName}`;
    }

    if (isAutoRenew) {
      const hours = Number(periodHours);
      if (!Number.isFinite(hours) || hours < config.minPeriodHours || hours > MAX_PERIOD_HOURS) {
        return `Cycle period must be between ${config.minPeriodHours} hours and 1 year`;
      }
      const ac = Number(autoCompound);
      if (!Number.isFinite(ac) || ac < 0 || ac > 100) return 'Auto-compound must be between 0 and 100';
    } else {
      if (!endTime) return 'End time is required';
      const endUnix = Math.floor(new Date(endTime).getTime() / 1000);
      const duration = endUnix - Math.floor(Date.now() / 1000);
      if (duration < config.minEndSeconds) return `End time must be at least ${config.minEndLabel} from now`;
      if (duration > MAX_END_SECONDS) return 'End time must be within 1 year';
    }

    const fee = Number(delegationFee);
    if (!Number.isFinite(fee) || fee < 2 || fee > 100) return 'Delegation fee must be between 2 and 100';

    return null;
  };

  const submitStake = async () => {
    setError(null);
    setTxId('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!avalancheWalletClient) {
      setError('Avalanche client not found');
      return;
    }

    try {
      setIsSubmitting(true);

      let tx;
      if (isAutoRenew) {
        ({ tx } = await prepareAddAutoRenewedValidatorTxn(avalancheWalletClient.pChain, {
          nodeId: validator!.nodeID,
          stakeInNanoAvax: toNanoAvax(stakeInAvax),
          period: BigInt(Math.round(Number(periodHours) * 60 * 60)),
          rewardAddresses: [pChainAddress!],
          delegatorRewardAddresses: [pChainAddress!],
          ownerAddresses: [pChainAddress!],
          delegatorRewardPercentage: Number(delegationFee),
          autoCompoundRewardPercentage: Number(autoCompound),
          threshold: 1,
          locktime: 0n,
          publicKey: validator!.nodePOP.publicKey,
          signature: validator!.nodePOP.proofOfPossession,
        }));
      } else {
        const endUnix = Math.floor(new Date(endTime).getTime() / 1000);
        ({ tx } = await prepareAddPermissionlessValidatorTxn(avalancheWalletClient.pChain, {
          nodeId: validator!.nodeID,
          stakeInNanoAvax: toNanoAvax(stakeInAvax),
          end: BigInt(endUnix),
          rewardAddresses: [pChainAddress!],
          delegatorRewardAddresses: [pChainAddress!],
          delegatorRewardPercentage: Number(delegationFee),
          threshold: 1,
          locktime: 0n,
          publicKey: validator!.nodePOP.publicKey,
          signature: validator!.nodePOP.proofOfPossession,
        }));
      }

      const stakePromise = sendXPTransaction(avalancheWalletClient.pChain, {
        tx,
        chainAlias: 'P',
      }).then((result) => result.txHash);

      notify(isAutoRenew ? 'addAutoRenewedValidator' : 'addPermissionlessValidator', stakePromise);

      const txHash = await stakePromise;
      setTxId(txHash);
      onSuccess?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitConfigUpdate = async (stop: boolean) => {
    setError(null);
    setTxId('');
    if (!existingValidator) return;

    if (!stop) {
      const hours = Number(updPeriodHours);
      if (!Number.isFinite(hours) || hours < config.minPeriodHours || hours > MAX_PERIOD_HOURS) {
        setError(`Cycle period must be between ${config.minPeriodHours} hours and 1 year`);
        return;
      }
      const ac = Number(updAutoCompound);
      if (!Number.isFinite(ac) || ac < 0 || ac > 100) {
        setError('Auto-compound must be between 0 and 100');
        return;
      }
    }

    if (!avalancheWalletClient) {
      setError('Avalanche client not found');
      return;
    }

    try {
      setIsSubmitting(true);

      const walletAddr = pChainAddress?.replace(/^P-/, '');
      const authIndex = Math.max(
        0,
        existingValidator.authorityAddresses.findIndex((a) => a.replace(/^P-/, '') === walletAddr),
      );
      const { tx } = await prepareSetAutoRenewedValidatorConfigTxn(avalancheWalletClient.pChain, {
        validatorTxId: existingValidator.txID,
        auth: [authIndex],
        period: stop ? 0n : BigInt(Math.round(Number(updPeriodHours) * 60 * 60)),
        autoCompoundRewardPercentage: stop ? 0 : Number(updAutoCompound),
      });

      const updatePromise = sendXPTransaction(avalancheWalletClient.pChain, {
        tx,
        chainAlias: 'P',
      }).then((result) => result.txHash);

      notify('setAutoRenewedValidatorConfig', updatePromise);

      const txHash = await updatePromise;
      setTxId(txHash);
      onSuccess?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const cliCommand = isUpdateMode
    ? `platform-cli validator set-auto-renewed-config --tx-id ${existingValidator?.txID || '<tx-id>'} --node-id ${validator?.nodeID || '<node-id>'} --period ${updPeriodHours || '<hours>'}h --auto-compound ${Number(updAutoCompound || 0) / 100} --network ${onFuji ? 'fuji' : 'mainnet'}`
    : isAutoRenew
      ? `platform-cli validator add-auto-renewed --node-id ${validator?.nodeID || '<node-id>'} --stake ${stakeInAvax || '<amount>'} --period ${periodHours}h --delegation-fee ${Number(delegationFee) / 100} --auto-compound ${Number(autoCompound) / 100} --network ${onFuji ? 'fuji' : 'mainnet'}`
      : `platform-cli validator add-permissionless --node-id ${validator?.nodeID || '<node-id>'} --stake ${stakeInAvax || '<amount>'} --duration ${getDurationHours()}h --delegation-fee ${Number(delegationFee) / 100} --network ${onFuji ? 'fuji' : 'mainnet'}`;

  const durationHours = getDurationHours();
  const endDate = endTime ? new Date(endTime) : null;

  return (
    <SDKCodeViewer
      sources={isUpdateMode ? SET_CONFIG_SDK_SOURCES : isAutoRenew ? AUTO_RENEW_SDK_SOURCES : FIXED_SDK_SOURCES}
      height="auto"
    >
      <div className="not-prose">
        {txId ? (
          <div className="flex flex-col gap-4">
            <Board className="border-x border-t">
              <BoardHeader label="Transaction issued" display action={<Status tone="ok">Submitted</Status>} />
              <SpecPlate className="px-5 md:px-6">
                <SpecRow label="Transaction">
                  <HashChip value={txId} len={16} />
                </SpecRow>
                {validator && (
                  <SpecRow label="Node ID">
                    <HashChip value={validator.nodeID} len={16} />
                  </SpecRow>
                )}
              </SpecPlate>
            </Board>
            <button
              type="button"
              className={SECONDARY_BUTTON}
              onClick={() => {
                setValidator(null);
                setStakingMode('fixed');
                setStakeInAvax(String(config.minStakeAvax));
                setPeriodHours('336');
                setAutoCompound(DEFAULT_AUTO_COMPOUND);
                setDelegationFee(DEFAULT_DELEGATOR_FEE);
                setExistingValidator(null);
                setUpdPeriodHours('');
                setUpdAutoCompound('');
                setConfirmStop(false);
                setError(null);
                setTxId('');
              }}
            >
              {isUpdateMode ? 'Start Over' : 'Stake Another Validator'}
            </button>
          </div>
        ) : (
          <Steps>
            <Step>
              <h3>Node credentials</h3>
              <p>Your node&apos;s ID and BLS credentials.</p>

              <AddValidatorControls
                defaultAddress={pChainAddress || ''}
                canAddMore={!validator}
                onAddValidator={setValidator}
                isTestnet={false}
              />

              {validator && (
                <Sheet
                  label="Node"
                  action={
                    checkingExisting ? (
                      <Status tone="idle">Checking status</Status>
                    ) : existingValidator ? (
                      <Status tone="warn">Already validating</Status>
                    ) : null
                  }
                >
                  <SpecRow label="Node ID">
                    <HashChip value={validator.nodeID} len={16} />
                  </SpecRow>
                  <SpecRow label="BLS public key">
                    <HashChip value={validator.nodePOP.publicKey} len={16} />
                  </SpecRow>
                </Sheet>
              )}

              {isUpdateMode && (
                <Notice tone="warn">
                  This node already has auto-renewed staking, so the tool switched to updating its config.
                </Notice>
              )}
            </Step>

            <Step>
              {existingValidator?.kind === 'fixed' && (
                <>
                  <h3>Existing validator</h3>
                  <p>This node is already a fixed-duration Primary Network validator.</p>
                  <Sheet label="On record" action={<Status tone="ok">Fixed duration</Status>}>
                    <SpecRow label="Stake">
                      <Avax value={existingValidator.stakeAvax} />
                    </SpecRow>
                    <SpecRow label="Validating until">
                      <span className={VALUE}>
                        {existingValidator.endTime ? new Date(existingValidator.endTime * 1000).toLocaleString() : '—'}
                      </span>
                    </SpecRow>
                  </Sheet>
                  <Locked>
                    Fixed-duration stake can&apos;t be modified. This node can be staked again after its current
                    validation ends.
                  </Locked>
                </>
              )}

              {existingValidator?.kind === 'autoRenewed' && !existingValidator.isAuthority && (
                <>
                  <h3>Auto-renewed validator</h3>
                  <p>This node already validates with auto-renewal. Read-only view.</p>
                  <Sheet label="On record" action={<Status tone="ok">Auto-renewed</Status>}>
                    <SpecRow label="Stake">
                      <Avax value={existingValidator.stakeAvax} />
                    </SpecRow>
                    <SpecRow label="Cycle period">
                      <span className={VALUE}>
                        {existingValidator.periodHours} <span className={UNIT}>hours</span>
                      </span>
                    </SpecRow>
                    <SpecRow label="Auto-compound">
                      <span className={VALUE}>{existingValidator.autoCompoundPct}%</span>
                    </SpecRow>
                    <SpecRow label="Validator authority" align="start">
                      <span className="flex flex-col gap-1">
                        {existingValidator.authorityAddresses.length > 0
                          ? existingValidator.authorityAddresses.map((a) => <HashChip key={a} value={a} len={16} />)
                          : '—'}
                      </span>
                    </SpecRow>
                  </Sheet>
                  <Notice tone="warn">
                    The connected wallet is not this validator&apos;s authority. Only the authority can update or stop
                    it.
                  </Notice>
                </>
              )}

              {isUpdateMode && existingValidator && (
                <>
                  <h3>Auto-renewal config</h3>
                  <p>Update the next cycle&apos;s period and auto-compounding for this validator.</p>

                  <Sheet label="Current config" action={<Status tone="ok">Auto-renewed</Status>}>
                    <SpecRow label="Stake">
                      <Avax value={existingValidator.stakeAvax} />
                    </SpecRow>
                    <SpecRow label="Cycle period">
                      <span className={VALUE}>
                        {existingValidator.periodHours} <span className={UNIT}>hours</span>
                      </span>
                    </SpecRow>
                    <SpecRow label="Auto-compound">
                      <span className={VALUE}>{existingValidator.autoCompoundPct}%</span>
                    </SpecRow>
                  </Sheet>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field
                      label="Cycle period"
                      value={updPeriodHours}
                      onChange={setUpdPeriodHours}
                      type="number"
                      min={config.minPeriodHours}
                      max={MAX_PERIOD_HOURS}
                      unit="hours"
                      hint={`Min ${config.minPeriodHours} hours · Max 1 year (${networkName})`}
                      error={
                        error &&
                        (Number(updPeriodHours) < config.minPeriodHours || Number(updPeriodHours) > MAX_PERIOD_HOURS)
                          ? `Must be between ${config.minPeriodHours} hours and 1 year`
                          : null
                      }
                    />
                    <Field
                      label="Auto-compound rewards"
                      value={updAutoCompound}
                      onChange={setUpdAutoCompound}
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      unit="%"
                      hint="Share of each cycle's reward restaked (0 = withdraw all, 100 = restake all)"
                      error={
                        error && (Number(updAutoCompound) < 0 || Number(updAutoCompound) > 100)
                          ? 'Must be between 0-100%'
                          : null
                      }
                    />
                  </div>

                  <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400">
                    Changes take effect from the next cycle.
                  </p>
                </>
              )}

              {!existingValidator && (
                <>
                  <h3>Stake configuration</h3>
                  <p>
                    {isAutoRenew
                      ? 'Stake amount, delegation fee, cycle period and auto-compounding.'
                      : 'Stake amount, delegation fee and duration.'}
                  </p>

                  <div className="flex flex-col gap-2">
                    <span id="stake-mode-label" className={EYEBROW}>
                      Staking mode
                    </span>
                    <div
                      role="radiogroup"
                      aria-labelledby="stake-mode-label"
                      className="grid grid-cols-1 gap-px border border-zinc-200 bg-zinc-200 sm:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-800"
                    >
                      <Option
                        selected={!isAutoRenew}
                        onSelect={() => {
                          setStakingMode('fixed');
                          setError(null);
                        }}
                        icon={<CalendarClock className="h-4 w-4" />}
                        title="Fixed duration"
                        description="Stake until a set end date."
                      />
                      <Option
                        selected={isAutoRenew}
                        onSelect={() => {
                          setStakingMode('autoRenew');
                          setError(null);
                        }}
                        icon={<Repeat className="h-4 w-4" />}
                        title="Auto-renewed"
                        description="Restakes every cycle until you stop it (ACP-236)."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field
                      label="Stake amount"
                      value={stakeInAvax}
                      onChange={setStakeInAvax}
                      type="number"
                      step="0.001"
                      min={config.minStakeAvax}
                      unit="AVAX"
                      hint={`Minimum ${config.minStakeAvax.toLocaleString()} AVAX (${networkName})`}
                      error={
                        error && Number(stakeInAvax) < config.minStakeAvax
                          ? `Minimum stake is ${config.minStakeAvax} AVAX`
                          : null
                      }
                    />
                    <Field
                      label="Delegation fee"
                      value={delegationFee}
                      onChange={setDelegationFee}
                      type="number"
                      step="0.1"
                      min="2"
                      max="100"
                      unit="%"
                      hint="Your fee from delegators (2-100%)"
                      error={
                        error && (Number(delegationFee) < 2 || Number(delegationFee) > 100)
                          ? 'Must be between 2-100%'
                          : null
                      }
                    />
                  </div>

                  {!isAutoRenew && (
                    <div className="flex flex-col gap-2">
                      <span className={EYEBROW}>Duration</span>
                      <Presets
                        label="Duration presets"
                        items={config.presets.map((preset) => ({
                          key: preset.days,
                          label: preset.label,
                          active: isDateButtonActive(preset.days),
                          onSelect: () => setEndInDays(preset.days),
                        }))}
                      />
                      <Field
                        label="End time"
                        hideLabel
                        value={endTime}
                        onChange={setEndTime}
                        type="datetime-local"
                        hint={`Min ${config.minEndLabel} · Max 1 year`}
                        error={(() => {
                          if (!endTime || !error) return null;
                          const d = Math.floor(new Date(endTime).getTime() / 1000) - Math.floor(Date.now() / 1000);
                          if (d < config.minEndSeconds) return `Must be at least ${config.minEndLabel} from now`;
                          if (d > MAX_END_SECONDS) return 'Must be within 1 year';
                          return null;
                        })()}
                      />
                    </div>
                  )}

                  {isAutoRenew && (
                    <>
                      <div className="flex flex-col gap-2">
                        <span className={EYEBROW}>Cycle period</span>
                        <Presets
                          label="Cycle period presets"
                          items={config.periodPresets.map((preset) => ({
                            key: preset.hours,
                            label: preset.label,
                            active: Number(periodHours) === preset.hours,
                            onSelect: () => setPeriodHours(String(preset.hours)),
                          }))}
                        />
                        <Field
                          label="Cycle period in hours"
                          hideLabel
                          value={periodHours}
                          onChange={setPeriodHours}
                          type="number"
                          min={config.minPeriodHours}
                          max={MAX_PERIOD_HOURS}
                          unit="hours"
                          hint={`Stake auto-renews every cycle · Min ${config.minPeriodHours} hours · Max 1 year (${networkName})`}
                          error={
                            error &&
                            (Number(periodHours) < config.minPeriodHours || Number(periodHours) > MAX_PERIOD_HOURS)
                              ? `Must be between ${config.minPeriodHours} hours and 1 year`
                              : null
                          }
                        />
                      </div>

                      <Field
                        label="Auto-compound rewards"
                        value={autoCompound}
                        onChange={setAutoCompound}
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        unit="%"
                        hint="Share of each cycle's reward restaked (0 = withdraw all, 100 = restake all)"
                        error={
                          error && (Number(autoCompound) < 0 || Number(autoCompound) > 100)
                            ? 'Must be between 0-100%'
                            : null
                        }
                      />

                      <Notice tone="info">
                        The stake renews automatically at the end of each cycle. Stop anytime: the validator exits at
                        the end of its current cycle.
                      </Notice>
                    </>
                  )}
                </>
              )}
            </Step>

            {(!existingValidator || isUpdateMode) && (
              <Step>
                {isUpdateMode ? (
                  <>
                    <h3>Submit</h3>
                    <p>
                      Issues a{' '}
                      <Link href="/docs/acps/236-auto-renewed-staking" className={LINK}>
                        SetAutoRenewedValidatorConfigTx
                      </Link>{' '}
                      on the P-Chain.
                    </p>

                    <Board className="border-x border-t">
                      <BoardHeader label="Next cycle" />
                      <Summary
                        rows={[
                          {
                            label: 'Validator tx',
                            value: existingValidator ? <HashChip value={existingValidator.txID} len={12} /> : '—',
                          },
                          { label: 'Cycle period', value: `${updPeriodHours || '—'} h` },
                          { label: 'Auto-compound', value: `${updAutoCompound || '—'}%` },
                        ]}
                      />
                    </Board>

                    {error && <Notice tone="error">{error}</Notice>}

                    <SignButton
                      onClick={() => submitConfigUpdate(false)}
                      disabled={!pChainAddress || isSubmitting}
                      loading={isSubmitting}
                    >
                      Update Config
                    </SignButton>

                    {!confirmStop ? (
                      <button
                        type="button"
                        className={DANGER_OUTLINE_BUTTON}
                        onClick={() => setConfirmStop(true)}
                        disabled={isSubmitting}
                      >
                        Stop Auto-Renewal
                      </button>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <Notice tone="warn">
                          The validator exits at the end of its current cycle and the stake returns to your wallet.
                        </Notice>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            className={SECONDARY_BUTTON}
                            onClick={() => setConfirmStop(false)}
                            disabled={isSubmitting}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className={DANGER_BUTTON}
                            onClick={() => submitConfigUpdate(true)}
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              'Confirm Stop'
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    <CliAlternative command={cliCommand} />
                  </>
                ) : (
                  <>
                    <h3>Submit</h3>
                    <p>
                      {isAutoRenew ? (
                        <>
                          Issues an{' '}
                          <Link href="/docs/acps/236-auto-renewed-staking" className={LINK}>
                            AddAutoRenewedValidatorTx
                          </Link>{' '}
                          on the P-Chain. Your stake automatically renews every cycle.
                        </>
                      ) : (
                        <>
                          Issues an{' '}
                          <Link
                            href="/docs/rpcs/p-chain/txn-format#unsigned-add-permissionless-validator-tx"
                            className={LINK}
                          >
                            AddPermissionlessValidatorTx
                          </Link>{' '}
                          on the P-Chain.
                        </>
                      )}
                    </p>

                    <Board className="border-x border-t">
                      <BoardHeader label="Summary" action={<span className={EYEBROW}>{networkName}</span>} />
                      <Summary
                        rows={[
                          {
                            label: 'Node ID',
                            value: validator ? <HashChip value={validator.nodeID} len={12} /> : '—',
                          },
                          { label: 'Mode', value: isAutoRenew ? 'Auto-renewed' : 'Fixed duration' },
                          { label: 'Stake', value: <Avax value={stakeInAvax || '—'} /> },
                          { label: 'Delegation fee', value: `${delegationFee || '—'}%` },
                          ...(isAutoRenew
                            ? [
                                { label: 'Cycle period', value: `${periodHours || '—'} h` },
                                { label: 'Auto-compound', value: `${autoCompound || '—'}%` },
                              ]
                            : [
                                {
                                  label: 'Ends',
                                  value:
                                    endDate && !Number.isNaN(endDate.getTime())
                                      ? `${endDate.toLocaleString()} · ${durationHours} h`
                                      : '—',
                                },
                              ]),
                          {
                            label: 'Rewards to',
                            value: pChainAddress ? <HashChip value={pChainAddress} len={12} /> : '—',
                          },
                        ]}
                      />
                    </Board>

                    {error && <Notice tone="error">{error}</Notice>}

                    <SignButton
                      onClick={submitStake}
                      disabled={!pChainAddress || isSubmitting || checkingExisting}
                      loading={isSubmitting}
                    >
                      Stake {networkName} Validator
                    </SignButton>

                    <CliAlternative command={cliCommand} />
                  </>
                )}
              </Step>
            )}
          </Steps>
        )}
      </div>
    </SDKCodeViewer>
  );
}

export default withConsoleToolMetadata(Stake, metadata);
