'use client';

import { useEffect, useState } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { ResultField } from '@/components/toolbox/components/ResultField';
import feeManagerAbi from '@/contracts/precompiles/FeeManager.json';
import { AllowlistComponent } from '@/components/toolbox/components/AllowListComponents';
import { CheckPrecompile } from '@/components/toolbox/components/CheckPrecompile';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import {
  BaseConsoleToolProps,
  ConsoleToolMetadata,
  withConsoleToolMetadata,
} from '../../components/WithConsoleToolMetadata';
import { useContractActions } from '@/components/toolbox/hooks/contracts/useContractActions';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import { PrecompileCodeViewer } from '@/components/console/precompile-code-viewer';
import { PrecompileCard, StateGroup, StateRow } from '@/components/toolbox/components/PrecompileCard';
import type { PrecompileRole } from '@/components/toolbox/components/PrecompileRoleBadge';
import { Settings, RefreshCw, Eye, Pencil, AlertTriangle } from 'lucide-react';
import { cn } from '@/components/toolbox/lib/utils';

const DEFAULT_FEE_MANAGER_ADDRESS = '0x0200000000000000000000000000000000000003';

const metadata: ConsoleToolMetadata = {
  title: 'Fee Manager',
  description: 'Configure dynamic fee parameters and manage allowlist for your L1',
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

type Tab = 'view' | 'edit';

interface FeeConfig {
  gasLimit: string;
  targetBlockRate: string;
  minBaseFee: string;
  targetGas: string;
  baseFeeChangeDenominator: string;
  minBlockGasCost: string;
  maxBlockGasCost: string;
  blockGasCostStep: string;
}

const DEFAULT_CONFIG: FeeConfig = {
  gasLimit: '20000000',
  targetBlockRate: '2',
  minBaseFee: '25000000000',
  targetGas: '15000000',
  baseFeeChangeDenominator: '48',
  minBlockGasCost: '0',
  maxBlockGasCost: '10000000',
  blockGasCostStep: '500000',
};

function formatGwei(wei: string) {
  try {
    const gwei = Number(BigInt(wei)) / 1e9;
    return `${gwei.toLocaleString(undefined, { maximumFractionDigits: 4 })} Gwei`;
  } catch {
    return wei;
  }
}

function FeeManager({ onSuccess }: BaseConsoleToolProps) {
  const { publicClient, walletEVMAddress } = useWalletStore();

  const [activeTab, setActiveTab] = useState<Tab>('view');
  const [config, setConfig] = useState<FeeConfig>(DEFAULT_CONFIG);
  const [currentConfig, setCurrentConfig] = useState<FeeConfig | null>(null);
  const [lastChangedAt, setLastChangedAt] = useState<number | null>(null);

  const [isSettingConfig, setIsSettingConfig] = useState(false);
  const [isReadingConfig, setIsReadingConfig] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const [role, setRole] = useState<PrecompileRole | null>(null);
  const [roleRefreshKey, setRoleRefreshKey] = useState(0);

  // Routes the setFeeConfig tx through the canonical write path so it
  // pre-flight simulates, fires the console toast, and lands a row in
  // the tx-history store. Replaces the previous raw
  // walletClient.writeContract path that was invisible to the console
  // history panel.
  const actions = useContractActions(DEFAULT_FEE_MANAGER_ADDRESS, feeManagerAbi.abi);

  const handleGetFeeConfig = async () => {
    setIsReadingConfig(true);
    setTxError(null);
    try {
      const result = (await publicClient.readContract({
        address: DEFAULT_FEE_MANAGER_ADDRESS as `0x${string}`,
        abi: feeManagerAbi.abi,
        functionName: 'getFeeConfig',
      })) as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];

      const next: FeeConfig = {
        gasLimit: result[0].toString(),
        targetBlockRate: result[1].toString(),
        minBaseFee: result[2].toString(),
        targetGas: result[3].toString(),
        baseFeeChangeDenominator: result[4].toString(),
        minBlockGasCost: result[5].toString(),
        maxBlockGasCost: result[6].toString(),
        blockGasCostStep: result[7].toString(),
      };
      setCurrentConfig(next);
      // Pre-populate the edit form with the current on-chain values for easy tweaking.
      setConfig(next);

      const lastChanged = await publicClient.readContract({
        address: DEFAULT_FEE_MANAGER_ADDRESS as `0x${string}`,
        abi: feeManagerAbi.abi,
        functionName: 'getFeeConfigLastChangedAt',
      });
      setLastChangedAt(Number(lastChanged));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to read fee config';
      setTxError(msg);
    } finally {
      setIsReadingConfig(false);
    }
  };

  // Auto-load current config on mount.
  useEffect(() => {
    handleGetFeeConfig();
  }, []);

  const handleSetFeeConfig = async () => {
    setIsSettingConfig(true);
    setTxError(null);
    setTxHash(null);

    try {
      const hash = await actions.write(
        'setFeeConfig',
        [
          BigInt(config.gasLimit),
          BigInt(config.targetBlockRate),
          BigInt(config.minBaseFee),
          BigInt(config.targetGas),
          BigInt(config.baseFeeChangeDenominator),
          BigInt(config.minBlockGasCost),
          BigInt(config.maxBlockGasCost),
          BigInt(config.blockGasCostStep),
        ],
        'Update L1 fee config',
      );

      // Local receipt wait — we still need to know when the chain
      // settled so we can refresh the on-chain config and role badge.
      const receipt = await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });

      if (receipt.status === 'success') {
        setTxHash(hash);
        setRoleRefreshKey((k) => k + 1);
        await handleGetFeeConfig();
        onSuccess?.();
      } else {
        setTxError('Transaction reverted on-chain. The wallet likely lacks Enabled role on the Fee Manager allowlist.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to set fee config';
      if (msg.toLowerCase().includes('revert') || msg.toLowerCase().includes('not allowed')) {
        setTxError(`${msg}\n\nMake sure your wallet has Enabled/Manager/Admin role on the Fee Manager allowlist.`);
      } else {
        setTxError(msg);
      }
    } finally {
      setIsSettingConfig(false);
    }
  };

  const hasPermission = role !== null && role >= 1;
  const canSetFeeConfig = Boolean(walletEVMAddress && actions.isReady && !isSettingConfig && hasPermission);

  return (
    <CheckPrecompile configKey="feeManagerConfig" precompileName="Fee Manager">
      <PrecompileCodeViewer
        precompileName="FeeManager"
        highlightFunction={activeTab === 'view' ? 'getFeeConfig' : 'setFeeConfig'}
        collapsibleSections={[
          {
            title: 'Manage Allowlist Roles',
            defaultOpen: false,
            children: (
              <AllowlistComponent
                precompileAddress={DEFAULT_FEE_MANAGER_ADDRESS}
                precompileType="Fee Manager"
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
          icon={Settings}
          iconWrapperClass="bg-blue-100 dark:bg-blue-900/30"
          iconClass="text-blue-600 dark:text-blue-400"
          title="Fee Configuration"
          subtitle="Read or update dynamic fee parameters for this L1"
          precompileAddress={DEFAULT_FEE_MANAGER_ADDRESS}
          minimumRole={1}
          roleRefreshKey={roleRefreshKey}
          onRoleChange={setRole}
          tabs={[
            { id: 'view', label: 'Current Config', icon: Eye },
            { id: 'edit', label: 'Update Config', icon: Pencil },
          ]}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as Tab)}
          footer={
            lastChangedAt !== null ? (
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Last changed at block{' '}
                <span className="font-mono text-zinc-700 dark:text-zinc-300">{lastChangedAt.toLocaleString()}</span>
              </p>
            ) : undefined
          }
        >
          {activeTab === 'view' && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Live values from <code className="font-mono">getFeeConfig()</code>
                </p>
                <button
                  onClick={handleGetFeeConfig}
                  disabled={isReadingConfig}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-[11px] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={cn('w-3 h-3', isReadingConfig && 'animate-spin')} />
                  Refresh
                </button>
              </div>

              {currentConfig ? (
                <>
                  <StateGroup title="Gas Limits">
                    <StateRow label="Gas Limit" value={Number(currentConfig.gasLimit).toLocaleString()} />
                    <StateRow label="Target Gas" value={Number(currentConfig.targetGas).toLocaleString()} />
                  </StateGroup>
                  <StateGroup title="Block Rate">
                    <StateRow label="Target Block Rate" value={`${currentConfig.targetBlockRate}s`} />
                    <StateRow label="Base Fee Change Denominator" value={currentConfig.baseFeeChangeDenominator} />
                  </StateGroup>
                  <StateGroup title="Block Gas Cost">
                    <StateRow
                      label="Minimum Base Fee"
                      value={formatGwei(currentConfig.minBaseFee)}
                      hint={`${currentConfig.minBaseFee} wei`}
                    />
                    <StateRow
                      label="Min Block Gas Cost"
                      value={Number(currentConfig.minBlockGasCost).toLocaleString()}
                    />
                    <StateRow
                      label="Max Block Gas Cost"
                      value={Number(currentConfig.maxBlockGasCost).toLocaleString()}
                    />
                    <StateRow
                      label="Block Gas Cost Step"
                      value={Number(currentConfig.blockGasCostStep).toLocaleString()}
                    />
                  </StateGroup>
                </>
              ) : (
                <div className="py-6 flex justify-center">
                  <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Reading config…</span>
                  </div>
                </div>
              )}

              {txError && (
                <div className="p-3 text-xs text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800 whitespace-pre-line">
                  {txError}
                </div>
              )}
            </>
          )}

          {activeTab === 'edit' && (
            <>
              {role === 0 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-red-700 dark:text-red-300">
                    Your wallet has <span className="font-semibold">no role</span> on the Fee Manager allowlist — the
                    transaction will revert. Use the <span className="font-medium">Manage Allowlist Roles</span> section
                    below if you have an Admin available.
                  </div>
                </div>
              )}

              <StateGroup title="Gas Limits" description="Maximum and target gas for blocks">
                <Input
                  label="Gas Limit"
                  value={config.gasLimit}
                  onChange={(v) => setConfig({ ...config, gasLimit: v })}
                  type="number"
                  min="0"
                  disabled={isSettingConfig}
                  helperText={
                    Number(config.gasLimit) < 15_000_000 || Number(config.gasLimit) > 30_000_000
                      ? 'Expected value between 15,000,000 and 30,000,000'
                      : undefined
                  }
                />
                <Input
                  label="Target Gas"
                  value={config.targetGas}
                  onChange={(v) => setConfig({ ...config, targetGas: v })}
                  type="number"
                  min="0"
                  disabled={isSettingConfig}
                  helperText={
                    Number(config.targetGas) < 1_000_000 || Number(config.targetGas) > 50_000_000
                      ? 'Expected value between 1,000,000 and 50,000,000'
                      : undefined
                  }
                />
              </StateGroup>

              <StateGroup title="Block Rate" description="Target block production rate and fee adjustment">
                <Input
                  label="Target Block Rate (seconds)"
                  value={config.targetBlockRate}
                  onChange={(v) => setConfig({ ...config, targetBlockRate: v })}
                  type="number"
                  min="0"
                  disabled={isSettingConfig}
                  helperText={
                    Number(config.targetBlockRate) < 1 || Number(config.targetBlockRate) > 10
                      ? 'Expected value between 1 and 10 seconds'
                      : undefined
                  }
                />
                <Input
                  label="Base Fee Change Denominator"
                  value={config.baseFeeChangeDenominator}
                  onChange={(v) => setConfig({ ...config, baseFeeChangeDenominator: v })}
                  type="number"
                  min="0"
                  disabled={isSettingConfig}
                  helperText={
                    Number(config.baseFeeChangeDenominator) < 8 || Number(config.baseFeeChangeDenominator) > 1000
                      ? 'Expected value between 8 and 1,000'
                      : undefined
                  }
                />
              </StateGroup>

              <StateGroup title="Block Gas Cost" description="Minimum base fee and block gas cost parameters">
                <Input
                  label="Minimum Base Fee (wei)"
                  value={config.minBaseFee}
                  onChange={(v) => setConfig({ ...config, minBaseFee: v })}
                  type="number"
                  min="0"
                  disabled={isSettingConfig}
                  helperText={`${formatGwei(config.minBaseFee)} — expected 1–500 Gwei`}
                />
                <Input
                  label="Minimum Block Gas Cost"
                  value={config.minBlockGasCost}
                  onChange={(v) => setConfig({ ...config, minBlockGasCost: v })}
                  type="number"
                  min="0"
                  disabled={isSettingConfig}
                />
                <Input
                  label="Maximum Block Gas Cost"
                  value={config.maxBlockGasCost}
                  onChange={(v) => setConfig({ ...config, maxBlockGasCost: v })}
                  type="number"
                  min="0"
                  disabled={isSettingConfig}
                />
                <Input
                  label="Block Gas Cost Step"
                  value={config.blockGasCostStep}
                  onChange={(v) => setConfig({ ...config, blockGasCostStep: v })}
                  type="number"
                  min="0"
                  disabled={isSettingConfig}
                />
              </StateGroup>

              {txError && (
                <div className="p-3 text-xs text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800 whitespace-pre-line">
                  {txError}
                </div>
              )}

              {txHash && <ResultField label="Transaction Successful" value={txHash} showCheck={true} />}

              <Button
                onClick={handleSetFeeConfig}
                loading={isSettingConfig}
                variant="primary"
                disabled={!canSetFeeConfig}
              >
                {!walletEVMAddress
                  ? 'Connect Wallet'
                  : !hasPermission
                    ? 'Insufficient Role'
                    : 'Submit Fee Configuration'}
              </Button>
            </>
          )}
        </PrecompileCard>
      </PrecompileCodeViewer>
    </CheckPrecompile>
  );
}

export default withConsoleToolMetadata(FeeManager, metadata);
