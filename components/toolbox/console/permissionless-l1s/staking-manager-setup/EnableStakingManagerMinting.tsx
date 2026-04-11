'use client';

import { useState, useEffect } from 'react';
import { useToolboxStore, useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import { Button } from '@/components/toolbox/components/Button';
import { EVMAddressInput } from '@/components/toolbox/components/EVMAddressInput';
import { ResultField } from '@/components/toolbox/components/ResultField';
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
import { keccak256, toHex } from 'viem';
import { useCriticalError } from '@/components/toolbox/hooks/useCriticalError';
import { useExampleERC20 } from '@/components/toolbox/hooks/contracts';
import { Check, AlertTriangle, Info, Loader2 } from 'lucide-react';

// Default Native Minter address
const DEFAULT_NATIVE_MINTER_ADDRESS = '0x0200000000000000000000000000000000000001';

// OpenZeppelin AccessControl MINTER_ROLE
const MINTER_ROLE = keccak256(toHex('MINTER_ROLE'));

const metadata: ConsoleToolMetadata = {
  title: 'Enable Staking Manager Minting',
  description: 'Grant the Staking Manager permission to mint rewards.',
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

type TokenType = 'native' | 'erc20';
type AccessControlType = 'ownable' | 'access-control' | 'unknown';

interface EnableStakingManagerMintingProps extends BaseConsoleToolProps {
  initialTokenType?: TokenType;
}

export function EnableStakingManagerMintingInner({ initialTokenType }: EnableStakingManagerMintingProps) {
  const { nativeStakingManagerAddress, erc20StakingManagerAddress } = useToolboxStore();
  const { walletEVMAddress } = useWalletStore();
  const chainPublicClient = useChainPublicClient();
  const { setCriticalError } = useCriticalError();

  // Auto-detect token type based on which staking manager address is stored from step 1
  const detectedTokenType: TokenType = erc20StakingManagerAddress ? 'erc20' : 'native';
  const tokenType = initialTokenType || detectedTokenType;

  // ERC20-specific state
  const [stakingTokenAddress, setStakingTokenAddress] = useState<string>('');
  const [isChecking, setIsChecking] = useState(false);
  const [accessControlType, setAccessControlType] = useState<AccessControlType>('unknown');
  const [isGranting, setIsGranting] = useState(false);
  const [grantTxHash, setGrantTxHash] = useState<string | null>(null);
  const [tokenName, setTokenName] = useState<string>('');
  const [tokenSymbol, setTokenSymbol] = useState<string>('');

  const isNative = tokenType === 'native';
  const stakingManagerAddress = isNative ? nativeStakingManagerAddress : erc20StakingManagerAddress;

  // Initialize ExampleERC20 hook for grantRole
  const exampleERC20 = useExampleERC20(stakingTokenAddress || null);

  // Check the token's access control pattern (ERC20 only)
  async function checkTokenAccessControl() {
    if (!stakingTokenAddress || !chainPublicClient || isNative) return;

    setIsChecking(true);
    try {
      // Try to get token info
      try {
        const [name, symbol] = await Promise.all([
          chainPublicClient.readContract({
            address: stakingTokenAddress as `0x${string}`,
            abi: ExampleERC20.abi,
            functionName: 'name',
          }),
          chainPublicClient.readContract({
            address: stakingTokenAddress as `0x${string}`,
            abi: ExampleERC20.abi,
            functionName: 'symbol',
          }),
        ]);
        setTokenName(name as string);
        setTokenSymbol(symbol as string);
      } catch (e) {
        console.warn('Could not read token name/symbol:', e);
      }

      // Check for OpenZeppelin AccessControl pattern (hasRole, grantRole)
      try {
        await chainPublicClient.readContract({
          address: stakingTokenAddress as `0x${string}`,
          abi: [
            {
              type: 'function',
              name: 'hasRole',
              inputs: [
                { name: 'role', type: 'bytes32' },
                { name: 'account', type: 'address' },
              ],
              outputs: [{ name: '', type: 'bool' }],
              stateMutability: 'view',
            },
          ],
          functionName: 'hasRole',
          args: [MINTER_ROLE, walletEVMAddress as `0x${string}`],
        });
        setAccessControlType('access-control');
        return;
      } catch (e) {
        // Not AccessControl
      }

      // Check for Ownable pattern (owner function)
      try {
        await chainPublicClient.readContract({
          address: stakingTokenAddress as `0x${string}`,
          abi: [
            {
              type: 'function',
              name: 'owner',
              inputs: [],
              outputs: [{ name: '', type: 'address' }],
              stateMutability: 'view',
            },
          ],
          functionName: 'owner',
        });
        setAccessControlType('ownable');
        return;
      } catch (e) {
        // Not Ownable
      }

      // Unknown pattern
      setAccessControlType('unknown');
    } catch (error) {
      console.error('Error checking token access control:', error);
      setAccessControlType('unknown');
    } finally {
      setIsChecking(false);
    }
  }

  useEffect(() => {
    if (stakingTokenAddress && !isNative) {
      const timeoutId = setTimeout(() => {
        checkTokenAccessControl();
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [stakingTokenAddress, isNative]);

  async function handleGrantMinterRole() {
    if (!stakingTokenAddress || !erc20StakingManagerAddress) return;

    setIsGranting(true);
    try {
      const hash = await exampleERC20.grantRole(MINTER_ROLE, erc20StakingManagerAddress);
      await chainPublicClient!.waitForTransactionReceipt({ hash: hash as `0x${string}` });
      setGrantTxHash(hash);
    } catch (error) {
      setCriticalError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsGranting(false);
    }
  }

  // Native token component
  const NativeTokenContent = () => (
    <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="flex-1 overflow-auto p-5 space-y-4">
        {/* Info card */}
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">Why is this needed?</h3>
              <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                The Native Token Staking Manager needs permission to mint native tokens as rewards for validators and
                delegators. You must add the staking manager address to the Native Minter allowlist.
              </p>
              {nativeStakingManagerAddress && (
                <div className="mt-2">
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Staking Manager: </span>
                  <code className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-mono text-xs">
                    {nativeStakingManagerAddress.slice(0, 10)}...{nativeStakingManagerAddress.slice(-6)}
                  </code>
                </div>
              )}
            </div>
          </div>
        </div>

        {!nativeStakingManagerAddress && (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                No native staking manager address found. Please deploy and initialize a Native Token Staking Manager
                first.
              </p>
            </div>
          </div>
        )}

        {nativeStakingManagerAddress && (
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Add your Native Token Staking Manager to the allowlist below:
          </p>
        )}
      </div>

      <CheckPrecompile configKey="contractNativeMinterConfig" precompileName="Native Minter">
        <div className="px-5 pb-5">
          <AllowlistComponent
            precompileAddress={DEFAULT_NATIVE_MINTER_ADDRESS}
            precompileType="Minter"
            defaultEnabledAddress={nativeStakingManagerAddress}
          />
        </div>
      </CheckPrecompile>
    </div>
  );

  // ERC20 token component
  const ERC20TokenContent = () => (
    <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="flex-1 overflow-auto p-5 space-y-4">
        {/* Info card */}
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">Why is this needed?</h3>
              <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                The ERC20 Token Staking Manager needs permission to mint reward tokens for validators and delegators.
                The ERC20 token must implement the{' '}
                <code className="text-blue-800 dark:text-blue-200">IERC20Mintable</code> interface and grant minting
                permissions to the staking manager.
              </p>
              {erc20StakingManagerAddress && (
                <div className="mt-2">
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Staking Manager: </span>
                  <code className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-mono text-xs">
                    {erc20StakingManagerAddress.slice(0, 10)}...{erc20StakingManagerAddress.slice(-6)}
                  </code>
                </div>
              )}
            </div>
          </div>
        </div>

        {!erc20StakingManagerAddress && (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                No ERC20 staking manager address found. Please deploy and initialize an ERC20 Token Staking Manager
                first.
              </p>
            </div>
          </div>
        )}

        <EVMAddressInput
          label="Staking Token Address (ERC20)"
          value={stakingTokenAddress}
          onChange={setStakingTokenAddress}
          disabled={isGranting}
          helperText="The ERC20 token address used for staking rewards"
        />

        {tokenName && tokenSymbol && (
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              <span className="font-medium">Token:</span> {tokenName} ({tokenSymbol})
            </p>
          </div>
        )}

        {isChecking && (
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
              <p className="text-xs text-blue-700 dark:text-blue-300">Detecting token access control pattern...</p>
            </div>
          </div>
        )}

        {stakingTokenAddress && !isChecking && (
          <>
            {accessControlType === 'access-control' && (
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
                  <div className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-green-700 dark:text-green-300 leading-relaxed">
                      This token uses OpenZeppelin AccessControl. Click the button below to grant the MINTER_ROLE to
                      your staking manager.
                    </p>
                  </div>
                </div>

                <Button
                  variant="primary"
                  onClick={handleGrantMinterRole}
                  loading={isGranting}
                  disabled={!erc20StakingManagerAddress || isGranting || !!grantTxHash}
                >
                  Grant MINTER_ROLE to Staking Manager
                </Button>
              </div>
            )}

            {accessControlType === 'ownable' && (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-1.5">
                      Ownable Pattern Detected
                    </h3>
                    <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed mb-2">
                      This token uses the Ownable pattern. You&apos;ll need to:
                    </p>
                    <ol className="list-decimal list-inside text-xs text-amber-700 dark:text-amber-300 space-y-1">
                      <li>Ensure the connected wallet is the owner of the token contract</li>
                      <li>Transfer ownership to the staking manager contract, OR</li>
                      <li>Implement a custom access control function that allows the staking manager to mint</li>
                    </ol>
                    {erc20StakingManagerAddress && (
                      <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                        <span className="font-medium">Note:</span> If your token only allows the owner to mint, transfer
                        ownership to{' '}
                        <code className="px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 font-mono text-[10px]">
                          {erc20StakingManagerAddress.slice(0, 10)}...{erc20StakingManagerAddress.slice(-6)}
                        </code>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {accessControlType === 'unknown' && (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-1.5">
                      Custom Access Control
                    </h3>
                    <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed mb-2">
                      This token uses a custom access control pattern. Please ensure you:
                    </p>
                    <ol className="list-decimal list-inside text-xs text-amber-700 dark:text-amber-300 space-y-1">
                      <li>
                        Implement the <code className="text-amber-800 dark:text-amber-200">IERC20Mintable</code>{' '}
                        interface with a{' '}
                        <code className="text-amber-800 dark:text-amber-200">mint(address, uint256)</code> function
                      </li>
                      <li>Grant minting permissions to the staking manager</li>
                      <li>Verify the staking manager can call the mint function</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {grantTxHash && <ResultField label="Transaction Hash" value={grantTxHash} showCheck={true} />}

        {/* Verification steps */}
        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">Verification Steps</h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-2">
            After granting minting permissions, verify that:
          </p>
          <ol className="list-decimal list-inside text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
            <li>The staking manager address has minting permissions on the token contract</li>
            <li>
              The token implements <code className="text-zinc-700 dark:text-zinc-300">IERC20Mintable</code> interface
            </li>
            <li>Test minting works by completing a delegation or validator registration cycle</li>
          </ol>
        </div>
      </div>
    </div>
  );

  return isNative ? <NativeTokenContent /> : <ERC20TokenContent />;
}

export default withConsoleToolMetadata(EnableStakingManagerMintingInner, metadata);
