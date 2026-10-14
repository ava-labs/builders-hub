import { useState, useEffect } from 'react';
import { useWalletStore } from '../stores/walletStore';
import { useViemChainStore } from '../stores/toolboxStore';
import { getActiveRulesAt } from '../coreViem';
import { makePublicClientForChain } from '../hooks/usePublicClientForChain';
import { cn } from '../lib/utils';
import { AlertTriangle, ExternalLink, RefreshCw, Blocks, ArrowRightLeft } from 'lucide-react';
import { Button } from './Button';
import { useSwitchNetworkModal } from '../providers/modals/SwitchNetworkModal';

type PrecompileConfigKey =
  | 'warpConfig'
  | 'contractDeployerAllowListConfig'
  | 'txAllowListConfig'
  | 'feeManagerConfig'
  | 'rewardManagerConfig'
  | 'contractNativeMinterConfig';

// Precompile documentation links
const PRECOMPILE_DOCS: Record<PrecompileConfigKey, string> = {
  warpConfig: '/docs/avalanche-l1s/icm/icm-overview',
  contractDeployerAllowListConfig: '/docs/avalanche-l1s/security/deployer-allowlist',
  txAllowListConfig: '/docs/avalanche-l1s/security/transaction-allowlist',
  feeManagerConfig: '/docs/avalanche-l1s/customize/fee-config',
  rewardManagerConfig: '/docs/avalanche-l1s/customize/reward-manager',
  contractNativeMinterConfig: '/docs/avalanche-l1s/customize/native-minter',
};

interface CheckPrecompileProps {
  children: React.ReactNode;
  configKey: PrecompileConfigKey;
  precompileName: string;
  errorMessage?: string;
  docsLink?: string;
  docsLinkText?: string;
}

interface PrecompileState {
  isActive: boolean;
  isLoading: boolean;
  error: string | null;
}

export const CheckPrecompile = ({
  children,
  configKey,
  precompileName,
  errorMessage,
  docsLink,
  docsLinkText = 'Learn how to enable this precompile',
}: CheckPrecompileProps) => {
  const { walletChainId } = useWalletStore();
  const viemChain = useViemChainStore();
  const { openSwitchNetwork } = useSwitchNetworkModal();
  const [state, setState] = useState<PrecompileState>({
    isActive: false,
    isLoading: false,
    error: null,
  });

  const checkPrecompileStatus = async () => {
    if (!viemChain?.rpcUrls?.default?.http?.[0]) return;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Dedicated publicClient that hits the chain's RPC directly —
      // the Core wallet provider doesn't support eth_getActiveRulesAt.
      const rpcPublicClient = makePublicClientForChain(viemChain.rpcUrls.default.http[0], [], viemChain);
      if (!rpcPublicClient) return;

      const data = await getActiveRulesAt(rpcPublicClient);
      // Treat presence of a timestamp (including 0) as active.
      // Some networks may report 0 when enabled at genesis.
      const isActive = data.precompiles?.[configKey]?.timestamp !== undefined;
      setState({ isLoading: false, isActive, error: null });
    } catch (err) {
      console.error('Error checking precompile:', err);
      setState({
        isLoading: false,
        isActive: false,
        error: err instanceof Error ? err.message : 'An unknown error occurred',
      });
    }
  };

  useEffect(() => {
    if (!viemChain?.rpcUrls?.default?.http?.[0]) return;
    checkPrecompileStatus();
  }, [viemChain, configKey, walletChainId]);

  const resolvedDocsLink = docsLink || PRECOMPILE_DOCS[configKey];
  const chainName = viemChain?.name || 'this chain';

  // Loading state - centered spinner
  if (state.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-8">
        <div className="text-center">
          <div className="relative mx-auto h-10 w-10">
            <div className="h-10 w-10 rounded-full border-2 border-zinc-200 dark:border-zinc-800" />
            <div className="absolute inset-0 h-10 w-10 animate-spin rounded-full border-2 border-transparent border-t-zinc-900 dark:border-t-zinc-100" />
          </div>
          <p className="mt-4 text-[13px] text-zinc-500 dark:text-zinc-400">Checking {precompileName} availability...</p>
        </div>
      </div>
    );
  }

  // Error state - centered with retry option
  if (state.error) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-8">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center border border-red-200 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/20">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="mb-2 text-[17px] font-semibold text-zinc-900 dark:text-zinc-100">Connection Error</h3>
          <p className="mb-4 text-[13px] text-zinc-500 dark:text-zinc-400">
            Unable to check if {precompileName} is available on {chainName}.
          </p>
          <p className="mb-6 border border-zinc-200 bg-zinc-50/60 p-2 font-mono text-[11px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
            {state.error}
          </p>
          <Button variant="primary" onClick={checkPrecompileStatus} className="inline-flex items-center gap-2">
            <RefreshCw className="h-3.5 w-3.5" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Precompile not active - centered with actions
  if (!state.isActive) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-8">
        <div className="max-w-lg w-full text-center">
          {/* Icon */}
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center border border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20">
            <Blocks className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>

          {/* Title */}
          <h3 className="mb-2 text-[19px] font-semibold text-zinc-900 dark:text-zinc-100">
            {precompileName} Not Available
          </h3>

          {/* Description */}
          <p className="mx-auto mb-6 max-w-md text-[13px] text-zinc-500 dark:text-zinc-400">
            {errorMessage || (
              <>
                The <span className="font-medium">{precompileName}</span> precompile is not enabled on{' '}
                <span className="font-medium">{chainName}</span>. This feature requires the precompile to be activated
                in the chain&apos;s genesis configuration.
              </>
            )}
          </p>

          {/* Info card */}
          <div className="mb-6 border border-zinc-200 bg-zinc-50/60 p-4 text-left dark:border-zinc-800 dark:bg-zinc-900/40">
            <h4 className="mb-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
              What you can do
            </h4>
            <ul className="space-y-2 text-[13px] text-zinc-700 dark:text-zinc-300">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-amber-600 dark:text-amber-400">•</span>
                <span>Switch to an L1 chain that has this precompile enabled</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-amber-600 dark:text-amber-400">•</span>
                <span>Deploy a new L1 with this precompile in the genesis configuration</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-amber-600 dark:text-amber-400">•</span>
                <span>Enable this precompile via an upgrade (if you have admin access)</span>
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => openSwitchNetwork()}
              className={cn(
                'inline-flex h-10 items-center justify-center gap-2 border px-4',
                'font-mono text-[11px] font-bold uppercase tracking-[0.14em]',
                'border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-700 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300',
                'transition-colors',
              )}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Switch Network
            </button>
            {resolvedDocsLink && (
              <a
                href={resolvedDocsLink}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'group/docs inline-flex h-10 items-center justify-center gap-2 border px-4',
                  'font-mono text-[11px] font-bold uppercase tracking-[0.14em]',
                  'border-zinc-300 bg-transparent text-zinc-900 hover:border-zinc-900 dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-zinc-300',
                  'transition-colors',
                )}
              >
                <ExternalLink className="h-3.5 w-3.5 transition-colors group-hover/docs:text-[#E6212F]" />
                {docsLinkText}
              </a>
            )}
          </div>

          {/* Current chain info */}
          <div className="mt-6 border-t border-zinc-200 pt-6 dark:border-zinc-800">
            <p className="text-[12px] text-zinc-500 dark:text-zinc-500">
              Connected to: <span className="font-medium text-zinc-700 dark:text-zinc-300">{chainName}</span>
              {walletChainId && (
                <span className="ml-1 text-zinc-400 dark:text-zinc-600">(Chain ID: {walletChainId})</span>
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
