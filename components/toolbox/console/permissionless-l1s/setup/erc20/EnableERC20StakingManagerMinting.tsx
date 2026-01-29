"use client";

import { useState, useEffect } from "react";
import { useToolboxStore, useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { Button } from "@/components/toolbox/components/Button";
import { EVMAddressInput } from "@/components/toolbox/components/EVMAddressInput";
import { ResultField } from "@/components/toolbox/components/ResultField";
import { ConsoleToolMetadata, withConsoleToolMetadata } from '../../../../components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { Callout } from "fumadocs-ui/components/callout";
import { Alert } from "@/components/toolbox/components/Alert";
import ExampleERC20 from "@/contracts/icm-contracts/compiled/ExampleERC20.json";
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { keccak256, toHex } from 'viem';
import { useCriticalError } from "@/components/toolbox/hooks/useCriticalError";

const metadata: ConsoleToolMetadata = {
  title: "Enable ERC20 Staking Manager Minting",
  description: "Grant the ERC20 Token Staking Manager permission to mint reward tokens.",
  toolRequirements: [
    WalletRequirementsConfigKey.EVMChainBalance,
  ],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

// OpenZeppelin AccessControl MINTER_ROLE
const MINTER_ROLE = keccak256(toHex("MINTER_ROLE"));

type AccessControlType = 'ownable' | 'access-control' | 'unknown';

function EnableERC20StakingManagerMinting() {
  const { erc20StakingManagerAddress } = useToolboxStore();
  const { publicClient, coreWalletClient, walletEVMAddress } = useWalletStore();
  const viemChain = useViemChainStore();
  const { notify } = useConsoleNotifications();
  const { setCriticalError } = useCriticalError();

  const [stakingTokenAddress, setStakingTokenAddress] = useState<string>("");
  const [isChecking, setIsChecking] = useState(false);
  const [accessControlType, setAccessControlType] = useState<AccessControlType>('unknown');
  const [isGranting, setIsGranting] = useState(false);
  const [grantTxHash, setGrantTxHash] = useState<string | null>(null);
  const [tokenName, setTokenName] = useState<string>("");
  const [tokenSymbol, setTokenSymbol] = useState<string>("");

  // Check the token's access control pattern
  async function checkTokenAccessControl() {
    if (!stakingTokenAddress || !publicClient) return;

    setIsChecking(true);
    try {
      // Try to get token info
      try {
        const [name, symbol] = await Promise.all([
          publicClient.readContract({
            address: stakingTokenAddress as `0x${string}`,
            abi: ExampleERC20.abi,
            functionName: 'name',
          }),
          publicClient.readContract({
            address: stakingTokenAddress as `0x${string}`,
            abi: ExampleERC20.abi,
            functionName: 'symbol',
          })
        ]);
        setTokenName(name as string);
        setTokenSymbol(symbol as string);
      } catch (e) {
        console.warn("Could not read token name/symbol:", e);
      }

      // Check for OpenZeppelin AccessControl pattern (hasRole, grantRole)
      try {
        await publicClient.readContract({
          address: stakingTokenAddress as `0x${string}`,
          abi: [{
            type: 'function',
            name: 'hasRole',
            inputs: [
              { name: 'role', type: 'bytes32' },
              { name: 'account', type: 'address' }
            ],
            outputs: [{ name: '', type: 'bool' }],
            stateMutability: 'view'
          }],
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
        await publicClient.readContract({
          address: stakingTokenAddress as `0x${string}`,
          abi: [{
            type: 'function',
            name: 'owner',
            inputs: [],
            outputs: [{ name: '', type: 'address' }],
            stateMutability: 'view'
          }],
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
      console.error("Error checking token access control:", error);
      setAccessControlType('unknown');
    } finally {
      setIsChecking(false);
    }
  }

  useEffect(() => {
    if (stakingTokenAddress) {
      const timeoutId = setTimeout(() => {
        checkTokenAccessControl();
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [stakingTokenAddress]);

  async function handleGrantMinterRole() {
    if (!stakingTokenAddress || !erc20StakingManagerAddress || !coreWalletClient) return;

    setIsGranting(true);
    try {
      const grantPromise = coreWalletClient.writeContract({
        address: stakingTokenAddress as `0x${string}`,
        abi: [{
          type: 'function',
          name: 'grantRole',
          inputs: [
            { name: 'role', type: 'bytes32' },
            { name: 'account', type: 'address' }
          ],
          outputs: [],
          stateMutability: 'nonpayable'
        }],
        functionName: 'grantRole',
        args: [MINTER_ROLE, erc20StakingManagerAddress as `0x${string}`],
        chain: viemChain,
        account: walletEVMAddress as `0x${string}`,
      });

      notify({
        type: 'call',
        name: 'Grant Minter Role'
      }, grantPromise, viemChain ?? undefined);

      const hash = await grantPromise;
      await publicClient.waitForTransactionReceipt({ hash });
      setGrantTxHash(hash);
    } catch (error) {
      setCriticalError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsGranting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Callout type="info">
        <p className="font-semibold mb-2">Why is this needed?</p>
        <p>The ERC20 Token Staking Manager needs permission to mint reward tokens for validators and delegators.
          The ERC20 token must implement the <code>IERC20Mintable</code> interface and grant minting permissions to the staking manager.</p>
        {erc20StakingManagerAddress && (
          <p className="mt-2">
            <strong>Your ERC20 Token Staking Manager Address:</strong> <code className="text-xs">{erc20StakingManagerAddress}</code>
          </p>
        )}
      </Callout>

      {!erc20StakingManagerAddress && (
        <Alert variant="warning">
          No ERC20 staking manager address found. Please deploy and initialize an ERC20 Token Staking Manager first.
        </Alert>
      )}

      <div className="space-y-4">
        <EVMAddressInput
          label="Staking Token Address (ERC20)"
          value={stakingTokenAddress}
          onChange={setStakingTokenAddress}
          disabled={isGranting}
          helperText="The ERC20 token address used for staking rewards"
        />

        {tokenName && tokenSymbol && (
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
            <p className="text-sm">
              <strong>Token:</strong> {tokenName} ({tokenSymbol})
            </p>
          </div>
        )}

        {stakingTokenAddress && !isChecking && (
          <>
            {accessControlType === 'access-control' && (
              <div className="space-y-4">
                <Alert variant="info">
                  This token uses OpenZeppelin AccessControl. Click the button below to grant the MINTER_ROLE to your staking manager.
                </Alert>

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
              <Callout type="warn">
                <p className="font-semibold mb-2">Ownable Pattern Detected</p>
                <p>This token uses the Ownable pattern. You'll need to:</p>
                <ol className="list-decimal list-inside mt-2 space-y-1">
                  <li>Ensure the connected wallet is the owner of the token contract</li>
                  <li>Transfer ownership to the staking manager contract, OR</li>
                  <li>Implement a custom access control function that allows the staking manager to mint</li>
                </ol>
                <p className="mt-2 text-sm">
                  <strong>Note:</strong> If your token only allows the owner to mint, you must transfer ownership to <code className="text-xs">{erc20StakingManagerAddress}</code>
                </p>
              </Callout>
            )}

            {accessControlType === 'unknown' && (
              <Callout type="warn">
                <p className="font-semibold mb-2">Custom Access Control</p>
                <p>This token uses a custom access control pattern. Please ensure you:</p>
                <ol className="list-decimal list-inside mt-2 space-y-1">
                  <li>Implement the <code>IERC20Mintable</code> interface with a <code>mint(address account, uint256 amount)</code> function</li>
                  <li>Grant minting permissions to the staking manager address: <code className="text-xs">{erc20StakingManagerAddress}</code></li>
                  <li>Verify that the staking manager can successfully call the mint function</li>
                </ol>
                <p className="mt-2 text-sm">
                  <strong>Important:</strong> Without proper minting permissions, the staking manager will fail when distributing rewards.
                </p>
              </Callout>
            )}
          </>
        )}

        {isChecking && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Detecting token access control pattern...
            </p>
          </div>
        )}
      </div>

      {grantTxHash && (
        <ResultField
          label="Transaction Hash"
          value={grantTxHash}
          showCheck={true}
        />
      )}

      <Callout>
        <p className="font-semibold mb-2">Verification Steps</p>
        <p>After granting minting permissions, verify that:</p>
        <ol className="list-decimal list-inside mt-2 space-y-1">
          <li>The staking manager address has minting permissions on the token contract</li>
          <li>The token implements <code>IERC20Mintable</code> interface</li>
          <li>Test minting works by completing a delegation or validator registration cycle</li>
        </ol>
      </Callout>
    </div>
  );
}

export default withConsoleToolMetadata(EnableERC20StakingManagerMinting, metadata);
