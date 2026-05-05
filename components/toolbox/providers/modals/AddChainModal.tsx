'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Globe, Search } from 'lucide-react';
import { Button } from '../../components/Button';
import { getL1ListStore, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { Input } from '../../components/Input';
import { getBlockchainInfo, getChainDetails, getSubnetInfo } from '../../coreViem/utils/glacier';
import { Dialog, DialogContent, DialogOverlay, DialogTitle } from '../../components/ui/dialog';
import { fetchChainId } from '../../lib/chainId';
import { useWallet } from '../../hooks/useWallet';
import { useModalState } from '../../hooks/useModal';
import { useLookupChain } from '@/components/toolbox/hooks/useLookupChain';
import { toast } from '@/lib/toast';
import type { ChainData } from '@/types/wallet';
import { cn } from '@/lib/utils';
import { networkIDs } from '@avalabs/avalanchejs';

/**
 * Modal for adding an existing Avalanche L1 to the user's wallet.
 *
 * UX principles (post-redesign):
 *   - **One input, not ten.** User enters RPC URL (or looks up by chain
 *     ID via an inline toggle). Everything else is detected and shown
 *     as display, not inputs. The only real edits are Display Name +
 *     Symbol, revealed after detection.
 *   - **Detected data belongs in a card, not form fields.** The seven
 *     disabled inputs in the legacy version were display values wearing
 *     form-field costumes. Surfaced here as a compact summary card.
 *   - **Progressive reveal.** Empty state shows a single input and a
 *     mode toggle. Detecting state shows a spinner row. Detected state
 *     reveals the summary card + customization fields with a spring fade.
 */

interface AddChainFormData {
  rpcUrl: string;
  chainName: string;
  coinName: string;
  evmChainId: number;
  chainId: string;
  subnetId: string;
  wrappedTokenAddress: string;
  validatorManagerAddress: string;
  validatorManagerBlockchainId: string;
  logoUrl: string;
  isTestnet: boolean;
}

type InputMode = 'rpc' | 'chainId';

/**
 * Thin open/closed shell. The actual form lives in `AddChainModalInner`
 * which is mounted *only* while `isOpen` — that way each open starts
 * with fresh `useForm` / `useState` / `useEffect` instances. The previous
 * version used `if (!isOpen) return null` inside the same component,
 * which keeps the component mounted and preserves form state across
 * open/close cycles. That caused the second open with the same RPC URL
 * to fail to re-detect the chain (stale form values + an in-flight
 * fetch from the previous open could clobber the freshly-reset state).
 */
export function AddChainModal() {
  const { isOpen } = useModalState();
  if (!isOpen) return null;
  return <AddChainModalInner />;
}

function AddChainModalInner() {
  const { options, closeModal } = useModalState();
  const { client: walletClient } = useWallet();
  const testnetL1List = getL1ListStore(true)((state: { l1List: L1ListItem[] }) => state.l1List);
  const mainnetL1List = getL1ListStore(false)((state: { l1List: L1ListItem[] }) => state.l1List);
  const l1List = useMemo(() => [...testnetL1List, ...mainnetL1List], [testnetL1List, mainnetL1List]);
  const { anyChainId, setAnyChainId, error: lookupError, isLookingUp, lookup } = useLookupChain();
  const [inputMode, setInputMode] = useState<InputMode>('rpc');
  const [isFetchingChainData, setIsFetchingChainData] = useState(false);
  // Optional genesis JSON — pasted by users importing an external L1 they
  // know the genesis for, or seeded by the caller (e.g. the create-l1
  // wizard) via `options.genesisData` so the user doesn't need to re-paste
  // a JSON they already configured. When supplied it powers Copy Genesis
  // on the L1 detail page; otherwise that tile stays hidden.
  const [genesisData, setGenesisData] = useState(options?.genesisData ?? '');
  const [genesisError, setGenesisError] = useState<string | null>(null);

  // Seed defaults from the caller's options on mount. Because this
  // component unmounts on close and remounts on open, useForm picks up
  // the latest options.rpcUrl every time without needing a reset effect.
  const form = useForm<AddChainFormData>({
    defaultValues: {
      rpcUrl: options?.rpcUrl || '',
      chainName: options?.chainName || '',
      coinName: options?.coinName || '',
      evmChainId: 0,
      chainId: '',
      subnetId: '',
      wrappedTokenAddress: '',
      validatorManagerAddress: '',
      validatorManagerBlockchainId: '',
      logoUrl: '',
      isTestnet: false,
    },
  });

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    trigger,
    formState: { isSubmitting, errors },
  } = form;

  const rpcUrl = useWatch({ control, name: 'rpcUrl' });
  const chainName = watch('chainName');
  const coinName = watch('coinName');
  const evmChainId = watch('evmChainId');
  const chainId = watch('chainId');
  const logoUrl = watch('logoUrl');
  const validatorManagerAddress = watch('validatorManagerAddress');
  const isTestnet = watch('isTestnet');

  const checkChainExists = useCallback(
    (chainIdToCheck: string, evmChainIdToCheck: number) => {
      if (!chainIdToCheck && !evmChainIdToCheck) return null;
      return l1List.find((c: L1ListItem) => c.id === chainIdToCheck || c.evmChainId === evmChainIdToCheck);
    },
    [l1List],
  );

  // Fetch + populate chain metadata whenever the RPC URL changes.
  // Preserves the original three-call glacier flow; only the error/
  // display handling changes on the view side.
  useEffect(() => {
    async function fetchChainData() {
      setValue('evmChainId', 0);
      setValue('chainId', '');
      setValue('chainName', '');
      setValue('logoUrl', '');
      // Seed isTestnet from the caller's authoritative flag so the
      // DetectedChainCard badge reflects the known network even before
      // Glacier responds, and stays correct if Glacier later disagrees.
      if (options?.isTestnet !== undefined) {
        setValue('isTestnet', options.isTestnet);
      }

      if (!rpcUrl) {
        setIsFetchingChainData(false);
        return;
      }

      setIsFetchingChainData(true);
      if (!rpcUrl.startsWith('https://') && !rpcUrl.includes('localhost') && !rpcUrl.includes('127.0.0.1')) {
        form.setError('rpcUrl', {
          type: 'validation',
          message: 'The RPC URL must start with https:// or include localhost / 127.0.0.1',
        });
        setIsFetchingChainData(false);
        return;
      }

      try {
        form.clearErrors('rpcUrl');

        const { ethereumChainId, avalancheChainId } = await fetchChainId(rpcUrl);
        setValue('evmChainId', ethereumChainId);
        setValue('chainId', avalancheChainId);

        const blockchainInfo = await getBlockchainInfo(avalancheChainId);
        setValue('subnetId', blockchainInfo.subnetId);
        setValue('chainName', blockchainInfo.blockchainName || '');
        // Caller-supplied isTestnet wins — Glacier silently falls back to
        // mainnet on a 404, which mislabels brand-new testnet L1s that
        // haven't been indexed yet.
        setValue('isTestnet', options?.isTestnet !== undefined ? options.isTestnet : blockchainInfo.isTestnet);
        setValue('wrappedTokenAddress', '');

        const subnetInfo = await getSubnetInfo(blockchainInfo.subnetId);
        setValue('validatorManagerAddress', subnetInfo.l1ValidatorManagerDetails?.contractAddress || '');
        setValue('validatorManagerBlockchainId', subnetInfo.l1ValidatorManagerDetails?.blockchainId || '');

        try {
          const chainDetails = await getChainDetails(String(ethereumChainId));
          setValue('logoUrl', chainDetails.chainLogoUri || '');
        } catch {
          setValue('logoUrl', '');
        }

        const existingChain = checkChainExists(avalancheChainId, ethereumChainId);
        if (existingChain) {
          form.setError('root', {
            type: 'duplicate',
            message: `This chain is already in your wallet as "${existingChain.name}".`,
          });
        } else {
          form.clearErrors('root');
        }

        await trigger(['chainName', 'evmChainId', 'chainId']);
      } catch (e) {
        form.setError('rpcUrl', {
          type: 'api',
          message: (e as Error)?.message || String(e),
        });
      } finally {
        setIsFetchingChainData(false);
      }
    }

    fetchChainData();
  }, [rpcUrl, setValue, form, trigger, checkChainExists]);

  const addChainDirect = async (chainData: ChainData): Promise<boolean> => {
    if (!walletClient) {
      toast.error('Wallet not connected', 'Please connect your wallet first');
      return false;
    }

    try {
      const chainIdHex = `0x${chainData.evmChainId.toString(16)}`;

      // wallet_addEthereumChain directly instead of viem's addChain —
      // only this path forwards Core wallet's proprietary isTestnet flag.
      await walletClient.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: chainIdHex,
            chainName: chainData.name,
            nativeCurrency: { name: chainData.coinName, symbol: chainData.coinName, decimals: 18 },
            rpcUrls: [chainData.rpcUrl],
            isTestnet: chainData.isTestnet,
          },
        ] as any,
      });

      await walletClient.switchChain({ id: chainData.evmChainId });

      // Sync walletChainId so downstream gates (ChainGate) observe the
      // switch. wagmi's useChainId ignores chains not in wagmiConfig,
      // so custom L1s would otherwise leave walletChainId stale.
      const walletStore = useWalletStore.getState();
      walletStore.setWalletChainId(chainData.evmChainId);
      walletStore.setIsTestnet(chainData.isTestnet);
      walletStore.setAvalancheNetworkID(chainData.isTestnet ? networkIDs.FujiID : networkIDs.MainnetID);

      getL1ListStore(chainData.isTestnet).getState().addL1(chainData);
      toast.success('Chain added successfully!', `${chainData.name} has been added to your wallet`);
      return true;
    } catch (e) {
      toast.error('Failed to add chain', (e as Error)?.message || String(e));
      return false;
    }
  };

  const onSubmit = async (data: AddChainFormData) => {
    try {
      const existingChain = checkChainExists(data.chainId, data.evmChainId);
      if (existingChain) {
        form.setError('root', {
          type: 'duplicate',
          message: `This chain is already in your wallet as "${existingChain.name}".`,
        });
        return;
      }

      // Optional field — only validate when the user actually pasted something.
      // Empty / whitespace-only stays absent so back-compat behavior is preserved.
      const trimmedGenesis = genesisData.trim();
      let validatedGenesis: string | undefined;
      if (trimmedGenesis.length > 0) {
        try {
          JSON.parse(trimmedGenesis);
          validatedGenesis = trimmedGenesis;
          setGenesisError(null);
        } catch (parseErr) {
          setGenesisError(parseErr instanceof Error ? `Invalid JSON: ${parseErr.message}` : 'Invalid JSON');
          return;
        }
      } else {
        setGenesisError(null);
      }

      const chainData: ChainData = {
        id: data.chainId,
        name: data.chainName,
        rpcUrl: data.rpcUrl,
        evmChainId: data.evmChainId,
        coinName: data.coinName,
        isTestnet: data.isTestnet,
        subnetId: data.subnetId,
        wrappedTokenAddress: data.wrappedTokenAddress,
        validatorManagerAddress: data.validatorManagerAddress,
        validatorManagerBlockchainId: data.validatorManagerBlockchainId || undefined,
        logoUrl: data.logoUrl,
        genesisData: validatedGenesis,
      };

      await addChainDirect(chainData);
      closeModal({ success: true, chainData });
    } catch (e) {
      form.setError('root', {
        type: 'api',
        message: (e as Error)?.message || String(e),
      });
    }
  };

  const detected = !!evmChainId && !!chainId && !isFetchingChainData;
  const allowLookup = (options?.allowLookup ?? true) && !options?.rpcUrl;
  const rpcUrlError = errors.rpcUrl?.message;
  const rootError = errors.root?.message;
  const submitDisabled =
    !chainName ||
    !coinName ||
    !rpcUrl ||
    !chainId ||
    !evmChainId ||
    !!errors.root ||
    !!checkChainExists(chainId, evmChainId);

  return (
    <Dialog.Root open={true} onOpenChange={() => closeModal({ success: false })}>
      <Dialog.Portal>
        <DialogOverlay />
        <DialogContent className="max-w-lg">
          <div className="mb-1">
            <DialogTitle className="mb-1">Add an Avalanche L1</DialogTitle>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Connect an existing L1 to your wallet by RPC URL or chain ID.
            </p>
          </div>

          {/* Mode toggle — hidden when caller pre-filled the rpcUrl (e.g.,
              "Add L1 to wallet" from the deployment recap). */}
          {allowLookup && (
            <div className="mt-5 mb-4 inline-flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/50">
              <ModeButton active={inputMode === 'rpc'} onClick={() => setInputMode('rpc')}>
                <Globe className="h-3 w-3" />
                <span>RPC URL</span>
              </ModeButton>
              <ModeButton active={inputMode === 'chainId'} onClick={() => setInputMode('chainId')}>
                <Search className="h-3 w-3" />
                <span>Chain ID</span>
              </ModeButton>
            </div>
          )}

          <form id="add-chain-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {inputMode === 'rpc' ? (
              <Controller
                name="rpcUrl"
                control={control}
                rules={{ required: 'RPC URL is required' }}
                render={({ field }) => (
                  <Input
                    id="rpcUrl"
                    label="RPC URL"
                    value={field.value}
                    onChange={field.onChange}
                    disabled={!!options?.rpcUrl}
                    placeholder="https://api.example.com/ext/bc/abc/rpc"
                    error={rpcUrlError}
                  />
                )}
              />
            ) : (
              <Input
                id="anyChainId"
                label="Chain ID"
                value={anyChainId}
                onChange={setAnyChainId}
                placeholder="43114 or 2q9e4r6Mu3U68nU…"
                error={lookupError}
                button={
                  <Button
                    stickLeft
                    onClick={async () => {
                      const result = await lookup();
                      if (result) {
                        setValue('rpcUrl', result.rpcUrl);
                        setValue('coinName', result.coinName);
                        await trigger(['rpcUrl', 'coinName']);
                        setInputMode('rpc');
                      }
                    }}
                    loading={isLookingUp}
                  >
                    Lookup
                  </Button>
                }
              />
            )}

            {/* Fetching → spinner row. Detected → rich summary card. */}
            <AnimatePresence mode="wait">
              {isFetchingChainData ? (
                <motion.div
                  key="detecting"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/50 px-4 py-3"
                >
                  <div className="h-4 w-4 rounded-full border-2 border-zinc-300 dark:border-zinc-700 border-t-primary animate-spin" />
                  <span className="text-sm text-zinc-600 dark:text-zinc-300">Detecting chain…</span>
                </motion.div>
              ) : detected ? (
                <motion.div
                  key="detected"
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 24 }}
                  className="space-y-4"
                >
                  <DetectedChainCard
                    chainName={chainName}
                    evmChainId={evmChainId}
                    chainId={chainId}
                    validatorManagerAddress={validatorManagerAddress}
                    isTestnet={isTestnet}
                    logoUrl={logoUrl}
                  />

                  {/* The two actually-editable fields, revealed only once
                      we have detected context so the user isn't typing
                      into a vacuum. */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Controller
                      name="chainName"
                      control={control}
                      rules={{ required: 'Display name required' }}
                      render={({ field, fieldState }) => (
                        <Input
                          label="Display Name"
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="My Chain"
                          error={fieldState.error?.message}
                        />
                      )}
                    />
                    <Controller
                      name="coinName"
                      control={control}
                      rules={{ required: 'Symbol required' }}
                      render={({ field, fieldState }) => (
                        <Input
                          label="Symbol"
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="COIN"
                          error={fieldState.error?.message}
                        />
                      )}
                    />
                  </div>

                  {/* Optional genesis paste — collapsed by default so users
                      who don't have the JSON aren't nagged. When supplied,
                      powers Copy Genesis on the L1 detail page. */}
                  <details className="group">
                    <summary className="cursor-pointer text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 select-none">
                      Genesis JSON (optional)
                    </summary>
                    <div className="mt-2 space-y-1.5">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Paste the chain&apos;s genesis JSON if you have it. Used by Copy Genesis on the L1 detail page.
                        Leave blank if you don&apos;t have it.
                      </p>
                      <textarea
                        value={genesisData}
                        onChange={(e) => {
                          setGenesisData(e.target.value);
                          if (genesisError) setGenesisError(null);
                        }}
                        rows={6}
                        placeholder='{"config": { "chainId": 9999, ...}}'
                        className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-mono"
                      />
                      {genesisError && <p className="text-xs text-red-600 dark:text-red-400">{genesisError}</p>}
                    </div>
                  </details>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {rootError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                {rootError}
              </div>
            )}
          </form>

          <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <Button onClick={() => closeModal({ success: false })} variant="secondary" stickLeft>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit(onSubmit)}
              variant="primary"
              loading={isSubmitting}
              disabled={submitDisabled}
              stickLeft
            >
              Add Chain
            </Button>
          </div>
        </DialogContent>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors',
        active
          ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
          : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100',
      )}
    >
      {children}
    </button>
  );
}

function DetectedChainCard({
  chainName,
  evmChainId,
  chainId,
  validatorManagerAddress,
  isTestnet,
  logoUrl,
}: {
  chainName: string;
  evmChainId: number;
  chainId: string;
  validatorManagerAddress: string;
  isTestnet: boolean;
  logoUrl: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      {/* Header strip: logo + name + testnet badge + detected checkmark */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="h-10 w-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex items-center justify-center shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase">
              {chainName?.slice(0, 2) || 'L1'}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {chainName || 'Unknown chain'}
            </span>
            {isTestnet && (
              <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20">
                Testnet
              </span>
            )}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            EVM Chain ID · <span className="font-mono tabular-nums text-zinc-700 dark:text-zinc-300">{evmChainId}</span>
          </div>
        </div>
        <div className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
          <Check className="h-3.5 w-3.5" />
        </div>
      </div>

      {/* Metadata strip — compact address display with copy affordances. */}
      <div className="border-t border-zinc-100 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-900">
        <DetectedDetailRow label="Avalanche Chain ID" value={chainId} />
        {validatorManagerAddress && <DetectedDetailRow label="Validator Manager" value={validatorManagerAddress} />}
      </div>
    </div>
  );
}

function DetectedDetailRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="px-4 py-2 flex items-center gap-2 group">
      <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 shrink-0 w-[120px]">
        {label}
      </span>
      <code className="flex-1 min-w-0 font-mono text-[11px] text-zinc-700 dark:text-zinc-300 truncate select-all">
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label}`}
        title="Copy"
        className="shrink-0 inline-flex items-center rounded p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 opacity-60 group-hover:opacity-100 focus-visible:opacity-100 transition-colors"
      >
        {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );
}
