'use client';

import ERC20TokenHome from '@/contracts/icm-contracts/compiled/ERC20TokenHome.json';
import NativeTokenHome from '@/contracts/icm-contracts/compiled/NativeTokenHome.json';
import { useToolboxStore, useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { useWrappedNativeToken } from '@/components/toolbox/stores/l1ListStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/toolbox/components/Button';
import { Success } from '@/components/toolbox/components/Success';
import { Input, Suggestion } from '@/components/toolbox/components/Input';
import { EVMAddressInput } from '@/components/toolbox/components/EVMAddressInput';
import ExampleERC20 from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import { Alert } from '@/components/toolbox/components/Alert';
import { OptionGrid, Option, EYEBROW, BODY } from '../bridge/ui';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import TeleporterRegistryAddressInput from '@/components/toolbox/components/TeleporterRegistryAddressInput';
import { useSelectedL1 } from '@/components/toolbox/stores/l1ListStore';
import { ConsoleToolMetadata, withConsoleToolMetadata } from '@/components/toolbox/components/WithConsoleToolMetadata';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { useContractDeployer } from '@/components/toolbox/hooks/contracts';
import { useResolvedWalletClient } from '@/components/toolbox/hooks/useResolvedWalletClient';
import versions from '@/scripts/versions.json';
import { ContractDeployViewer, type ContractSource } from '@/components/console/contract-deploy-viewer';

const ICM_COMMIT = versions['ava-labs/icm-services'];

const CONTRACT_SOURCES: ContractSource[] = [
  {
    name: 'ERC20TokenHome',
    filename: 'ERC20TokenHome.sol',
    url: `https://raw.githubusercontent.com/ava-labs/icm-services/${ICM_COMMIT}/contracts/ictt/TokenHome/ERC20TokenHome.sol`,
    description: 'Home chain endpoint for ERC20 cross-chain transfers via ICTT.',
  },
  {
    name: 'NativeTokenHome',
    filename: 'NativeTokenHome.sol',
    url: `https://raw.githubusercontent.com/ava-labs/icm-services/${ICM_COMMIT}/contracts/ictt/TokenHome/NativeTokenHome.sol`,
    description: 'Home chain endpoint for native token cross-chain transfers via ICTT.',
  },
];

const metadata: ConsoleToolMetadata = {
  title: 'Deploy Token Home Contract',
  description: 'Deploy the TokenHome contract for your token.',
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function DeployTokenHome() {
  const [criticalError, setCriticalError] = useState<Error | null>(null);
  const {
    exampleErc20Address,
    setErc20TokenHomeAddress,
    erc20TokenHomeAddress,
    setNativeTokenHomeAddress,
    nativeTokenHomeAddress,
  } = useToolboxStore();
  const wrappedNativeTokenAddress = useWrappedNativeToken();
  const selectedL1 = useSelectedL1();
  const { walletEVMAddress, walletChainId } = useWalletStore();
  const walletClient = useResolvedWalletClient();
  const viemChain = useViemChainStore();
  const { deploy, isDeploying } = useContractDeployer();
  const [teleporterManager, setTeleporterManager] = useState('');
  const [minTeleporterVersion, setMinTeleporterVersion] = useState('1');
  const [tokenAddress, setTokenAddress] = useState('');
  const [tokenDecimals, setTokenDecimals] = useState('0');
  const [localError, setLocalError] = useState('');
  const [deployError, setDeployError] = useState('');
  const [teleporterRegistryAddress, setTeleporterRegistryAddress] = useState(''); //local, not in store
  const [tokenType, setTokenType] = useState<'erc20' | 'native'>('erc20');

  // Throw critical errors during render
  if (criticalError) {
    throw criticalError;
  }

  // Build token suggestions based on current chain
  const tokenSuggestions: Suggestion[] = useMemo(() => {
    const suggestions: Suggestion[] = [];

    // Add deployed example ERC20 if available
    if (exampleErc20Address && tokenType === 'erc20') {
      suggestions.push({
        title: exampleErc20Address,
        value: exampleErc20Address,
        description: 'Your deployed Example ERC20 token',
      });
    }

    // Add wrapped native token for native type
    if (tokenType === 'native' && (wrappedNativeTokenAddress || selectedL1?.wrappedTokenAddress)) {
      const wrappedAddr = wrappedNativeTokenAddress || selectedL1?.wrappedTokenAddress;
      if (wrappedAddr) {
        suggestions.push({
          title: wrappedAddr,
          value: wrappedAddr,
          description: `Wrapped ${selectedL1?.coinName || 'Native'} Token`,
        });
      }
    }

    return suggestions;
  }, [exampleErc20Address, tokenType, walletChainId, wrappedNativeTokenAddress, selectedL1]);

  useEffect(() => {
    const tokenAddress =
      tokenType === 'erc20' ? exampleErc20Address : wrappedNativeTokenAddress || selectedL1?.wrappedTokenAddress;
    setTokenAddress(tokenAddress ?? '');
  }, [tokenType, selectedL1, exampleErc20Address]);

  const [initTeleporterManagerRan, setInitTeleporterManagerRan] = useState(false);
  useEffect(() => {
    if (!teleporterManager && walletEVMAddress && !initTeleporterManagerRan) {
      setTeleporterManager(walletEVMAddress);
      setInitTeleporterManagerRan(true);
    }
  }, [walletEVMAddress, teleporterManager, initTeleporterManagerRan]);

  useEffect(() => {
    if (!tokenAddress) return;
    if (!viemChain) return;

    setLocalError('');
    const publicClient = makePublicClientForChain(viemChain.rpcUrls.default.http[0], [], viemChain);
    if (!publicClient) return;
    publicClient
      .readContract({
        address: tokenAddress as `0x${string}`,
        abi: ExampleERC20.abi,
        functionName: 'decimals',
      })
      .then((res) => {
        setTokenDecimals((res as bigint).toString());
      })
      .catch((error) => {
        setLocalError('Failed to fetch token decimals: ' + error);
      });
  }, [tokenAddress, viemChain?.id]);

  async function handleDeploy() {
    if (!walletClient) {
      setCriticalError(new Error('Wallet not connected'));
      return;
    }

    setDeployError('');
    if (!teleporterRegistryAddress) {
      setDeployError('Teleporter Registry address is required. Please deploy it first.');
      return;
    }

    if (!tokenAddress) {
      setDeployError('Token address is required. Please deploy an ERC20 token first.');
      return;
    }

    if (!viemChain) {
      throw new Error('Failed to fetch chain. Please try again.');
    }

    try {
      const args = [
        teleporterRegistryAddress as `0x${string}`,
        teleporterManager || walletEVMAddress,
        BigInt(minTeleporterVersion),
        tokenAddress as `0x${string}`,
      ];

      if (tokenType === 'erc20') {
        args.push(BigInt(tokenDecimals));
      }

      const result = await deploy({
        abi: (tokenType === 'erc20' ? ERC20TokenHome.abi : NativeTokenHome.abi) as any,
        bytecode: tokenType === 'erc20' ? ERC20TokenHome.bytecode.object : NativeTokenHome.bytecode.object,
        args,
        name: 'TokenHome',
      });

      if (tokenType === 'erc20') {
        setErc20TokenHomeAddress(result.contractAddress);
      } else {
        setNativeTokenHomeAddress(result.contractAddress);
      }
    } catch (error) {
      setCriticalError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  const getTokenHomeAddress = () => {
    if (tokenType === 'erc20') {
      return erc20TokenHomeAddress;
    } else {
      return nativeTokenHomeAddress;
    }
  };

  return (
    <ContractDeployViewer contracts={CONTRACT_SOURCES}>
      <div className="not-prose flex flex-col gap-4">
        <p className={BODY}>
          Deploys a TokenHome contract on the connected network (chain ID{' '}
          <code className="font-mono text-zinc-900 dark:text-zinc-100">{walletChainId}</code>). It is the home end of
          every cross-chain transfer for this token.
        </p>

        {localError && <Alert variant="error">{localError}</Alert>}
        {deployError && <Alert variant="error">{deployError}</Alert>}

        <TeleporterRegistryAddressInput
          value={teleporterRegistryAddress}
          onChange={setTeleporterRegistryAddress}
          disabled={isDeploying}
        />

        {!teleporterRegistryAddress && (
          <Alert variant="warning">
            <a
              href="#teleporterRegistry"
              className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 transition-colors hover:decoration-zinc-900 dark:text-zinc-100 dark:decoration-zinc-600 dark:hover:decoration-zinc-100"
            >
              Deploy the Teleporter Registry contract first
            </a>
            .
          </Alert>
        )}

        <EVMAddressInput
          label="L1 Teleporter Manager Address"
          value={teleporterManager}
          onChange={setTeleporterManager}
          disabled={isDeploying}
        />

        <Input
          label="Min Teleporter Version"
          value={minTeleporterVersion}
          onChange={setMinTeleporterVersion}
          type="number"
          required
        />

        <div className="mb-6 flex flex-col gap-2">
          <span className={EYEBROW}>Transferrer type</span>
          <OptionGrid label="Transferrer type">
            <Option
              selected={tokenType === 'erc20'}
              onSelect={() => setTokenType('erc20')}
              title="ERC20"
              description="Bridges an ERC-20 token."
            />
            <Option
              selected={tokenType === 'native'}
              onSelect={() => setTokenType('native')}
              title="Native token"
              description="Bridges the chain's native coin through its wrapped token."
            />
          </OptionGrid>
        </div>

        <EVMAddressInput
          label={tokenType === 'erc20' ? 'Token Address' : 'Wrapped Token Address'}
          value={tokenAddress}
          onChange={setTokenAddress}
          disabled={isDeploying}
          suggestions={tokenSuggestions}
          helperText={
            tokenType === 'erc20'
              ? 'Enter the address of the ERC20 token to bridge, or deploy one in the previous step.'
              : 'Enter the wrapped token address of your native token.'
          }
        />

        <Input
          label="Token Decimals"
          value={tokenDecimals}
          onChange={setTokenDecimals}
          type="number"
          disabled
          helperText="This is automatically fetched from the token contract."
        />

        <Success label="Token Home Address" value={getTokenHomeAddress() || ''} />

        <Button
          variant={getTokenHomeAddress() ? 'secondary' : 'primary'}
          onClick={handleDeploy}
          loading={isDeploying}
          disabled={!teleporterRegistryAddress || !tokenAddress || tokenDecimals === '0'}
        >
          {getTokenHomeAddress() ? 'Re-Deploy Token Home' : 'Deploy Token Home'}
        </Button>
      </div>
    </ContractDeployViewer>
  );
}

export default withConsoleToolMetadata(DeployTokenHome, metadata);
