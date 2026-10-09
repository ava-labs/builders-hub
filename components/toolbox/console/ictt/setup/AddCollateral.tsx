'use client';

import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useResolvedWalletClient } from '@/components/toolbox/hooks/useResolvedWalletClient';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/components/toolbox/components/Button';
import ExampleERC20ABI from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import { formatUnits, parseUnits, Address, Chain } from 'viem';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import { Input, Suggestion } from '@/components/toolbox/components/Input';
import { EVMAddressInput } from '@/components/toolbox/components/EVMAddressInput';
import { AmountInput } from '@/components/toolbox/components/AmountInput';
import SelectBlockchainId from '@/components/toolbox/components/SelectBlockchainId';
import { CB58ToHex } from '@avalanche-sdk/client/utils';
import { utils } from '@avalabs/avalanchejs';
import ERC20TokenRemoteABI from '@/contracts/icm-contracts/compiled/ERC20TokenRemote.json';
import NativeTokenRemoteABI from '@/contracts/icm-contracts/compiled/NativeTokenRemote.json';
import ERC20TokenHomeABI from '@/contracts/icm-contracts/compiled/ERC20TokenHome.json';
import NativeTokenHomeABI from '@/contracts/icm-contracts/compiled/NativeTokenHome.json';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { useToolboxStore } from '@/components/toolbox/stores/toolboxStore';
import { useL1ByChainId, useSelectedL1, useL1List } from '@/components/toolbox/stores/l1ListStore';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { ConsoleToolMetadata, withConsoleToolMetadata } from '@/components/toolbox/components/WithConsoleToolMetadata';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import versions from '@/scripts/versions.json';
import { ContractFunctionViewer } from '@/components/console/contract-function-viewer';
import { Alert } from '@/components/toolbox/components/Alert';
import { HashChip, SpecPlate, SpecRow } from '@/components/explorer-v2/ui';
import { EYEBROW, Loading, Option, OptionGrid, StatusTag } from '../bridge/ui';

const ICM_COMMIT = versions['ava-labs/icm-services'];

const metadata: ConsoleToolMetadata = {
  title: 'Add Collateral',
  description:
    'Add collateral to the Token Home contract on the source chain for a Native Token Remote bridge contract.',
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function AddCollateral() {
  const [criticalError, setCriticalError] = useState<Error | null>(null);
  const { nativeTokenRemoteAddress } = useToolboxStore();
  const { walletEVMAddress } = useWalletStore();
  const walletClient = useResolvedWalletClient();
  const { notify } = useConsoleNotifications();
  const viemChain = useViemChainStore();
  const selectedL1 = useSelectedL1();
  const l1List = useL1List();

  const [remoteContractAddress, setRemoteContractAddress] = useState<Address | ''>('');
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastApprovalTxId, setLastApprovalTxId] = useState<string>();
  const [lastAddCollateralTxId, setLastAddCollateralTxId] = useState<string>();
  const [localError, setLocalError] = useState('');

  // Info fetched from NativeTokenRemote contract
  const [tokenHomeAddress, setTokenHomeAddress] = useState<Address | null>(null);
  const [tokenHomeBlockchainIDHex, setTokenHomeBlockchainIDHex] = useState<string | null>(null);
  const [sourceChainId, setSourceChainId] = useState<string | null>(null);
  const [tokenType, setTokenType] = useState<'erc20' | 'native' | null>(null);

  // Token info
  const [tokenAddress, setTokenAddress] = useState<Address | null>(null);
  const [tokenDecimals, setTokenDecimals] = useState<number | null>(null);
  const [tokenSymbol, setTokenSymbol] = useState<string | null>(null);
  const [tokenBalance, setTokenBalance] = useState<bigint | null>(null);
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [collateralInfo, setCollateralInfo] = useState<{ needed: bigint; remaining: bigint | null } | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isCollateralized, setIsCollateralized] = useState<boolean | null>(null);
  const [isAutoFilled, setIsAutoFilled] = useState(false);
  const [isFetchingTokenHome, setIsFetchingTokenHome] = useState(false);

  // Auto-fill remote contract address from store
  useEffect(() => {
    if (nativeTokenRemoteAddress && !remoteContractAddress) {
      setRemoteContractAddress(nativeTokenRemoteAddress as Address);
    }
  }, [nativeTokenRemoteAddress]);

  // Throw critical errors during render
  if (criticalError) {
    throw criticalError;
  }

  const sourceL1 = useL1ByChainId(sourceChainId || '');
  const sourceL1ViemChain: Chain | null = useMemo(() => {
    if (!sourceL1) return null;

    return {
      id: sourceL1.evmChainId,
      name: sourceL1.name,
      rpcUrls: {
        default: { http: [sourceL1.rpcUrl] },
      },
      nativeCurrency: {
        name: sourceL1.coinName,
        symbol: sourceL1.coinName,
        decimals: 18,
      },
      isTestnet: sourceL1.isTestnet,
    };
  }, [sourceL1]);

  // Fetch token home info from NativeTokenRemote contract
  const fetchTokenHomeInfo = useCallback(async () => {
    if (!remoteContractAddress || !viemChain) {
      setTokenHomeAddress(null);
      setTokenHomeBlockchainIDHex(null);
      setSourceChainId(null);
      setIsFetchingTokenHome(false);
      return;
    }

    setLocalError('');
    setIsFetchingTokenHome(true);
    try {
      const remotePublicClient = makePublicClientForChain(
        viemChain?.rpcUrls.default.http[0],
        [],
        viemChain ?? undefined,
      );
      if (!remotePublicClient) {
        setLocalError('Could not create public client for remote chain');
        return;
      }

      // Fetch tokenHomeAddress and tokenHomeBlockchainID from NativeTokenRemote
      const [fetchedTokenHomeAddress, fetchedTokenHomeBlockchainID] = await Promise.all([
        remotePublicClient.readContract({
          address: remoteContractAddress as Address,
          abi: NativeTokenRemoteABI.abi,
          functionName: 'getTokenHomeAddress',
        }) as Promise<Address>,
        remotePublicClient.readContract({
          address: remoteContractAddress as Address,
          abi: NativeTokenRemoteABI.abi,
          functionName: 'getTokenHomeBlockchainID',
        }) as Promise<`0x${string}`>,
      ]);

      setTokenHomeAddress(fetchedTokenHomeAddress);
      setTokenHomeBlockchainIDHex(fetchedTokenHomeBlockchainID);

      // Find source chain from blockchain ID
      const blockchainIdBase58 = utils.base58check.encode(Buffer.from(fetchedTokenHomeBlockchainID.slice(2), 'hex'));
      const matchingChain = l1List.find((chain: any) => chain.id === blockchainIdBase58);

      if (matchingChain) {
        setSourceChainId(matchingChain.id);

        // Detect token type by checking storage locations on the TokenHome contract
        const homePublicClient = makePublicClientForChain(matchingChain.rpcUrl);
        if (!homePublicClient) return;

        try {
          // Try to read NATIVE_TOKEN_HOME_STORAGE_LOCATION
          await homePublicClient.readContract({
            address: fetchedTokenHomeAddress,
            abi: NativeTokenHomeABI.abi,
            functionName: 'NATIVE_TOKEN_HOME_STORAGE_LOCATION',
          });
          setTokenType('native');
        } catch {
          try {
            // Try to read ERC20_TOKEN_HOME_STORAGE_LOCATION
            await homePublicClient.readContract({
              address: fetchedTokenHomeAddress,
              abi: ERC20TokenHomeABI.abi,
              functionName: 'ERC20_TOKEN_HOME_STORAGE_LOCATION',
            });
            setTokenType('erc20');
          } catch {
            console.warn('Could not detect token type');
            setTokenType(null);
          }
        }
      } else {
        setLocalError('Could not find source chain for token home');
      }
    } catch (error: any) {
      console.error('Error fetching token home info:', error);
      setLocalError(`Error fetching token home info: ${error.shortMessage || error.message}`);
      setTokenHomeAddress(null);
      setTokenHomeBlockchainIDHex(null);
      setSourceChainId(null);
    } finally {
      setIsFetchingTokenHome(false);
    }
  }, [remoteContractAddress, viemChain, l1List]);

  const fetchStatus = useCallback(async () => {
    if (
      !sourceL1?.rpcUrl ||
      !walletEVMAddress ||
      !remoteContractAddress ||
      !tokenHomeBlockchainIDHex ||
      !tokenHomeAddress ||
      !viemChain ||
      !tokenType
    ) {
      setTokenAddress(null);
      setTokenDecimals(null);
      setTokenSymbol(null);
      setTokenBalance(null);
      setAllowance(null);
      setCollateralInfo(null);
      setIsCollateralized(null);
      return;
    }

    setIsCheckingStatus(true);
    setLocalError('');
    setIsAutoFilled(false);
    try {
      const homePublicClient = makePublicClientForChain(sourceL1.rpcUrl);
      const remotePublicClient = makePublicClientForChain(viemChain.rpcUrls.default.http[0], [], viemChain);
      if (!homePublicClient || !remotePublicClient) {
        setLocalError('Could not create public clients for home or remote chain');
        return;
      }

      // 1. Get Token Address from Home Contract
      const fetchedTokenAddress = (await homePublicClient.readContract({
        address: tokenHomeAddress as Address,
        abi: ERC20TokenHomeABI.abi,
        functionName: 'getTokenAddress',
      })) as Address;
      setTokenAddress(fetchedTokenAddress);

      // 2. Get Token Details, Allowance, and Balance
      const promises = [
        homePublicClient.readContract({
          address: fetchedTokenAddress,
          abi: ExampleERC20ABI.abi,
          functionName: 'decimals',
        }),
        homePublicClient.readContract({
          address: fetchedTokenAddress,
          abi: ExampleERC20ABI.abi,
          functionName: 'symbol',
        }),
        homePublicClient.readContract({
          address: fetchedTokenAddress,
          abi: ExampleERC20ABI.abi,
          functionName: 'allowance',
          args: [walletEVMAddress as Address, tokenHomeAddress as Address],
        }),
      ];

      // Add balance fetching based on token type
      if (tokenType === 'erc20') {
        promises.push(
          homePublicClient.readContract({
            address: fetchedTokenAddress,
            abi: ExampleERC20ABI.abi,
            functionName: 'balanceOf',
            args: [walletEVMAddress as Address],
          }),
        );
      } else if (tokenType === 'native') {
        promises.push(
          homePublicClient.getBalance({
            address: walletEVMAddress as Address,
          }),
        );
      }

      const results = await Promise.all(promises);
      setTokenDecimals(Number(results[0] as bigint));
      setTokenSymbol(results[1] as string);
      setAllowance(results[2] as bigint);
      if (results[3] !== undefined) {
        setTokenBalance(results[3] as bigint);
      }

      // Check if the remote contract is collateralized
      try {
        // First try with getIsCollateralized which is in NativeTokenRemote
        const collateralized = await remotePublicClient.readContract({
          address: remoteContractAddress as Address,
          abi: ERC20TokenRemoteABI.abi,
          functionName: 'getIsCollateralized',
        });

        setIsCollateralized(collateralized as boolean);
      } catch (error) {
        console.error('Failed to check collateralization status:', error);
        setIsCollateralized(null);
        setLocalError('Failed to check collateralization status: ' + (error as Error)?.message);
      }

      // 3. Get Collateral Info - get remote blockchain ID hex from current chain
      if (!selectedL1) throw new Error('No L1 selected');
      const remoteBlockchainIDHex = CB58ToHex(selectedL1.id);
      const settings = (await homePublicClient.readContract({
        address: tokenHomeAddress as Address,
        abi: ERC20TokenHomeABI.abi,
        functionName: 'getRemoteTokenTransferrerSettings',
        args: [remoteBlockchainIDHex as `0x${string}`, remoteContractAddress],
      })) as { registered: boolean; collateralNeeded: bigint; tokenMultiplier: bigint; multiplyOnRemote: boolean };

      let remaining = null;
      if (settings.registered) {
        // For simplicity, we're just showing the needed amount
      }

      setCollateralInfo({ needed: settings.collateralNeeded, remaining });
    } catch (error: any) {
      console.error('Error fetching status:', error);
      setLocalError(`Error fetching status: ${error.shortMessage || error.message}`);
      setTokenAddress(null);
      setTokenDecimals(null);
      setTokenSymbol(null);
      setTokenBalance(null);
      setAllowance(null);
      setCollateralInfo(null);
      setIsCollateralized(null);
    } finally {
      setIsCheckingStatus(false);
    }
  }, [
    sourceL1?.rpcUrl,
    walletEVMAddress,
    remoteContractAddress,
    tokenHomeBlockchainIDHex,
    tokenHomeAddress,
    viemChain,
    selectedL1,
    tokenType,
  ]);

  // Autofill amount when collateral info is loaded
  useEffect(() => {
    if (collateralInfo?.needed && collateralInfo.needed > 0n && tokenDecimals !== null && !isAutoFilled) {
      const neededAmountFormatted = formatUnits(collateralInfo.needed, tokenDecimals);
      setAmount(neededAmountFormatted);
      setIsAutoFilled(true);
    } else if ((!collateralInfo?.needed || collateralInfo.needed === 0n) && isAutoFilled) {
      setIsAutoFilled(false);
    }
  }, [collateralInfo?.needed, tokenDecimals, isAutoFilled]);

  // Fetch token home info when remote contract address changes
  useEffect(() => {
    fetchTokenHomeInfo();
  }, [fetchTokenHomeInfo]);

  // Fetch status when we have all info
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleApprove = async () => {
    if (
      !sourceL1?.rpcUrl ||
      !walletClient?.account ||
      !tokenHomeAddress ||
      !tokenAddress ||
      tokenDecimals === null ||
      !amount ||
      !sourceL1ViemChain
    ) {
      setLocalError('Missing required information for approval.');
      return;
    }

    setLocalError('');
    setIsProcessing(true);
    setLastApprovalTxId(undefined);

    try {
      const publicClient = makePublicClientForChain(sourceL1.rpcUrl);
      if (!publicClient) {
        setLocalError('Could not resolve source chain RPC');
        return;
      }

      const amountParsed = parseUnits(amount, tokenDecimals);

      const { request } = await publicClient.simulateContract({
        address: tokenAddress,
        abi: ExampleERC20ABI.abi,
        functionName: 'approve',
        args: [tokenHomeAddress as Address, amountParsed],
        account: walletClient!.account,
        chain: sourceL1ViemChain,
      });

      const writePromise = walletClient!.writeContract(request);
      notify(
        {
          type: 'call',
          name: 'Approve Tokens',
        },
        writePromise,
        sourceL1ViemChain ?? undefined,
      );
      const hash = await writePromise;
      setLastApprovalTxId(hash);

      await publicClient.waitForTransactionReceipt({ hash });
      await fetchStatus();
    } catch (error: any) {
      console.error('Approval failed:', error);
      setLocalError(`Approval failed: ${error.shortMessage || error.message}`);
      setCriticalError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddCollateral = async () => {
    if (
      !sourceL1?.rpcUrl ||
      !walletClient?.account ||
      !tokenHomeAddress ||
      tokenDecimals === null ||
      !amount ||
      !remoteContractAddress ||
      !selectedL1 ||
      !sourceL1ViemChain ||
      !tokenType
    ) {
      setLocalError('Missing required information to add collateral.');
      return;
    }

    setLocalError('');
    setIsProcessing(true);
    setLastAddCollateralTxId(undefined);

    try {
      const publicClient = makePublicClientForChain(sourceL1.rpcUrl);
      if (!publicClient) {
        setLocalError('Could not resolve source chain RPC');
        return;
      }

      const amountParsed = parseUnits(amount, tokenDecimals);

      // Only check allowance for ERC20 tokens
      if (tokenType === 'erc20' && (allowance === null || allowance < amountParsed)) {
        setLocalError(`Insufficient allowance. Please approve at least ${amount} ${tokenSymbol || 'tokens'}.`);
        setIsProcessing(false);
        return;
      }

      const remoteBlockchainIDHex = CB58ToHex(selectedL1.id);

      // Use appropriate ABI and parameters based on token type
      const tokenHomeABI = tokenType === 'native' ? NativeTokenHomeABI.abi : ERC20TokenHomeABI.abi;

      const simulateParams: any = {
        address: tokenHomeAddress as Address,
        abi: tokenHomeABI,
        functionName: 'addCollateral',
        chain: sourceL1ViemChain,
        account: walletEVMAddress as `0x${string}`,
      };

      // For native tokens, amount is sent as value; for ERC20, as an argument
      if (tokenType === 'native') {
        simulateParams.args = [remoteBlockchainIDHex as `0x${string}`, remoteContractAddress as Address];
        simulateParams.value = amountParsed;
      } else {
        simulateParams.args = [remoteBlockchainIDHex as `0x${string}`, remoteContractAddress as Address, amountParsed];
      }

      const { request } = await publicClient.simulateContract(simulateParams);

      const writePromise = walletClient!.writeContract({
        ...request,
        account: walletEVMAddress as `0x${string}`,
      });
      notify(
        {
          type: 'call',
          name: 'Add Collateral',
        },
        writePromise,
        sourceL1ViemChain ?? undefined,
      );
      const hash = await writePromise;
      setLastAddCollateralTxId(hash);

      await publicClient.waitForTransactionReceipt({ hash });
      await fetchStatus();
    } catch (error: any) {
      console.error('Add Collateral failed:', error);
      setLocalError(`Add Collateral failed: ${error.shortMessage || error.message}`);
      setCriticalError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsProcessing(false);
    }
  };

  const amountParsed = useMemo(() => {
    if (!amount || tokenDecimals === null) return 0n;
    try {
      return parseUnits(amount, tokenDecimals);
    } catch {
      return 0n;
    }
  }, [amount, tokenDecimals]);

  const hasSufficientAllowance = useMemo(() => {
    if (allowance === null || amountParsed === 0n) return false;
    return allowance >= amountParsed;
  }, [allowance, amountParsed]);

  const hasSufficientBalance = useMemo(() => {
    if (tokenBalance === null || amountParsed === 0n) return false;
    return tokenBalance >= amountParsed;
  }, [tokenBalance, amountParsed]);

  const isValidAmount = amountParsed > 0n;

  const remoteContractSuggestions: Suggestion[] = useMemo(() => {
    const suggestions: Suggestion[] = [];
    if (nativeTokenRemoteAddress) {
      suggestions.push({
        title: nativeTokenRemoteAddress,
        value: nativeTokenRemoteAddress,
        description: `Native Token Remote on ${selectedL1?.name}`,
      });
    }
    return suggestions;
  }, [nativeTokenRemoteAddress, selectedL1?.name]);

  return (
    <div className="not-prose grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <EVMAddressInput
          label={`Native Token Remote Contract Address (on ${selectedL1?.name})`}
          value={remoteContractAddress}
          onChange={(value) => setRemoteContractAddress(value as Address)}
          disabled={isProcessing}
          suggestions={remoteContractSuggestions}
          placeholder="0x... (Native Token Remote)"
        />

        {isFetchingTokenHome && (
          <div className="flex flex-col gap-3 border border-zinc-200 px-4 py-4 dark:border-zinc-800">
            <Loading>Loading Token Home details</Loading>
            <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
              Reading the source chain and Token Home address.
            </p>
            <span aria-hidden className="block h-10 w-full animate-pulse bg-zinc-100 dark:bg-zinc-900" />
            <span aria-hidden className="block h-10 w-full animate-pulse bg-zinc-100 dark:bg-zinc-900" />
          </div>
        )}

        {!isFetchingTokenHome && tokenHomeAddress && tokenHomeBlockchainIDHex && sourceL1 && (
          <div className="space-y-3">
            {/* Source Chain */}
            <SelectBlockchainId label="Source Chain" value={sourceL1.id} onChange={() => {}} disabled />

            {/* Token Home Address */}
            <Input
              label="Token Home Address"
              value={tokenHomeAddress}
              onChange={() => {}}
              disabled
              helperText="Fetched from Native Token Remote contract"
            />

            {/* Token Type */}
            {tokenType && (
              <div className="mb-6 flex flex-col gap-2">
                <span className={EYEBROW}>Transferrer type</span>
                <OptionGrid label="Transferrer type">
                  <Option
                    selected={tokenType === 'erc20'}
                    onSelect={() => {}}
                    disabled={tokenType !== 'erc20'}
                    title="ERC20"
                  />
                  <Option
                    selected={tokenType === 'native'}
                    onSelect={() => {}}
                    disabled={tokenType !== 'native'}
                    title="Native token"
                  />
                </OptionGrid>
              </div>
            )}

            {/* Blockchain ID */}
            <Input
              label="Token Home Blockchain ID"
              value={tokenHomeBlockchainIDHex}
              onChange={() => {}}
              disabled
              helperText="Source chain blockchain identifier"
            />
          </div>
        )}

        {tokenAddress && tokenSymbol && tokenDecimals !== null && (
          <SpecPlate className="border border-zinc-200 px-4 dark:border-zinc-800">
            <SpecRow label="Collateral token">
              <span className="font-mono">{tokenSymbol}</span>
            </SpecRow>
            <SpecRow label="Token address">
              <HashChip value={tokenAddress} len={16} />
            </SpecRow>
            <SpecRow label="Decimals">
              <span className="font-mono">{tokenDecimals}</span>
            </SpecRow>
            {tokenBalance !== null && (
              <SpecRow label="Your balance">
                <span className="font-mono">
                  {formatUnits(tokenBalance, tokenDecimals)} {tokenSymbol}
                </span>
              </SpecRow>
            )}
            {allowance !== null && (
              <SpecRow label="Home allowance">
                <span className="font-mono">
                  {formatUnits(allowance, tokenDecimals)} {tokenSymbol}
                </span>
              </SpecRow>
            )}
            {collateralInfo !== null && (
              <SpecRow label="Needed">
                <span className="font-mono">
                  {formatUnits(collateralInfo.needed, tokenDecimals)} {tokenSymbol}
                </span>
              </SpecRow>
            )}
            {isCollateralized !== null && (
              <SpecRow label="Status">
                {isCollateralized ? (
                  <StatusTag tone="ok">Fully collateralized</StatusTag>
                ) : (
                  <StatusTag tone="error">Not collateralized</StatusTag>
                )}
              </SpecRow>
            )}
          </SpecPlate>
        )}

        <AmountInput
          label={`Amount of ${tokenSymbol || 'Tokens'} to Add as Collateral`}
          value={amount}
          onChange={(newAmount) => {
            setAmount(newAmount);
            if (isAutoFilled) {
              const neededFormatted =
                tokenDecimals !== null && collateralInfo?.needed
                  ? formatUnits(collateralInfo.needed, tokenDecimals)
                  : '';
              if (newAmount !== neededFormatted) {
                setIsAutoFilled(false);
              }
            }
          }}
          type="number"
          min="0"
          max={tokenBalance !== null && tokenDecimals !== null ? formatUnits(tokenBalance, tokenDecimals) : '0'}
          step={tokenDecimals !== null ? `0.${'0'.repeat(tokenDecimals - 1)}1` : 'any'}
          required
          disabled={!tokenAddress || isCheckingStatus}
          error={
            !isValidAmount && amount
              ? 'Invalid amount'
              : amount && !hasSufficientBalance
                ? 'Insufficient balance'
                : undefined
          }
          helperText={isAutoFilled ? 'Autofilled with needed collateral' : ''}
          button={
            tokenBalance !== null && tokenDecimals !== null ? (
              <Button
                onClick={() => setAmount(formatUnits(tokenBalance, tokenDecimals))}
                stickLeft
                disabled={!tokenAddress || isCheckingStatus}
              >
                MAX
              </Button>
            ) : undefined
          }
        />

        {localError && <Alert variant="error">{localError}</Alert>}

        <div className="flex flex-col gap-2 border-t border-zinc-200 pt-4 sm:flex-row dark:border-zinc-800">
          {tokenType === 'erc20' && (
            <Button
              onClick={handleApprove}
              loading={isProcessing && !lastApprovalTxId}
              disabled={
                isProcessing ||
                !isValidAmount ||
                !tokenAddress ||
                !hasSufficientBalance ||
                hasSufficientAllowance ||
                isCheckingStatus
              }
              variant={hasSufficientAllowance ? 'secondary' : 'primary'}
            >
              {hasSufficientAllowance
                ? `Approved (${formatUnits(allowance ?? 0n, tokenDecimals ?? 18)} ${tokenSymbol})`
                : `Approve ${amount || 0} ${tokenSymbol || ''}`}
            </Button>
          )}
          <Button
            onClick={handleAddCollateral}
            loading={isProcessing && !lastAddCollateralTxId && (tokenType === 'native' || !!lastApprovalTxId)}
            disabled={
              isProcessing ||
              !isValidAmount ||
              !tokenAddress ||
              !hasSufficientBalance ||
              (tokenType === 'erc20' && !hasSufficientAllowance) ||
              isCheckingStatus ||
              collateralInfo === null
            }
            variant={isCollateralized ? 'secondary' : 'primary'}
          >
            {isCollateralized ? 'Add More Collateral' : 'Add Collateral'}
          </Button>
          <Button
            onClick={fetchStatus}
            disabled={isCheckingStatus || !remoteContractAddress || !sourceChainId}
            variant="outline"
            loading={isCheckingStatus}
          >
            Refresh Status
          </Button>
        </div>
      </div>

      <ContractFunctionViewer
        sources={[
          {
            filename: 'ERC20TokenHome.sol',
            sourceUrl: `https://raw.githubusercontent.com/ava-labs/icm-services/${ICM_COMMIT}/contracts/ictt/TokenHome/ERC20TokenHome.sol`,
            githubUrl: `https://github.com/ava-labs/icm-services/blob/${ICM_COMMIT}/contracts/ictt/TokenHome/ERC20TokenHome.sol`,
            highlightFunction: 'addCollateral',
          },
          {
            filename: 'NativeTokenHome.sol',
            sourceUrl: `https://raw.githubusercontent.com/ava-labs/icm-services/${ICM_COMMIT}/contracts/ictt/TokenHome/NativeTokenHome.sol`,
            githubUrl: `https://github.com/ava-labs/icm-services/blob/${ICM_COMMIT}/contracts/ictt/TokenHome/NativeTokenHome.sol`,
            highlightFunction: 'addCollateral',
          },
        ]}
        showFunctionOnly={true}
        description="Adds collateral tokens to back the remote bridge's initial reserve imbalance"
      />
    </div>
  );
}

export default withConsoleToolMetadata(AddCollateral, metadata);
