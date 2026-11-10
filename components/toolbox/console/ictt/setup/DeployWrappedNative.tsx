'use client';

import WrappedNativeToken from '@/contracts/icm-contracts/compiled/WrappedNativeToken.json';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { useWrappedNativeToken, useSetWrappedNativeToken } from '@/components/toolbox/stores/l1ListStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useResolvedWalletClient } from '@/components/toolbox/hooks/useResolvedWalletClient';
import { useNativeCurrencyInfo, useSetNativeCurrencyInfo } from '@/components/toolbox/stores/l1ListStore';
import { useState, useEffect } from 'react';
import { Button } from '@/components/toolbox/components/Button';
import { Success } from '@/components/toolbox/components/Success';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import { useSelectedL1 } from '@/components/toolbox/stores/l1ListStore';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import WrapNativeToken from './wrapped-native-token/WrapNativeToken';
import UnwrapNativeToken from './wrapped-native-token/UnwrapNativeToken';
import DisplayNativeBalance from './wrapped-native-token/DisplayNativeBalance';
import DisplayWrappedBalance from './wrapped-native-token/DisplayWrappedBalance';
import {
  BaseConsoleToolProps,
  ConsoleToolMetadata,
  withConsoleToolMetadata,
} from '@/components/toolbox/components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import { useContractDeployer } from '@/components/toolbox/hooks/contracts';
import versions from '@/scripts/versions.json';
import { ContractDeployViewer, type ContractSource } from '@/components/console/contract-deploy-viewer';
import { HashChip } from '@/components/explorer-v2/ui';
import { BODY, Loading, StatusTag } from '../bridge/ui';

const ICM_COMMIT = versions['ava-labs/icm-services'];

const CONTRACT_SOURCES: ContractSource[] = [
  {
    name: 'WrappedNativeToken',
    filename: 'WrappedNativeToken.sol',
    url: `https://raw.githubusercontent.com/ava-labs/icm-services/${ICM_COMMIT}/contracts/ictt/mocks/WrappedNativeToken.sol`,
    description: "ERC20 wrapper for the L1's native token, enabling it to be used with ICTT bridges.",
  },
];

// Pre-deployed wrapped native token address (from genesis)
// This is the standard address used in the pre-installed contracts section
const PREDEPLOYED_WRAPPED_NATIVE_ADDRESS = '0x1111111111111111111111111111111111111111';

const metadata: ConsoleToolMetadata = {
  title: 'Wrapped Native Token',
  description: 'Deploy a wrapped native token or use the pre-deployed one to wrap/unwrap native tokens.',
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function DeployWrappedNative({ onSuccess: _onSuccess }: BaseConsoleToolProps) {
  const [criticalError, setCriticalError] = useState<Error | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const setWrappedNativeToken = useSetWrappedNativeToken();
  const selectedL1 = useSelectedL1();

  // Get cached values from wallet store
  const cachedWrappedToken = useWrappedNativeToken();
  const cachedNativeCurrency = useNativeCurrencyInfo();

  // Initialize with cached value to prevent flickering
  const [wrappedNativeTokenAddress, setLocalWrappedNativeTokenAddress] = useState<string>(cachedWrappedToken || '');
  const [hasPredeployedToken, setHasPredeployedToken] = useState(!!cachedWrappedToken);
  const [isCheckingToken, setIsCheckingToken] = useState(!cachedWrappedToken);
  const { walletChainId, walletEVMAddress } = useWalletStore();
  const walletClient = useResolvedWalletClient();
  const setNativeCurrencyInfo = useSetNativeCurrencyInfo();
  const viemChain = useViemChainStore();
  const { deploy, isDeploying } = useContractDeployer();

  // Get native token symbol (use cached value if available)
  const nativeTokenSymbol =
    cachedNativeCurrency?.symbol || viemChain?.nativeCurrency?.symbol || selectedL1?.coinName || 'COIN';
  const wrappedTokenSymbol = `W${nativeTokenSymbol}`;

  // Throw critical errors during render
  if (criticalError) {
    throw criticalError;
  }

  // Handle mounting to avoid hydration errors
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Sync cached wrapped token with local state immediately
  useEffect(() => {
    if (cachedWrappedToken && wrappedNativeTokenAddress !== cachedWrappedToken) {
      setLocalWrappedNativeTokenAddress(cachedWrappedToken);
      setHasPredeployedToken(true);
      setIsCheckingToken(false);
    }
  }, [cachedWrappedToken, wrappedNativeTokenAddress]);

  // Validate that an address is a valid wrapped native token contract
  async function validateWrappedTokenContract(address: string, publicClient: any): Promise<boolean> {
    try {
      // Check if contract has bytecode
      const code = await publicClient.getBytecode({ address: address as `0x${string}` });
      if (!code || code === '0x') {
        return false;
      }

      // Try to call balanceOf to verify it's a valid ERC20-like contract
      // We use a test address to avoid issues with undefined walletEVMAddress
      await publicClient.readContract({
        address: address as `0x${string}`,
        abi: WrappedNativeToken.abi,
        functionName: 'balanceOf',
        args: ['0x0000000000000000000000000000000000000000'],
      });

      return true;
    } catch (error) {
      console.error('Contract validation failed:', error);
      return false;
    }
  }

  // Check for pre-deployed wrapped native token
  useEffect(() => {
    async function checkToken() {
      if (!isMounted || !viemChain || !walletEVMAddress) {
        return;
      }

      // If we have a cached token and it's already set locally, no need to check again
      if (cachedWrappedToken && wrappedNativeTokenAddress === cachedWrappedToken) {
        setIsCheckingToken(false);
        return;
      }

      setIsCheckingToken(true);
      try {
        // Cache native currency info if not already cached
        if (!cachedNativeCurrency && viemChain.nativeCurrency) {
          setNativeCurrencyInfo(walletChainId, viemChain.nativeCurrency);
        }

        const publicClient = makePublicClientForChain(viemChain.rpcUrls.default.http[0] || '');
        if (!publicClient) return;

        // Check cache first for wrapped token
        let tokenAddress = cachedWrappedToken || '';

        // Validate cached address if it exists
        if (tokenAddress) {
          const isValid = await validateWrappedTokenContract(tokenAddress, publicClient);
          if (!isValid) {
            console.warn(`Cached wrapped token address ${tokenAddress} is invalid, clearing it`);
            tokenAddress = '';
            setWrappedNativeToken(''); // Clear invalid address from store
          } else {
            setHasPredeployedToken(true);
          }
        }

        // If not in cache or invalid, check other sources
        if (!tokenAddress) {
          if (selectedL1?.wrappedTokenAddress) {
            const isValid = await validateWrappedTokenContract(selectedL1.wrappedTokenAddress, publicClient);
            if (isValid) {
              tokenAddress = selectedL1.wrappedTokenAddress;
              setHasPredeployedToken(true);
            }
          }

          // If still no valid token, check pre-deployed address
          if (!tokenAddress) {
            const isValid = await validateWrappedTokenContract(PREDEPLOYED_WRAPPED_NATIVE_ADDRESS, publicClient);
            setHasPredeployedToken(isValid);

            if (isValid) {
              tokenAddress = PREDEPLOYED_WRAPPED_NATIVE_ADDRESS;
            }
          }
        }

        setLocalWrappedNativeTokenAddress(tokenAddress);

        // If we detected a valid token and nothing in store, save it
        if (tokenAddress && !cachedWrappedToken) {
          setWrappedNativeToken(tokenAddress);
        }
      } catch (error) {
        console.error('Error checking token:', error);
      } finally {
        setIsCheckingToken(false);
      }
    }

    checkToken();
  }, [
    isMounted,
    viemChain,
    walletEVMAddress,
    selectedL1,
    walletChainId,
    cachedWrappedToken,
    cachedNativeCurrency,
    wrappedNativeTokenAddress,
  ]);

  async function handleDeploy() {
    if (!walletClient) {
      setCriticalError(new Error('Connect a wallet first.'));
      return;
    }

    try {
      const result = await deploy({
        abi: WrappedNativeToken.abi as any,
        bytecode: WrappedNativeToken.bytecode.object,
        args: ['WNT'],
        name: 'WrappedNativeToken',
      });

      setWrappedNativeToken(result.contractAddress);
      setLocalWrappedNativeTokenAddress(result.contractAddress);
    } catch (error) {
      setCriticalError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  // Don't render anything until we've finished checking (or during SSR/initial mount)
  if (!isMounted || isCheckingToken) {
    return <Loading className="py-8">Checking for a wrapped native token</Loading>;
  }

  return (
    <ContractDeployViewer contracts={CONTRACT_SOURCES}>
      <div className="not-prose flex flex-col gap-6">
        {/* Token Address Display */}
        {wrappedNativeTokenAddress && (
          <Success label={`Wrapped Native Token Address (${wrappedTokenSymbol})`} value={wrappedNativeTokenAddress} />
        )}

        {/* Deploy Section - Only show if no wrapped token exists */}
        {!wrappedNativeTokenAddress && (
          <div className="flex flex-col gap-4">
            {hasPredeployedToken ? (
              <div className="flex flex-col gap-2 border border-emerald-300 px-4 py-3 dark:border-emerald-900">
                <StatusTag tone="ok">Pre-deployed wrapped token found</StatusTag>
                <HashChip value={PREDEPLOYED_WRAPPED_NATIVE_ADDRESS} len={16} />
                <p className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                  Wraps your L1&apos;s native token: {nativeTokenSymbol} → {wrappedTokenSymbol}
                </p>
              </div>
            ) : (
              <p className={BODY}>No wrapped native token yet. Deploy one to enable wrapping.</p>
            )}

            <Button variant="primary" onClick={handleDeploy} loading={isDeploying} disabled={isDeploying}>
              Deploy Wrapped Native Token
            </Button>
          </div>
        )}

        {/* Independent Tools Section - Only show if wrapped token exists */}
        {wrappedNativeTokenAddress && (
          <div className="space-y-6">
            {/* Balance Display Row */}
            <div className="grid grid-cols-1 gap-px border border-zinc-200 bg-zinc-200 md:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-800">
              <DisplayNativeBalance onError={setCriticalError} />
              <DisplayWrappedBalance wrappedNativeTokenAddress={wrappedNativeTokenAddress} onError={setCriticalError} />
            </div>

            {/* Wrap/Unwrap Tools Row */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <WrapNativeToken wrappedNativeTokenAddress={wrappedNativeTokenAddress} onError={setCriticalError} />
              <UnwrapNativeToken wrappedNativeTokenAddress={wrappedNativeTokenAddress} onError={setCriticalError} />
            </div>
          </div>
        )}
      </div>
    </ContractDeployViewer>
  );
}

export default withConsoleToolMetadata(DeployWrappedNative, metadata);
