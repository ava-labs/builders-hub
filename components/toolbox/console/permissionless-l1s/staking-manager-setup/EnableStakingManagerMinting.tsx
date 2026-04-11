'use client';

import { useState, useEffect } from 'react';
import { useToolboxStore } from '@/components/toolbox/stores/toolboxStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import { Button } from '@/components/toolbox/components/Button';
import { EVMAddressInput } from '@/components/toolbox/components/EVMAddressInput';
import { AllowlistComponent } from '@/components/toolbox/components/AllowListComponents';
import { CheckPrecompile } from '@/components/toolbox/components/CheckPrecompile';
import {
  BaseConsoleToolProps,
  ConsoleToolMetadata,
  withConsoleToolMetadata,
} from '../../../components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { Alert } from '@/components/toolbox/components/Alert';
import ExampleERC20 from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import ExampleERC20Mintable from '@/contracts/icm-contracts/compiled/ExampleERC20Mintable.json';
import { keccak256, toHex } from 'viem';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { useResolvedWalletClient } from '@/components/toolbox/hooks/useResolvedWalletClient';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { StepFlowCard } from '@/components/toolbox/components/StepCard';
import { Check } from 'lucide-react';
import versions from '@/scripts/versions.json';

const ICM_COMMIT = versions['ava-labs/icm-contracts'];
const DEFAULT_NATIVE_MINTER_ADDRESS = '0x0200000000000000000000000000000000000001';
const MINTER_ROLE = keccak256(toHex('MINTER_ROLE'));

const metadata: ConsoleToolMetadata = {
  title: 'Enable Staking Manager Minting',
  description: 'Grant the Staking Manager permission to mint rewards.',
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

type TokenType = 'native' | 'erc20';

interface EnableStakingManagerMintingProps extends BaseConsoleToolProps {
  initialTokenType?: TokenType;
}

export function EnableStakingManagerMintingInner({ initialTokenType }: EnableStakingManagerMintingProps) {
  const { nativeStakingManagerAddress, erc20StakingManagerAddress, exampleErc20Address } = useToolboxStore();
  const { walletEVMAddress } = useWalletStore();
  const chainPublicClient = useChainPublicClient();
  const walletClient = useResolvedWalletClient();
  const viemChain = useViemChainStore();
  const { notify } = useConsoleNotifications();

  const detectedTokenType: TokenType = erc20StakingManagerAddress ? 'erc20' : 'native';
  const tokenType = initialTokenType || detectedTokenType;
  const isNative = tokenType === 'native';
  const defaultStakingManager = isNative ? nativeStakingManagerAddress : erc20StakingManagerAddress;
  const [stakingManagerAddress, setStakingManagerAddress] = useState<string>(defaultStakingManager || '');

  // ERC20 state
  const [stakingTokenAddress, setStakingTokenAddress] = useState<string>(exampleErc20Address || '');
  const [isGranting, setIsGranting] = useState(false);
  const [grantTxHash, setGrantTxHash] = useState<string | null>(null);
  const [tokenName, setTokenName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Auto-detect token name
  useEffect(() => {
    if (!stakingTokenAddress || isNative || !chainPublicClient) return;
    chainPublicClient
      .readContract({
        address: stakingTokenAddress as `0x${string}`,
        abi: ExampleERC20.abi,
        functionName: 'name',
      })
      .then((name) => setTokenName(name as string))
      .catch(() => setTokenName(''));
  }, [stakingTokenAddress, isNative, chainPublicClient]);

  async function handleGrantMinterRole() {
    if (!stakingTokenAddress || !stakingManagerAddress || !walletClient || !viemChain) return;
    setIsGranting(true);
    setError(null);
    try {
      const writePromise = walletClient.writeContract({
        address: stakingTokenAddress as `0x${string}`,
        abi: ExampleERC20Mintable.abi,
        functionName: 'grantRole',
        args: [MINTER_ROLE, stakingManagerAddress as `0x${string}`],
        chain: viemChain,
        account: walletEVMAddress as `0x${string}`,
      });

      notify({ type: 'call', name: 'Grant MINTER_ROLE' }, writePromise, viemChain);

      const hash = await writePromise;
      await chainPublicClient!.waitForTransactionReceipt({ hash });
      setGrantTxHash(hash);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsGranting(false);
    }
  }

  // ── Native Token Path ──
  if (isNative) {
    return (
      <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="p-5 space-y-4">
          {!nativeStakingManagerAddress && (
            <Alert variant="warning">No staking manager address found. Deploy and initialize first.</Alert>
          )}

          <StepFlowCard
            step={1}
            title="Add to Native Minter Allowlist"
            description="Grant the staking manager permission to mint native tokens as validator rewards"
            isComplete={false}
          >
            {nativeStakingManagerAddress && (
              <div className="mt-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 text-xs">
                <span className="text-zinc-500">Staking Manager: </span>
                <code className="text-zinc-700 dark:text-zinc-300 font-mono">
                  {nativeStakingManagerAddress.slice(0, 10)}...{nativeStakingManagerAddress.slice(-6)}
                </code>
              </div>
            )}
          </StepFlowCard>

          <CheckPrecompile configKey="contractNativeMinterConfig" precompileName="Native Minter">
            <AllowlistComponent
              precompileAddress={DEFAULT_NATIVE_MINTER_ADDRESS}
              precompileType="Minter"
              defaultEnabledAddress={nativeStakingManagerAddress}
            />
          </CheckPrecompile>
        </div>

        <div className="shrink-0 px-5 py-3 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between mt-auto">
          <span className="text-xs text-zinc-500">Native Minter Precompile</span>
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
    );
  }

  // ── ERC20 Token Path ──
  return (
    <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="p-5 space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        <StepFlowCard
          step={1}
          title="Grant MINTER_ROLE to Staking Manager"
          description="Allow the staking manager to mint reward tokens"
          isComplete={!!grantTxHash}
        >
          <div className="mt-3 space-y-3">
            <EVMAddressInput
              label="Staking Manager Address"
              value={stakingManagerAddress}
              onChange={setStakingManagerAddress}
              disabled={isGranting}
            />
            <EVMAddressInput
              label="ERC20 Token Address"
              value={stakingTokenAddress}
              onChange={setStakingTokenAddress}
              disabled={isGranting}
            />

            {tokenName && (
              <p className="text-xs text-zinc-500">
                Token: <span className="font-medium text-zinc-700 dark:text-zinc-300">{tokenName}</span>
              </p>
            )}

            {grantTxHash ? (
              <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                <Check className="w-3.5 h-3.5" />
                <span>MINTER_ROLE granted successfully</span>
              </div>
            ) : (
              <Button
                variant="primary"
                onClick={handleGrantMinterRole}
                loading={isGranting}
                disabled={!stakingTokenAddress || !stakingManagerAddress || isGranting}
              >
                Grant MINTER_ROLE
              </Button>
            )}

            {stakingManagerAddress && (
              <p className="text-[11px] text-zinc-400">
                Granting to{' '}
                <code className="font-mono">
                  {stakingManagerAddress.slice(0, 10)}...{stakingManagerAddress.slice(-6)}
                </code>
              </p>
            )}
          </div>
        </StepFlowCard>
      </div>

      <div className="shrink-0 px-5 py-3 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between mt-auto">
        <span className="text-xs text-zinc-500">ERC20 MINTER_ROLE</span>
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
  );
}

export default withConsoleToolMetadata(EnableStakingManagerMintingInner, metadata);
