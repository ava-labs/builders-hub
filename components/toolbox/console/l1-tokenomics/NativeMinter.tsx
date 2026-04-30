'use client';

import { useState } from 'react';
import { parseEther, formatEther } from 'viem';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { ResultField } from '@/components/toolbox/components/ResultField';
import { EVMAddressInput } from '@/components/toolbox/components/EVMAddressInput';
import nativeMinterAbi from '@/contracts/precompiles/NativeMinter.json';
import { AllowlistComponent } from '@/components/toolbox/components/AllowListComponents';
import { CheckPrecompile } from '@/components/toolbox/components/CheckPrecompile';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import {
  BaseConsoleToolProps,
  ConsoleToolMetadata,
  withConsoleToolMetadata,
} from '../../components/WithConsoleToolMetadata';
import { useConnectedWallet } from '@/components/toolbox/contexts/ConnectedWalletContext';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import { PrecompileCodeViewer } from '@/components/console/precompile-code-viewer';
import { PrecompileCard } from '@/components/toolbox/components/PrecompileCard';
import type { PrecompileRole } from '@/components/toolbox/components/PrecompileRoleBadge';
import { Coins, AlertTriangle } from 'lucide-react';

// Default Native Minter address — subnet-evm fixed precompile slot.
const DEFAULT_NATIVE_MINTER_ADDRESS = '0x0200000000000000000000000000000000000001';

const metadata: ConsoleToolMetadata = {
  title: 'Native Minter',
  description: 'Mint native tokens (AVAX) to any address on your L1',
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function NativeMinter({ onSuccess }: BaseConsoleToolProps) {
  const { publicClient, walletEVMAddress } = useWalletStore();
  const { walletClient } = useConnectedWallet();
  const viemChain = useViemChainStore();
  const [amount, setAmount] = useState<string>('');
  const [recipient, setRecipient] = useState<string>('');
  const [isMinting, setIsMinting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [role, setRole] = useState<PrecompileRole | null>(null);
  const [roleRefreshKey, setRoleRefreshKey] = useState(0);

  const handleMint = async () => {
    setIsMinting(true);
    setTxError(null);
    setTxHash(null);

    try {
      // parseEther handles decimals safely — BigInt(amount) would throw on "1.5".
      const amountInWei = parseEther(amount);

      const hash = await walletClient.writeContract({
        address: DEFAULT_NATIVE_MINTER_ADDRESS as `0x${string}`,
        abi: nativeMinterAbi.abi,
        functionName: 'mintNativeCoin',
        args: [recipient as `0x${string}`, amountInWei],
        account: walletEVMAddress as `0x${string}`,
        chain: viemChain,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        setTxHash(hash);
        setRoleRefreshKey((k) => k + 1);
        onSuccess?.();
      } else {
        setTxError(
          'Transaction reverted on-chain. The wallet likely lacks Enabled role on the Native Minter allowlist.',
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Mint failed';
      // Pre-flight reverts surface here — make the role hint explicit.
      if (msg.toLowerCase().includes('revert') || msg.toLowerCase().includes('not allowed')) {
        setTxError(
          `${msg}\n\nThis usually means your wallet lacks the Enabled/Manager/Admin role on the Native Minter allowlist.`,
        );
      } else {
        setTxError(msg);
      }
    } finally {
      setIsMinting(false);
    }
  };

  const isValidAmount = amount && Number(amount) > 0;
  const hasPermission = role !== null && role >= 1;
  const canMint = Boolean(
    recipient && isValidAmount && walletEVMAddress && walletClient && !isMinting && hasPermission,
  );

  // Show preview of mint amount in human-readable form.
  let previewWei: string | null = null;
  try {
    if (isValidAmount) previewWei = parseEther(amount).toString();
  } catch {
    previewWei = null;
  }

  return (
    <CheckPrecompile configKey="contractNativeMinterConfig" precompileName="Native Minter">
      <PrecompileCodeViewer
        precompileName="NativeMinter"
        highlightFunction="mintNativeCoin"
        collapsibleSections={[
          {
            title: 'Manage Allowlist Roles',
            defaultOpen: false,
            children: (
              <AllowlistComponent
                precompileAddress={DEFAULT_NATIVE_MINTER_ADDRESS}
                precompileType="Minter"
                onSuccess={() => {
                  setRoleRefreshKey((k) => k + 1);
                  onSuccess?.();
                }}
              />
            ),
          },
        ]}
      >
        <PrecompileCard
          icon={Coins}
          iconWrapperClass="bg-amber-100 dark:bg-amber-900/30"
          iconClass="text-amber-600 dark:text-amber-400"
          title="Mint Native Tokens"
          subtitle="Issue new native tokens to any address on this L1"
          precompileAddress={DEFAULT_NATIVE_MINTER_ADDRESS}
          minimumRole={1}
          roleRefreshKey={roleRefreshKey}
          onRoleChange={setRole}
        >
          {/* Permission warning — explains the failed-tx case */}
          {role === 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="text-xs text-red-700 dark:text-red-300">
                Your wallet has <span className="font-semibold">no role</span> on the Native Minter allowlist. The
                transaction will revert. An existing Admin must call{' '}
                <code className="font-mono px-1 rounded bg-red-100/60 dark:bg-red-900/40">setEnabled</code> for your
                address — open the
                <span className="font-medium"> Manage Allowlist Roles</span> section below.
              </div>
            </div>
          )}

          <EVMAddressInput label="Recipient Address" value={recipient} onChange={setRecipient} disabled={isMinting} />

          <Input
            label="Amount"
            value={amount}
            onChange={setAmount}
            type="number"
            min="0"
            step="0.000000000000000001"
            disabled={isMinting}
            helperText={
              previewWei
                ? `${formatEther(BigInt(previewWei))} native tokens (${previewWei} wei)`
                : 'Amount in native token units (e.g. AVAX)'
            }
          />

          {txError && (
            <div className="p-3 text-xs text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800 whitespace-pre-line">
              {txError}
            </div>
          )}

          {txHash && <ResultField label="Transaction Successful" value={txHash} showCheck={true} />}

          <Button variant="primary" onClick={handleMint} loading={isMinting} disabled={!canMint}>
            {!walletEVMAddress ? 'Connect Wallet to Mint' : !hasPermission ? 'Insufficient Role' : 'Mint Native Tokens'}
          </Button>
        </PrecompileCard>
      </PrecompileCodeViewer>
    </CheckPrecompile>
  );
}

export default withConsoleToolMetadata(NativeMinter, metadata);
