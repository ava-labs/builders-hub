"use client";

import WrappedNativeToken from "@/contracts/icm-contracts/compiled/WrappedNativeToken.json";
import { useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import {
  useWrappedNativeToken,
  useSetWrappedNativeToken,
} from "@/components/toolbox/stores/l1ListStore";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import {
  useNativeCurrencyInfo,
  useSetNativeCurrencyInfo,
} from "@/components/toolbox/stores/l1ListStore";
import { useState, useEffect } from "react";
import { Button } from "@/components/toolbox/components/Button";
import { Success } from "@/components/toolbox/components/Success";
import { http, createPublicClient } from "viem";
import { useSelectedL1 } from "@/components/toolbox/stores/l1ListStore";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import WrapNativeToken from "./wrappedNativeToken/WrapNativeToken";
import UnwrapNativeToken from "./wrappedNativeToken/UnwrapNativeToken";
import DisplayNativeBalance from "./wrappedNativeToken/DisplayNativeBalance";
import DisplayWrappedBalance from "./wrappedNativeToken/DisplayWrappedBalance";
import {
  BaseConsoleToolProps,
  ConsoleToolMetadata,
  withConsoleToolMetadata,
} from "../../../components/WithConsoleToolMetadata";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";

// Pre-deployed wrapped native token address (from genesis)
// This is the standard address used in the pre-installed contracts section
const PREDEPLOYED_WRAPPED_NATIVE_ADDRESS = "0x1111111111111111111111111111111111111111";

const metadata: ConsoleToolMetadata = {
  title: "Wrapped Native Token",
  description:
    "Deploy a wrapped native token or use the pre-deployed one to wrap/unwrap native tokens.",
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function DeployWrappedNative({ onSuccess }: BaseConsoleToolProps) {
  const [criticalError, setCriticalError] = useState<Error | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const setWrappedNativeToken = useSetWrappedNativeToken();
  const selectedL1 = useSelectedL1()();

  // Get cached values from wallet store
  const cachedWrappedToken = useWrappedNativeToken();
  const cachedNativeCurrency = useNativeCurrencyInfo();

  // Initialize with cached value to prevent flickering
  const [wrappedNativeTokenAddress, setLocalWrappedNativeTokenAddress] = useState<string>(
    cachedWrappedToken || ""
  );
  const [hasPredeployedToken, setHasPredeployedToken] = useState(!!cachedWrappedToken);
  const [isCheckingToken, setIsCheckingToken] = useState(!cachedWrappedToken);
  const { coreWalletClient, walletEVMAddress, walletChainId } = useWalletStore();
  const setNativeCurrencyInfo = useSetNativeCurrencyInfo();
  const { notify } = useConsoleNotifications();
  const viemChain = useViemChainStore();
  const [isDeploying, setIsDeploying] = useState(false);

  // Get native token symbol (use cached value if available)
  const nativeTokenSymbol =
    cachedNativeCurrency?.symbol ||
    viemChain?.nativeCurrency?.symbol ||
    selectedL1?.coinName ||
    "COIN";
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
  async function validateWrappedTokenContract(
    address: string,
    publicClient: any
  ): Promise<boolean> {
    try {
      // Check if contract has bytecode
      const code = await publicClient.getBytecode({ address: address as `0x${string}` });
      if (!code || code === "0x") {
        return false;
      }

      // Try to call balanceOf to verify it's a valid ERC20-like contract
      // We use a test address to avoid issues with undefined walletEVMAddress
      await publicClient.readContract({
        address: address as `0x${string}`,
        abi: WrappedNativeToken.abi,
        functionName: "balanceOf",
        args: ["0x0000000000000000000000000000000000000000"],
      });

      return true;
    } catch (error) {
      console.error("Contract validation failed:", error);
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
        const chainIdStr = walletChainId.toString();

        // Cache native currency info if not already cached
        if (!cachedNativeCurrency && viemChain.nativeCurrency) {
          setNativeCurrencyInfo(walletChainId, viemChain.nativeCurrency);
        }

        const publicClient = createPublicClient({
          transport: http(viemChain.rpcUrls.default.http[0] || ""),
        });

        // Check cache first for wrapped token
        let tokenAddress = cachedWrappedToken || "";

        // Validate cached address if it exists
        if (tokenAddress) {
          const isValid = await validateWrappedTokenContract(tokenAddress, publicClient);
          if (!isValid) {
            console.warn(`Cached wrapped token address ${tokenAddress} is invalid, clearing it`);
            tokenAddress = "";
            setWrappedNativeToken(""); // Clear invalid address from store
          } else {
            setHasPredeployedToken(true);
          }
        }

        // If not in cache or invalid, check other sources
        if (!tokenAddress) {
          if (selectedL1?.wrappedTokenAddress) {
            const isValid = await validateWrappedTokenContract(
              selectedL1.wrappedTokenAddress,
              publicClient
            );
            if (isValid) {
              tokenAddress = selectedL1.wrappedTokenAddress;
              setHasPredeployedToken(true);
            }
          }

          // If still no valid token, check pre-deployed address
          if (!tokenAddress) {
            const isValid = await validateWrappedTokenContract(
              PREDEPLOYED_WRAPPED_NATIVE_ADDRESS,
              publicClient
            );
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
        console.error("Error checking token:", error);
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
    if (!coreWalletClient) {
      setCriticalError(new Error("Core wallet not found"));
      return;
    }

    setIsDeploying(true);
    try {
      if (!viemChain) throw new Error("No chain selected");

      const publicClient = createPublicClient({
        transport: http(viemChain.rpcUrls.default.http[0] || ""),
      });

      const deployPromise = coreWalletClient.deployContract({
        abi: WrappedNativeToken.abi as any,
        bytecode: WrappedNativeToken.bytecode.object as `0x${string}`,
        args: ["WNT"],
        chain: viemChain,
        account: walletEVMAddress as `0x${string}`,
      });

      notify(
        {
          type: "deploy",
          name: "WrappedNativeToken",
        },
        deployPromise,
        viemChain ?? undefined
      );

      const receipt = await publicClient.waitForTransactionReceipt({ hash: await deployPromise });

      if (!receipt.contractAddress) {
        throw new Error("No contract address in receipt");
      }

      setWrappedNativeToken(receipt.contractAddress);
      setLocalWrappedNativeTokenAddress(receipt.contractAddress);
    } catch (error) {
      setCriticalError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsDeploying(false);
    }
  }

  // Don't render anything until we've finished checking (or during SSR/initial mount)
  if (!isMounted || isCheckingToken) {
    return (
      <div className="text-center py-8 text-zinc-500">Checking for wrapped native token...</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Token Address Display */}
      {wrappedNativeTokenAddress && (
        <Success
          label={`Wrapped Native Token Address (${wrappedTokenSymbol})`}
          value={wrappedNativeTokenAddress}
        />
      )}

      {/* Deploy Section - Only show if no wrapped token exists */}
      {!wrappedNativeTokenAddress && (
        <div className="space-y-4">
          <div>
            {hasPredeployedToken ? (
              <div className="space-y-2">
                <p className="text-sm text-green-600 dark:text-green-400">
                  ✓ Pre-deployed wrapped native token detected at{" "}
                  {PREDEPLOYED_WRAPPED_NATIVE_ADDRESS}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  This token wraps your L1's native token ({nativeTokenSymbol} →{" "}
                  {wrappedTokenSymbol})
                </p>
              </div>
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                No wrapped native token found. Deploy one to enable wrapping functionality.
              </p>
            )}
          </div>

          <Button
            variant="primary"
            onClick={handleDeploy}
            loading={isDeploying}
            disabled={isDeploying}
          >
            Deploy Wrapped Native Token
          </Button>
        </div>
      )}

      {/* Independent Tools Section - Only show if wrapped token exists */}
      {wrappedNativeTokenAddress && (
        <div className="space-y-6">
          {/* Balance Display Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DisplayNativeBalance onError={setCriticalError} />
            <DisplayWrappedBalance
              wrappedNativeTokenAddress={wrappedNativeTokenAddress}
              onError={setCriticalError}
            />
          </div>

          {/* Wrap/Unwrap Tools Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <WrapNativeToken
              wrappedNativeTokenAddress={wrappedNativeTokenAddress}
              onError={setCriticalError}
            />
            <UnwrapNativeToken
              wrappedNativeTokenAddress={wrappedNativeTokenAddress}
              onError={setCriticalError}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default withConsoleToolMetadata(DeployWrappedNative, metadata);
