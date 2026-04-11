'use client';

import { useState, useEffect } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import { useToolboxStore, useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { Button } from '@/components/toolbox/components/Button';
import { EVMAddressInput } from '@/components/toolbox/components/EVMAddressInput';
import { Input } from '@/components/toolbox/components/Input';
import SelectSubnetId from '@/components/toolbox/components/SelectSubnetId';
import {
  ConsoleToolMetadata,
  withConsoleToolMetadata,
  BaseConsoleToolProps,
} from '../../../components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { useSelectedL1 } from '@/components/toolbox/stores/l1ListStore';
import { useVMCAddress } from '@/components/toolbox/hooks/useVMCAddress';
import NativeTokenStakingManager from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json';
import ERC20TokenStakingManager from '@/contracts/icm-contracts/compiled/ERC20TokenStakingManager.json';
import { parseEther } from 'viem';
import { useResolvedWalletClient } from '@/components/toolbox/hooks/useResolvedWalletClient';
import versions from '@/scripts/versions.json';
import { cb58ToHex } from '@/components/toolbox/console/utilities/format-converter/FormatConverter';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { useCriticalError } from '@/components/toolbox/hooks/useCriticalError';
import { StakingParametersForm } from '@/components/toolbox/components/StakingParametersForm';
import { StepCodeViewer, type StepConfig } from '@/components/console/step-code-viewer';
import { StepFlowCard } from '@/components/toolbox/components/StepCard';
import { Check, RefreshCw, AlertCircle } from 'lucide-react';

const ICM_COMMIT = versions['ava-labs/icm-contracts'];

type StakingType = 'native' | 'erc20';

const metadata: ConsoleToolMetadata = {
  title: 'Initialize Staking Manager',
  description: 'Initialize the Native or ERC20 Token Staking Manager contract with the required configuration.',
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

const getCodeSteps = (params: {
  stakingManagerAddress: string;
  validatorManagerAddress: string;
  rewardCalculatorAddress: string;
  blockchainId: string;
  minimumStakeAmount: string;
  maximumStakeAmount: string;
  minimumStakeDuration: string;
  minimumDelegationFeeBips: string;
  maximumStakeMultiplier: string;
  weightToValueFactor: string;
  isErc20: boolean;
}): StepConfig[] => [
  {
    id: 'verify-contracts',
    title: 'Verify Contract Addresses',
    description: 'Check deployment and initialization status',
    codeType: 'typescript',
    filename: 'verify-deployment.ts',
    code: `import { createPublicClient, http } from "viem";
import { avalancheFuji } from "viem/chains";

const publicClient = createPublicClient({
  chain: avalancheFuji,
  transport: http()
});

// Verify staking manager is deployed
const bytecode = await publicClient.getBytecode({
  address: "${params.stakingManagerAddress || '0x...'}"});

if (!bytecode) {
  throw new Error("No contract found at address");
}

// Check if already initialized
const settings = await publicClient.readContract({
  address: "${params.stakingManagerAddress || '0x...'}" as \`0x\${string}\`,
  abi: ${params.isErc20 ? 'ERC20TokenStakingManagerABI' : 'NativeTokenStakingManagerABI'},
  functionName: "getStakingManagerSettings",
});

console.log("Initialized:", BigInt(settings.minimumStakeAmount) > 0n);`,
  },
  {
    id: 'initialize',
    title: 'Initialize Staking Manager',
    description: 'Call initialize with staking parameters',
    codeType: 'solidity',
    filename: params.isErc20 ? 'ERC20TokenStakingManager.sol' : 'NativeTokenStakingManager.sol',
    sourceUrl: params.isErc20
      ? `https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/validator-manager/ERC20TokenStakingManager.sol`
      : `https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/validator-manager/NativeTokenStakingManager.sol`,
    highlightFunction: 'initialize',
    githubUrl: params.isErc20
      ? `https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/validator-manager/ERC20TokenStakingManager.sol`
      : `https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/validator-manager/NativeTokenStakingManager.sol`,
  },
];

interface InitializeStakingManagerProps extends BaseConsoleToolProps {
  initialStakingType?: StakingType;
}

export function InitializeStakingManagerInner({ onSuccess, initialStakingType }: InitializeStakingManagerProps) {
  const { setCriticalError } = useCriticalError();
  const toolboxStore = useToolboxStore();
  const detectedType: StakingType =
    initialStakingType || (toolboxStore.erc20StakingManagerAddress ? 'erc20' : 'native');
  const [stakingType] = useState<StakingType>(detectedType);
  const [stakingManagerAddressInput, setStakingManagerAddressInput] = useState<string>('');
  const [subnetIdInput, setSubnetIdInput] = useState<string>('');
  const [validatorManagerAddressInput, setValidatorManagerAddressInput] = useState<string>('');
  const [blockchainIdInput, setBlockchainIdInput] = useState<string>('');
  const [tokenAddress, setTokenAddress] = useState<string>('');
  const [isChecking, setIsChecking] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  // Initialization parameters
  const [minimumStakeAmount, setMinimumStakeAmount] = useState<string>('1');
  const [maximumStakeAmount, setMaximumStakeAmount] = useState<string>('1000000');
  const [minimumStakeDuration, setMinimumStakeDuration] = useState<string>('86400');
  const [minimumDelegationFeeBips, setMinimumDelegationFeeBips] = useState<string>('100');
  const [maximumStakeMultiplier, setMaximumStakeMultiplier] = useState<string>('10');
  const [weightToValueFactor, setWeightToValueFactor] = useState<string>('1');
  const [rewardCalculatorAddress, setRewardCalculatorAddress] = useState<string>('');

  const { walletEVMAddress } = useWalletStore();
  const chainPublicClient = useChainPublicClient();
  const walletClient = useResolvedWalletClient();
  const viemChain = useViemChainStore();
  const {
    nativeStakingManagerAddress: storedNativeStakingManagerAddress,
    erc20StakingManagerAddress: storedErc20StakingManagerAddress,
    rewardCalculatorAddress: storedRewardCalculatorAddress,
    exampleErc20Address: storedExampleErc20Address,
  } = useToolboxStore();
  const { notify } = useConsoleNotifications();

  const selectedL1 = useSelectedL1();
  const vmcData = useVMCAddress(subnetIdInput);
  const validatorManagerAddress = vmcData.validatorManagerAddress || '';
  const blockchainId = vmcData.blockchainId || '';
  // Use the L1's own blockchain ID for uptimeBlockchainID — NOT the VMC home chain
  const l1BlockchainId = vmcData.l1BlockchainId || '';

  const isErc20 = stakingType === 'erc20';
  const stakingAbi = isErc20 ? ERC20TokenStakingManager.abi : NativeTokenStakingManager.abi;

  // Auto-fill subnet ID from selected L1
  useEffect(() => {
    if (selectedL1?.subnetId && !subnetIdInput) {
      setSubnetIdInput(selectedL1.subnetId);
    }
  }, [selectedL1?.subnetId, subnetIdInput]);

  // Auto-fill addresses from store based on staking type
  useEffect(() => {
    const storedAddress = isErc20 ? storedErc20StakingManagerAddress : storedNativeStakingManagerAddress;
    if (storedAddress && !stakingManagerAddressInput) {
      setStakingManagerAddressInput(storedAddress);
    }
  }, [isErc20, storedNativeStakingManagerAddress, storedErc20StakingManagerAddress, stakingManagerAddressInput]);

  useEffect(() => {
    if (storedRewardCalculatorAddress && !rewardCalculatorAddress) {
      setRewardCalculatorAddress(storedRewardCalculatorAddress);
    }
  }, [storedRewardCalculatorAddress, rewardCalculatorAddress]);

  useEffect(() => {
    if (isErc20 && storedExampleErc20Address && !tokenAddress) {
      setTokenAddress(storedExampleErc20Address);
    }
  }, [isErc20, storedExampleErc20Address, tokenAddress]);

  // Auto-fill validator manager address from VMC lookup
  useEffect(() => {
    if (validatorManagerAddress && !validatorManagerAddressInput) {
      setValidatorManagerAddressInput(validatorManagerAddress);
    }
  }, [validatorManagerAddress, validatorManagerAddressInput]);

  // Auto-fill uptime blockchain ID from the L1's own chain (not the VMC home chain)
  useEffect(() => {
    if (l1BlockchainId && !blockchainIdInput) {
      setBlockchainIdInput(l1BlockchainId);
    }
  }, [l1BlockchainId, blockchainIdInput]);

  // Also try from store's toolbox VMC address
  useEffect(() => {
    if (toolboxStore.validatorManagerAddress && !validatorManagerAddressInput) {
      setValidatorManagerAddressInput(toolboxStore.validatorManagerAddress);
    }
  }, [toolboxStore.validatorManagerAddress, validatorManagerAddressInput]);

  // Auto-check initialization status when addresses are available
  useEffect(() => {
    if (stakingManagerAddressInput && chainPublicClient && isInitialized === null) {
      checkIfInitialized();
    }
  }, [stakingManagerAddressInput, chainPublicClient]);

  const codeSteps = getCodeSteps({
    stakingManagerAddress: stakingManagerAddressInput,
    validatorManagerAddress: validatorManagerAddressInput || '',
    rewardCalculatorAddress,
    blockchainId: blockchainIdInput || '',
    minimumStakeAmount,
    maximumStakeAmount,
    minimumStakeDuration,
    minimumDelegationFeeBips,
    maximumStakeMultiplier,
    weightToValueFactor,
    isErc20,
  });

  async function checkIfInitialized() {
    if (!stakingManagerAddressInput || !chainPublicClient) return;

    setIsChecking(true);
    try {
      const settings = (await chainPublicClient.readContract({
        address: stakingManagerAddressInput as `0x${string}`,
        abi: stakingAbi,
        functionName: 'getStakingManagerSettings',
      })) as any;

      const initialized = BigInt(settings.minimumStakeAmount) > 0n;
      setIsInitialized(initialized);
    } catch (error) {
      console.error('Error checking initialization status:', error);
      setIsInitialized(false);
    } finally {
      setIsChecking(false);
    }
  }

  async function handleInitialize() {
    if (!stakingManagerAddressInput) return;

    setIsInitializing(true);
    try {
      if (!walletClient) throw new Error('Wallet not connected');
      if (!validatorManagerAddress) throw new Error('Validator Manager address required');
      if (!rewardCalculatorAddress) throw new Error('Reward Calculator address required');
      if (!blockchainId) throw new Error('Blockchain ID not found');
      if (isErc20 && !tokenAddress) throw new Error('ERC20 token address required');

      let hexBlockchainId = cb58ToHex(blockchainIdInput);
      if (hexBlockchainId.length < 64) {
        hexBlockchainId = hexBlockchainId.padStart(64, '0');
      }
      hexBlockchainId = `0x${hexBlockchainId}` as `0x${string}`;

      const settings = {
        manager: validatorManagerAddressInput as `0x${string}`,
        minimumStakeAmount: parseEther(minimumStakeAmount),
        maximumStakeAmount: parseEther(maximumStakeAmount),
        minimumStakeDuration: BigInt(minimumStakeDuration),
        minimumDelegationFeeBips: parseInt(minimumDelegationFeeBips),
        maximumStakeMultiplier: parseInt(maximumStakeMultiplier),
        weightToValueFactor: parseEther(weightToValueFactor),
        rewardCalculator: rewardCalculatorAddress as `0x${string}`,
        uptimeBlockchainID: hexBlockchainId as `0x${string}`,
      };

      const initArgs = isErc20 ? [settings, tokenAddress as `0x${string}`] : [settings];

      const gasEstimate = await chainPublicClient!.estimateContractGas({
        address: stakingManagerAddressInput as `0x${string}`,
        abi: stakingAbi,
        functionName: 'initialize',
        args: initArgs,
        account: walletEVMAddress as `0x${string}`,
      });

      const gasWithBuffer = gasEstimate + (gasEstimate * 20n) / 100n;

      const writePromise = walletClient!.writeContract({
        address: stakingManagerAddressInput as `0x${string}`,
        abi: stakingAbi,
        functionName: 'initialize',
        args: initArgs,
        chain: viemChain,
        gas: gasWithBuffer,
        account: walletEVMAddress as `0x${string}`,
      });

      notify(
        {
          type: 'call',
          name: `Initialize ${isErc20 ? 'ERC20' : 'Native'} Token Staking Manager`,
        },
        writePromise,
        viemChain ?? undefined,
      );

      const hash = await writePromise;
      const receipt = await chainPublicClient!.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') {
        throw new Error('Initialization transaction reverted');
      }
      await checkIfInitialized();
      onSuccess?.();
    } catch (error) {
      setCriticalError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsInitializing(false);
    }
  }

  const canInitialize =
    stakingManagerAddressInput &&
    validatorManagerAddressInput &&
    rewardCalculatorAddress &&
    blockchainIdInput &&
    isInitialized !== true &&
    (!isErc20 || tokenAddress);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Initialize Controls */}
      <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="p-4 space-y-3">
          {/* Step 1: Verify Contract Addresses */}
          <div onFocus={() => setActiveStep(0)}>
            <StepFlowCard
              step={1}
              title="Verify Contract Addresses"
              description={`${isErc20 ? 'ERC20' : 'Native'} Token Staking Manager, Validator Manager, and Reward Calculator`}
              isComplete={!!stakingManagerAddressInput && !!rewardCalculatorAddress && !!validatorManagerAddressInput}
            >
              <div className="mt-2 space-y-2">
                <SelectSubnetId value={subnetIdInput} onChange={setSubnetIdInput} hidePrimaryNetwork={true} />
                {vmcData.isLoading && <p className="text-xs text-zinc-400">Resolving validator manager...</p>}
                {validatorManagerAddressInput && blockchainIdInput && (
                  <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Validator Manager</span>
                      <code className="text-zinc-700 dark:text-zinc-300 font-mono">
                        {validatorManagerAddressInput.slice(0, 10)}...{validatorManagerAddressInput.slice(-6)}
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">L1 Blockchain (uptime)</span>
                      <code className="text-zinc-700 dark:text-zinc-300 font-mono">
                        {blockchainIdInput.slice(0, 12)}...
                      </code>
                    </div>
                  </div>
                )}
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <EVMAddressInput
                      label={`${isErc20 ? 'ERC20' : 'Native'} Token Staking Manager`}
                      value={stakingManagerAddressInput}
                      onChange={setStakingManagerAddressInput}
                      disabled={isInitializing}
                    />
                  </div>
                  <button
                    onClick={checkIfInitialized}
                    disabled={isChecking || !stakingManagerAddressInput}
                    className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 mb-0.5"
                    title="Check status"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-zinc-500 ${isChecking ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <EVMAddressInput
                  label="Reward Calculator"
                  value={rewardCalculatorAddress}
                  onChange={setRewardCalculatorAddress}
                  disabled={isInitializing}
                />

                {isErc20 && (
                  <EVMAddressInput
                    label="ERC20 Token Address"
                    value={tokenAddress}
                    onChange={setTokenAddress}
                    disabled={isInitializing}
                  />
                )}

                {validatorManagerAddress && (
                  <p className="text-[10px] text-zinc-400 font-mono truncate">
                    Validator Manager: {validatorManagerAddress}
                  </p>
                )}
                {blockchainId && (
                  <p className="text-[10px] text-zinc-400 font-mono truncate">Blockchain ID: {blockchainId}</p>
                )}

                {isInitialized !== null && (
                  <div
                    className={`text-xs flex items-center gap-1 ${isInitialized ? 'text-amber-600' : 'text-green-600'}`}
                  >
                    {isInitialized ? (
                      <>
                        <AlertCircle className="w-3 h-3" />
                        Already initialized
                      </>
                    ) : (
                      <>
                        <Check className="w-3 h-3" />
                        Ready to initialize
                      </>
                    )}
                  </div>
                )}
              </div>
            </StepFlowCard>
          </div>

          {/* Step 2: Configure & Initialize */}
          <div onFocus={() => setActiveStep(1)}>
            <StepFlowCard
              step={2}
              title="Configure Staking Parameters"
              description="Set minimum/maximum stake, duration, delegation fees, and multiplier"
              isComplete={isInitialized === true}
              isActive={!!stakingManagerAddressInput && !!rewardCalculatorAddress}
            >
              <div className="mt-2 space-y-3">
                <StakingParametersForm
                  minimumStakeAmount={minimumStakeAmount}
                  setMinimumStakeAmount={setMinimumStakeAmount}
                  maximumStakeAmount={maximumStakeAmount}
                  setMaximumStakeAmount={setMaximumStakeAmount}
                  minimumStakeDuration={minimumStakeDuration}
                  setMinimumStakeDuration={setMinimumStakeDuration}
                  minimumDelegationFeeBips={minimumDelegationFeeBips}
                  setMinimumDelegationFeeBips={setMinimumDelegationFeeBips}
                  maximumStakeMultiplier={maximumStakeMultiplier}
                  setMaximumStakeMultiplier={setMaximumStakeMultiplier}
                  weightToValueFactor={weightToValueFactor}
                  setWeightToValueFactor={setWeightToValueFactor}
                  disabled={isInitializing}
                  tokenLabel={isErc20 ? 'ERC20 tokens' : 'native tokens'}
                />

                {isInitialized === true ? (
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Contract already initialized
                  </div>
                ) : (
                  <Button
                    variant="primary"
                    onClick={handleInitialize}
                    loading={isInitializing}
                    disabled={!canInitialize || isInitializing}
                    className="w-full"
                  >
                    Initialize Contract
                  </Button>
                )}
              </div>
            </StepFlowCard>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between mt-auto">
          <span className="text-xs text-zinc-500">Calls initialize(settings)</span>
          <a
            href={`https://github.com/ava-labs/icm-contracts/tree/${ICM_COMMIT}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 font-mono transition-colors"
          >
            @{ICM_COMMIT.slice(0, 7)}
          </a>
        </div>
      </div>

      {/* Right: Code Viewer */}
      <StepCodeViewer activeStep={activeStep} steps={codeSteps} />
    </div>
  );
}

export default withConsoleToolMetadata(InitializeStakingManagerInner, metadata);
