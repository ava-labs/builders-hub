'use client';

import { useL1ByChainId, useSelectedL1 } from '@/components/toolbox/stores/l1ListStore';
import { useToolboxStore, useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/components/toolbox/components/Button';
import ERC20TokenRemoteABI from '@/contracts/icm-contracts/compiled/ERC20TokenRemote.json';
import ERC20TokenHomeABI from '@/contracts/icm-contracts/compiled/ERC20TokenHome.json';
import { Abi, PublicClient, zeroAddress } from 'viem';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import { Suggestion } from '@/components/toolbox/components/Input';
import { EVMAddressInput } from '@/components/toolbox/components/EVMAddressInput';
import { ListContractEvents } from '@/components/toolbox/components/ListContractEvents';
import { CB58ToHex } from '@avalanche-sdk/client/utils';
import SelectBlockchainId from '@/components/toolbox/components/SelectBlockchainId';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { useResolvedWalletClient } from '@/components/toolbox/hooks/useResolvedWalletClient';
import { ConsoleToolMetadata, withConsoleToolMetadata } from '@/components/toolbox/components/WithConsoleToolMetadata';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import versions from '@/scripts/versions.json';
import { ContractFunctionViewer } from '@/components/console/contract-function-viewer';
import { RefreshCw } from 'lucide-react';
import { Alert } from '@/components/toolbox/components/Alert';
import { BODY, Loading, TextAction } from '../bridge/ui';

const ICM_COMMIT = versions['ava-labs/icm-services'];

const metadata: ConsoleToolMetadata = {
  title: 'Register Remote Contract with Home',
  description: 'Register the remote contract with the home contract.',
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function RegisterWithHome() {
  const [criticalError, setCriticalError] = useState<Error | null>(null);
  const { erc20TokenRemoteAddress, nativeTokenRemoteAddress } = useToolboxStore();
  const [remoteAddress, setRemoteAddress] = useState('');
  const walletClient = useResolvedWalletClient();
  const { notify } = useConsoleNotifications();
  const viemChain = useViemChainStore();
  const selectedL1 = useSelectedL1();
  const [sourceChainId, setSourceChainId] = useState<string>('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [_lastTxId, setLastTxId] = useState<string>();
  const [localError, setLocalError] = useState('');
  const [homeContractAddress, setHomeContractAddress] = useState<string | null>(null);
  const [homeContractClient, setHomeContractClient] = useState<PublicClient | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isCheckingRegistration, setIsCheckingRegistration] = useState(false);

  // Auto-fill remote address from store when exactly one is available
  useEffect(() => {
    if (remoteAddress) return;
    if (erc20TokenRemoteAddress && !nativeTokenRemoteAddress) {
      setRemoteAddress(erc20TokenRemoteAddress);
    } else if (nativeTokenRemoteAddress && !erc20TokenRemoteAddress) {
      setRemoteAddress(nativeTokenRemoteAddress);
    }
  }, [erc20TokenRemoteAddress, nativeTokenRemoteAddress]);

  // Throw critical errors during render
  if (criticalError) {
    throw criticalError;
  }

  const sourceL1 = useL1ByChainId(sourceChainId);

  let sourceChainError: string | undefined = undefined;
  if (!sourceChainId) {
    sourceChainError = 'Please select a source chain';
  } else if (selectedL1?.id === sourceChainId) {
    sourceChainError = 'Source and destination chains must be different';
  }

  // Move fetchSettings outside useEffect and wrap in useCallback for stable reference
  const fetchSettings = useCallback(async () => {
    if (isCheckingRegistration || !remoteAddress || !sourceChainId) return;
    setIsCheckingRegistration(true);
    try {
      if (!viemChain || !sourceL1?.rpcUrl || !selectedL1?.id) return;

      const remotePublicClient = makePublicClientForChain(viemChain.rpcUrls.default.http[0], [], viemChain);
      const homePublicClient = makePublicClientForChain(sourceL1.rpcUrl);
      if (!remotePublicClient || !homePublicClient) return;

      setHomeContractClient(homePublicClient);

      const tokenHomeAddress = await remotePublicClient.readContract({
        address: remoteAddress as `0x${string}`,
        abi: ERC20TokenRemoteABI.abi,
        functionName: 'getTokenHomeAddress',
      });

      setHomeContractAddress(tokenHomeAddress as string);

      // Convert CURRENT chain ID to hex for the contract call
      // This is where the remote contract is deployed
      const remoteBlockchainIDHex = CB58ToHex(selectedL1.id);

      const remoteSettings = (await homePublicClient.readContract({
        address: tokenHomeAddress as `0x${string}`,
        abi: ERC20TokenHomeABI.abi,
        functionName: 'getRemoteTokenTransferrerSettings',
        args: [remoteBlockchainIDHex, remoteAddress],
      })) as {
        registered: boolean;
        collateralNeeded: bigint;
        tokenMultiplier: bigint;
        multiplyOnRemote: boolean;
      };

      setIsRegistered(remoteSettings.registered);
    } catch (error: any) {
      console.error('Error fetching token home address:', error);
      setLocalError(`Error fetching token home address: ${error.shortMessage || error.message}`);
      setHomeContractAddress(null);
    } finally {
      setIsCheckingRegistration(false);
    }
  }, [remoteAddress, sourceChainId, viemChain?.id, sourceL1?.rpcUrl, selectedL1?.id]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function handleRegister() {
    setLocalError('');

    if (!walletClient || !walletClient.account) {
      setLocalError('Connect a wallet first.');
      return;
    }

    if (!remoteAddress) {
      setLocalError('Please enter a valid remote contract address');
      return;
    }

    if (!viemChain) {
      setLocalError('Current chain configuration is missing');
      return;
    }

    setIsRegistering(true);
    setLastTxId(undefined);

    try {
      const publicClient = makePublicClientForChain(viemChain.rpcUrls.default.http[0], [], viemChain);
      if (!publicClient) {
        throw new Error('Could not create public client for selected chain');
      }

      const feeInfo: readonly [`0x${string}`, bigint] = [zeroAddress, 0n]; // feeTokenAddress, amount

      // Simulate the transaction first
      const { request } = await publicClient.simulateContract({
        address: remoteAddress as `0x${string}`,
        abi: ERC20TokenRemoteABI.abi,
        functionName: 'registerWithHome',
        args: [feeInfo],
        chain: viemChain,
        account: walletClient!.account,
      });

      // Send the transaction
      const writePromise = walletClient!.writeContract(request);
      notify(
        {
          type: 'call',
          name: 'Register With Home',
        },
        writePromise,
        viemChain ?? undefined,
      );
      const hash = await writePromise;
      setLastTxId(hash);

      // Wait for confirmation
      await publicClient.waitForTransactionReceipt({ hash });
      setLocalError('');
    } catch (error: any) {
      console.error('Registration failed:', error);
      setLocalError(`Registration failed: ${error.shortMessage || error.message}`);
      setCriticalError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsRegistering(false);
    }
  }

  const remoteAddressSuggestions: Suggestion[] = useMemo(() => {
    const result: Suggestion[] = [];
    if (erc20TokenRemoteAddress) {
      result.push({
        title: erc20TokenRemoteAddress,
        value: erc20TokenRemoteAddress,
        description: 'ERC20 Token Remote Address',
      });
    }
    if (nativeTokenRemoteAddress) {
      result.push({
        title: nativeTokenRemoteAddress,
        value: nativeTokenRemoteAddress,
        description: 'Native Token Remote Address',
      });
    }
    return result;
  }, [erc20TokenRemoteAddress, nativeTokenRemoteAddress]);

  return (
    <div className="not-prose grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <p className={BODY}>
          Calls <code className="font-mono text-[12px] text-zinc-900 dark:text-zinc-100">registerWithHome</code> on the
          remote contract on the current chain ({selectedL1?.name}). That links the remote bridge back to the home
          bridge on the source chain.
        </p>

        <SelectBlockchainId
          label="Source Chain (where token home is deployed)"
          value={sourceChainId}
          onChange={(value) => setSourceChainId(value)}
          error={sourceChainError}
        />

        <EVMAddressInput
          label={`Remote Contract Address (on ${selectedL1?.name})`}
          value={remoteAddress}
          onChange={setRemoteAddress}
          disabled={isRegistering}
          suggestions={remoteAddressSuggestions}
          helperText={!remoteAddress ? 'Please enter a remote contract address' : undefined}
        />

        {localError && <Alert variant="error">{localError}</Alert>}

        <Button
          variant="primary"
          onClick={handleRegister}
          loading={isRegistering}
          disabled={
            isRegistering ||
            !remoteAddress ||
            !sourceChainId ||
            !!sourceChainError ||
            isRegistered ||
            isCheckingRegistration
          }
        >
          Register Remote with Home
        </Button>

        {isCheckingRegistration && <Loading>Checking registration status</Loading>}

        {!isCheckingRegistration && isRegistered && (
          <Alert variant="success">The remote contract is registered with the Home contract.</Alert>
        )}

        {!isCheckingRegistration && !isRegistered && sourceChainId && remoteAddress && (
          <Alert variant="warning">
            <div className="flex flex-col items-start gap-2">
              <span>
                The remote contract isn&apos;t registered with the Home contract yet. The ICM message takes a few
                seconds to process.
              </span>
              <TextAction icon={RefreshCw} onClick={fetchSettings} disabled={isCheckingRegistration}>
                Refresh
              </TextAction>
            </div>
          </Alert>
        )}

        {homeContractAddress && homeContractClient && (
          <div className="mt-6 border-t border-zinc-200 pt-6 dark:border-zinc-800">
            <ListContractEvents
              contractAddress={homeContractAddress}
              contractABI={ERC20TokenHomeABI.abi as Abi}
              publicClient={homeContractClient}
              title={`Events from Home Contract (on ${sourceL1?.name})`}
            />
          </div>
        )}
      </div>

      <ContractFunctionViewer
        sources={[
          {
            filename: 'ERC20TokenRemote.sol',
            sourceUrl: `https://raw.githubusercontent.com/ava-labs/icm-services/${ICM_COMMIT}/contracts/ictt/TokenRemote/ERC20TokenRemote.sol`,
            githubUrl: `https://github.com/ava-labs/icm-services/blob/${ICM_COMMIT}/contracts/ictt/TokenRemote/ERC20TokenRemote.sol`,
            highlightFunction: 'registerWithHome',
          },
          {
            filename: 'TokenRemote.sol',
            sourceUrl: `https://raw.githubusercontent.com/ava-labs/icm-services/${ICM_COMMIT}/contracts/ictt/TokenRemote/TokenRemote.sol`,
            githubUrl: `https://github.com/ava-labs/icm-services/blob/${ICM_COMMIT}/contracts/ictt/TokenRemote/TokenRemote.sol`,
            highlightFunction: 'registerWithHome',
          },
        ]}
        showFunctionOnly={true}
        description="Sends an ICM message to register the remote contract with the home bridge"
      />
    </div>
  );
}

export default withConsoleToolMetadata(RegisterWithHome, metadata);
