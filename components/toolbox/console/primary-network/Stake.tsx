'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
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
import { avaxToNanoAvax } from '@avalanche-sdk/client/utils';
import { networkIDs } from '@avalabs/avalanchejs';
import { AddValidatorControls } from '@/components/toolbox/components/ValidatorListInput/AddValidatorControls';
import type { ConvertToL1Validator } from '@/components/toolbox/components/ValidatorListInput';
import {
  BLS_PROOF_OF_POSSESSION_REGEX,
  BLS_PUBLIC_KEY_REGEX,
} from '@/components/toolbox/components/ValidatorListInput/nodeCredentials';
import { Steps, Step } from 'fumadocs-ui/components/steps';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import { Alert } from '@/components/toolbox/components/Alert';
import { SDKCodeViewer, type SDKCodeSource } from '@/components/console/sdk-code-viewer';
import { CliAlternative } from '@/components/console/cli-alternative';
import Link from 'next/link';

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
    // TODO(helicon-mainnet): auto-renewed staking is not activated on Mainnet yet;
    // these become live when the gate in the staking-mode picker is lifted.
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
      <Link href="/docs/nodes/run-a-node/manually" className="text-primary hover:underline">
        validator
      </Link>{' '}
      to Avalanche's{' '}
      <Link href="/docs/rpcs/p-chain/api" className="text-primary hover:underline">
        Primary Network
      </Link>
      . Issues an{' '}
      <Link
        href="/docs/rpcs/p-chain/txn-format#unsigned-add-permissionless-validator-tx"
        className="text-primary hover:underline"
      >
        AddPermissionlessValidatorTx
      </Link>{' '}
      on the P-Chain, or an{' '}
      <Link href="/docs/acps/236-auto-renewed-staking" className="text-primary hover:underline">
        AddAutoRenewedValidatorTx
      </Link>{' '}
      for auto-renewed staking (ACP-236, Fuji).
    </>
  ),
  toolRequirements: [WalletRequirementsConfigKey.WalletConnected],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

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
  // TODO(helicon-mainnet): flip to true for all networks once Helicon activates on Mainnet.
  const autoRenewAvailable = onFuji;
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
    if (!pChainAddress) return 'Connect Core Wallet to get your P-Chain address';
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
      if (!autoRenewAvailable) return 'Auto-renewed staking (ACP-236) is only available on Fuji';
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
          stakeInNanoAvax: avaxToNanoAvax(Number(stakeInAvax)),
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
          stakeInNanoAvax: avaxToNanoAvax(Number(stakeInAvax)),
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

  return (
    <SDKCodeViewer
      sources={isUpdateMode ? SET_CONFIG_SDK_SOURCES : isAutoRenew ? AUTO_RENEW_SDK_SOURCES : FIXED_SDK_SOURCES}
      height="auto"
    >
      <div>
        {txId ? (
          <div className="space-y-4">
            <Button
              variant="secondary"
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
              className="w-full"
            >
              {isUpdateMode ? 'Start Over' : 'Stake Another Validator'}
            </Button>
          </div>
        ) : (
          <Steps>
            <Step>
              <h3 className="text-[14px] font-semibold mb-1">Node Credentials</h3>
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mb-3">
                Provide your node's ID and BLS credentials.
              </p>

              <AddValidatorControls
                defaultAddress={pChainAddress || ''}
                canAddMore={!validator}
                onAddValidator={setValidator}
                isTestnet={false}
              />

              {validator && (
                <div className="mt-3 p-3 bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50 rounded-lg space-y-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-0.5">
                      Node ID
                    </div>
                    <div className="font-mono text-xs text-zinc-700 dark:text-zinc-300 break-all">
                      {validator.nodeID}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-0.5">
                      BLS Public Key
                    </div>
                    <div className="font-mono text-xs text-zinc-700 dark:text-zinc-300 break-all truncate">
                      {validator.nodePOP.publicKey}
                    </div>
                  </div>
                </div>
              )}

              {checkingExisting && (
                <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-2">Checking current validator status…</p>
              )}
              {isUpdateMode && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                  This node already has auto-renewed staking — switched to config update mode.
                </p>
              )}
            </Step>

            <Step>
              {existingValidator?.kind === 'fixed' && (
                <>
                  <h3 className="text-[14px] font-semibold mb-1">Existing Validator</h3>
                  <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mb-3">
                    This node is already a fixed-duration Primary Network validator.
                  </p>
                  <div className="p-3 bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50 rounded-lg space-y-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-0.5">
                        Stake
                      </div>
                      <div className="text-xs text-zinc-700 dark:text-zinc-300">{existingValidator.stakeAvax} AVAX</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-0.5">
                        Validating Until
                      </div>
                      <div className="text-xs text-zinc-700 dark:text-zinc-300">
                        {existingValidator.endTime ? new Date(existingValidator.endTime * 1000).toLocaleString() : '—'}
                      </div>
                    </div>
                  </div>
                  <Alert variant="info" className="mt-3">
                    Fixed-duration stake can't be modified. This node can be staked again after its current validation
                    ends.
                  </Alert>
                </>
              )}

              {existingValidator?.kind === 'autoRenewed' && !existingValidator.isAuthority && (
                <>
                  <h3 className="text-[14px] font-semibold mb-1">Auto-Renewed Validator</h3>
                  <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mb-3">
                    This node already validates with auto-renewal. Read-only view.
                  </p>
                  <div className="p-3 bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50 rounded-lg space-y-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-0.5">
                        Stake
                      </div>
                      <div className="text-xs text-zinc-700 dark:text-zinc-300">{existingValidator.stakeAvax} AVAX</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-0.5">
                        Cycle Period
                      </div>
                      <div className="text-xs text-zinc-700 dark:text-zinc-300">
                        {existingValidator.periodHours} hours
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-0.5">
                        Auto-Compound
                      </div>
                      <div className="text-xs text-zinc-700 dark:text-zinc-300">
                        {existingValidator.autoCompoundPct}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-0.5">
                        Validator Authority
                      </div>
                      <div className="font-mono text-xs text-zinc-700 dark:text-zinc-300 break-all">
                        {existingValidator.authorityAddresses.join(', ')}
                      </div>
                    </div>
                  </div>
                  <Alert variant="warning" className="mt-3">
                    The connected wallet is not this validator's authority — only the authority can update or stop it.
                  </Alert>
                </>
              )}

              {isUpdateMode && existingValidator && (
                <>
                  <h3 className="text-[14px] font-semibold mb-1">Auto-Renewal Config</h3>
                  <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mb-3">
                    Update the next cycle's period and auto-compounding for this validator.
                  </p>

                  <div className="space-y-4">
                    <div className="p-3 bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50 rounded-lg space-y-2">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-0.5">
                          Stake
                        </div>
                        <div className="text-xs text-zinc-700 dark:text-zinc-300">
                          {existingValidator.stakeAvax} AVAX
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-0.5">
                          Current Config
                        </div>
                        <div className="text-xs text-zinc-700 dark:text-zinc-300">
                          {existingValidator.periodHours}h cycle · {existingValidator.autoCompoundPct}% auto-compound
                        </div>
                      </div>
                    </div>

                    <Input
                      label="Cycle Period"
                      value={updPeriodHours}
                      onChange={setUpdPeriodHours}
                      type="number"
                      min={config.minPeriodHours}
                      max={MAX_PERIOD_HOURS}
                      unit="hours"
                      helperText={`Min: ${config.minPeriodHours} hours · Max: 1 year (${networkName})`}
                      error={
                        error &&
                        (Number(updPeriodHours) < config.minPeriodHours || Number(updPeriodHours) > MAX_PERIOD_HOURS)
                          ? `Must be between ${config.minPeriodHours} hours and 1 year`
                          : null
                      }
                    />

                    <Input
                      label="Auto-Compound Rewards"
                      value={updAutoCompound}
                      onChange={setUpdAutoCompound}
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      unit="%"
                      helperText="Share of each cycle's reward restaked (0 = withdraw all, 100 = restake all)"
                      error={
                        error && (Number(updAutoCompound) < 0 || Number(updAutoCompound) > 100)
                          ? 'Must be between 0-100%'
                          : null
                      }
                    />

                    <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                      Changes take effect from the next cycle.
                    </p>
                  </div>
                </>
              )}

              {!existingValidator && (
                <>
                  <h3 className="text-[14px] font-semibold mb-1">Stake Configuration</h3>
                  <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mb-3">
                    {isAutoRenew
                      ? 'Set your stake amount, delegation fee, cycle period, and auto-compounding.'
                      : 'Set your stake amount, delegation fee, and duration.'}
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                        Staking Mode
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setStakingMode('fixed');
                            setError(null);
                          }}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${
                            !isAutoRenew
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                          }`}
                        >
                          <div className="font-medium text-sm">Fixed Duration</div>
                          <div className="text-xs text-zinc-500">Stake until a set end date</div>
                        </button>
                        <button
                          type="button"
                          disabled={!autoRenewAvailable}
                          onClick={() => {
                            setStakingMode('autoRenew');
                            setError(null);
                          }}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${
                            isAutoRenew
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                          } ${!autoRenewAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div className="font-medium text-sm">Auto-Renewed</div>
                          <div className="text-xs text-zinc-500">Restakes each cycle (ACP-236)</div>
                        </button>
                      </div>
                      {!autoRenewAvailable && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                          Auto-renewed staking (Helicon upgrade) is not yet activated on Mainnet — available on Fuji.
                        </p>
                      )}
                    </div>

                    <Input
                      label="Stake Amount"
                      value={stakeInAvax}
                      onChange={setStakeInAvax}
                      type="number"
                      step="0.001"
                      min={config.minStakeAvax}
                      unit="AVAX"
                      helperText={`Minimum: ${config.minStakeAvax.toLocaleString()} AVAX (${networkName})`}
                      error={
                        error && Number(stakeInAvax) < config.minStakeAvax
                          ? `Minimum stake is ${config.minStakeAvax} AVAX`
                          : null
                      }
                    />

                    <Input
                      label="Delegation Fee"
                      value={delegationFee}
                      onChange={setDelegationFee}
                      type="number"
                      step="0.1"
                      min="2"
                      max="100"
                      unit="%"
                      helperText="Your fee from delegators (2-100%)"
                      error={
                        error && (Number(delegationFee) < 2 || Number(delegationFee) > 100)
                          ? 'Must be between 2-100%'
                          : null
                      }
                    />

                    {!isAutoRenew && (
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                          Duration
                        </label>
                        <div className="flex gap-2 mb-2">
                          {config.presets.map((preset) => (
                            <button
                              key={preset.days}
                              onClick={() => setEndInDays(preset.days)}
                              className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-colors ${
                                isDateButtonActive(preset.days)
                                  ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-400 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100'
                                  : 'border-zinc-200/80 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                              }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                        <Input
                          label=""
                          value={endTime}
                          onChange={setEndTime}
                          type="datetime-local"
                          helperText={`Min: ${config.minEndLabel} · Max: 1 year`}
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
                        <div>
                          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                            Cycle Period
                          </label>
                          <div className="flex gap-2 mb-2">
                            {config.periodPresets.map((preset) => (
                              <button
                                key={preset.hours}
                                onClick={() => setPeriodHours(String(preset.hours))}
                                className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-colors ${
                                  Number(periodHours) === preset.hours
                                    ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-400 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100'
                                    : 'border-zinc-200/80 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                                }`}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                          <Input
                            label=""
                            value={periodHours}
                            onChange={setPeriodHours}
                            type="number"
                            min={config.minPeriodHours}
                            max={MAX_PERIOD_HOURS}
                            unit="hours"
                            helperText={`Stake auto-renews every cycle · Min: ${config.minPeriodHours} hours · Max: 1 year (${networkName})`}
                            error={
                              error &&
                              (Number(periodHours) < config.minPeriodHours || Number(periodHours) > MAX_PERIOD_HOURS)
                                ? `Must be between ${config.minPeriodHours} hours and 1 year`
                                : null
                            }
                          />
                        </div>

                        <Input
                          label="Auto-Compound Rewards"
                          value={autoCompound}
                          onChange={setAutoCompound}
                          type="number"
                          step="1"
                          min="0"
                          max="100"
                          unit="%"
                          helperText="Share of each cycle's reward restaked (0 = withdraw all, 100 = restake all)"
                          error={
                            error && (Number(autoCompound) < 0 || Number(autoCompound) > 100)
                              ? 'Must be between 0-100%'
                              : null
                          }
                        />

                        <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                          The stake renews automatically at the end of each cycle. Stop anytime — the validator exits at
                          the end of its current cycle.
                        </p>
                      </>
                    )}
                  </div>
                </>
              )}
            </Step>

            {(!existingValidator || isUpdateMode) && (
              <Step>
                {isUpdateMode ? (
                  <>
                    <h3 className="text-[14px] font-semibold mb-1">Submit</h3>
                    <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mb-3">
                      Issues a{' '}
                      <Link href="/docs/acps/236-auto-renewed-staking" className="text-primary hover:underline">
                        SetAutoRenewedValidatorConfigTx
                      </Link>{' '}
                      on the P-Chain.
                    </p>

                    {error && <Alert variant="error">{error}</Alert>}

                    <Button
                      onClick={() => submitConfigUpdate(false)}
                      disabled={!pChainAddress || isSubmitting}
                      loading={isSubmitting}
                      loadingText="Processing..."
                      variant="primary"
                      className="w-full mt-3"
                    >
                      Update Config
                    </Button>

                    {!confirmStop ? (
                      <Button
                        variant="outline-danger"
                        className="w-full mt-2"
                        onClick={() => setConfirmStop(true)}
                        disabled={isSubmitting}
                      >
                        Stop Auto-Renewal
                      </Button>
                    ) : (
                      <div className="mt-2 space-y-2">
                        <Alert variant="warning">
                          The validator exits at the end of its current cycle and the stake returns to your wallet.
                        </Alert>
                        <Button
                          variant="danger"
                          className="w-full"
                          onClick={() => submitConfigUpdate(true)}
                          disabled={isSubmitting}
                          loading={isSubmitting}
                          loadingText="Processing..."
                        >
                          Confirm Stop
                        </Button>
                        <Button
                          variant="secondary"
                          className="w-full"
                          onClick={() => setConfirmStop(false)}
                          disabled={isSubmitting}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}

                    <CliAlternative command={cliCommand} />
                  </>
                ) : (
                  <>
                    <h3 className="text-[14px] font-semibold mb-1">Submit</h3>
                    <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mb-3">
                      {isAutoRenew ? (
                        <>
                          Issues an{' '}
                          <Link href="/docs/acps/236-auto-renewed-staking" className="text-primary hover:underline">
                            AddAutoRenewedValidatorTx
                          </Link>{' '}
                          on the P-Chain. Your stake automatically renews every cycle.
                        </>
                      ) : (
                        <>
                          Issues an{' '}
                          <Link
                            href="/docs/rpcs/p-chain/txn-format#unsigned-add-permissionless-validator-tx"
                            className="text-primary hover:underline"
                          >
                            AddPermissionlessValidatorTx
                          </Link>{' '}
                          on the P-Chain.
                        </>
                      )}
                    </p>

                    {error && <Alert variant="error">{error}</Alert>}

                    <Button
                      onClick={submitStake}
                      disabled={!pChainAddress || isSubmitting || checkingExisting}
                      loading={isSubmitting}
                      loadingText="Processing..."
                      variant="primary"
                      className="w-full mt-3"
                    >
                      Stake {networkName} Validator
                    </Button>

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
