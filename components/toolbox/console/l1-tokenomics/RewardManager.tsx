'use client';

import { useEffect, useState } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { Button } from '@/components/toolbox/components/Button';
import { EVMAddressInput } from '@/components/toolbox/components/EVMAddressInput';
import { AllowlistComponent } from '@/components/toolbox/components/AllowListComponents';
import { ResultField } from '@/components/toolbox/components/ResultField';
import rewardManagerAbi from '@/contracts/precompiles/RewardManager.json';
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
import { PrecompileCard, StateRow, StateGroup } from '@/components/toolbox/components/PrecompileCard';
import type { PrecompileRole } from '@/components/toolbox/components/PrecompileRoleBadge';
import { Gift, Users, MapPin, XCircle, RefreshCw, AlertTriangle, Eye } from 'lucide-react';

const DEFAULT_REWARD_MANAGER_ADDRESS = '0x0200000000000000000000000000000000000004';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const TABS = [
  { id: 'view', label: 'Status', icon: Eye, function: 'currentRewardAddress' },
  { id: 'allow', label: 'Allow Recipients', icon: Users, function: 'allowFeeRecipients' },
  { id: 'set', label: 'Set Address', icon: MapPin, function: 'setRewardAddress' },
  { id: 'disable', label: 'Disable Rewards', icon: XCircle, function: 'disableRewards' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const metadata: ConsoleToolMetadata = {
  title: 'Reward Manager',
  description: 'Manage reward settings for the network including fee recipients and reward addresses',
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function RewardManager({ onSuccess }: BaseConsoleToolProps) {
  const { publicClient, walletEVMAddress } = useWalletStore();
  const { walletClient } = useConnectedWallet();
  const viemChain = useViemChainStore();

  const [activeTab, setActiveTab] = useState<TabId>('view');

  const [isProcessing, setIsProcessing] = useState(false);
  const [isReadingState, setIsReadingState] = useState(false);

  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [rewardAddress, setRewardAddress] = useState<string>('');
  const [isFeeRecipientsAllowed, setIsFeeRecipientsAllowed] = useState<boolean | null>(null);
  const [currentRewardAddress, setCurrentRewardAddress] = useState<string | null>(null);

  const [role, setRole] = useState<PrecompileRole | null>(null);
  const [roleRefreshKey, setRoleRefreshKey] = useState(0);

  const refreshState = async () => {
    setIsReadingState(true);
    setTxError(null);
    try {
      const [allowed, addr] = await Promise.all([
        publicClient.readContract({
          address: DEFAULT_REWARD_MANAGER_ADDRESS as `0x${string}`,
          abi: rewardManagerAbi.abi,
          functionName: 'areFeeRecipientsAllowed',
        }) as Promise<boolean>,
        publicClient.readContract({
          address: DEFAULT_REWARD_MANAGER_ADDRESS as `0x${string}`,
          abi: rewardManagerAbi.abi,
          functionName: 'currentRewardAddress',
        }) as Promise<string>,
      ]);
      setIsFeeRecipientsAllowed(allowed);
      setCurrentRewardAddress(addr);
    } catch (err) {
      setTxError(err instanceof Error ? err.message : 'Failed to read state');
    } finally {
      setIsReadingState(false);
    }
  };

  useEffect(() => {
    refreshState();
  }, []);

  const writeContract = async (functionName: string, args?: any[]) => {
    setIsProcessing(true);
    setTxError(null);
    setTxHash(null);

    try {
      if (!walletClient.account) throw new Error('Connect your wallet first');

      const hash = await walletClient.writeContract({
        address: DEFAULT_REWARD_MANAGER_ADDRESS as `0x${string}`,
        abi: rewardManagerAbi.abi,
        functionName,
        args,
        account: walletClient.account,
        chain: viemChain,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        setTxHash(hash);
        setRoleRefreshKey((k) => k + 1);
        await refreshState();
        onSuccess?.();
      } else {
        setTxError(
          'Transaction reverted on-chain. The wallet likely lacks Enabled role on the Reward Manager allowlist.',
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transaction failed';
      if (msg.toLowerCase().includes('revert') || msg.toLowerCase().includes('not allowed')) {
        setTxError(`${msg}\n\nMake sure your wallet has Enabled/Manager/Admin role on the Reward Manager allowlist.`);
      } else {
        setTxError(msg);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAllowFeeRecipients = () => writeContract('allowFeeRecipients');
  const handleDisableRewards = () => writeContract('disableRewards');
  const handleSetRewardAddress = () => {
    if (!rewardAddress) return;
    writeContract('setRewardAddress', [rewardAddress as `0x${string}`]);
  };

  const hasPermission = role !== null && role >= 1;

  const isFeeRecipientMode =
    isFeeRecipientsAllowed === true ||
    (currentRewardAddress && currentRewardAddress.toLowerCase() === ZERO_ADDRESS.toLowerCase());

  const currentTab = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  return (
    <CheckPrecompile configKey="rewardManagerConfig" precompileName="Reward Manager">
      <PrecompileCodeViewer
        precompileName="RewardManager"
        highlightFunction={currentTab.function}
        collapsibleSections={[
          {
            title: 'Manage Allowlist Roles',
            defaultOpen: false,
            children: (
              <AllowlistComponent
                precompileAddress={DEFAULT_REWARD_MANAGER_ADDRESS}
                precompileType="Reward Manager"
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
          icon={Gift}
          iconWrapperClass="bg-emerald-100 dark:bg-emerald-900/30"
          iconClass="text-emerald-600 dark:text-emerald-400"
          title="Reward Configuration"
          subtitle="Choose how transaction fees are distributed on this L1"
          precompileAddress={DEFAULT_REWARD_MANAGER_ADDRESS}
          minimumRole={1}
          roleRefreshKey={roleRefreshKey}
          onRoleChange={setRole}
          tabs={TABS.map((t) => ({ id: t.id, label: t.label, icon: t.icon }))}
          activeTab={activeTab}
          onTabChange={(id) => {
            setActiveTab(id as TabId);
            setTxHash(null);
            setTxError(null);
          }}
        >
          {role === 0 && activeTab !== 'view' && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="text-xs text-red-700 dark:text-red-300">
                Your wallet has no role on the Reward Manager allowlist — the transaction will revert.
              </div>
            </div>
          )}

          {activeTab === 'view' && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Live values from <code className="font-mono">currentRewardAddress()</code> +{' '}
                  <code className="font-mono">areFeeRecipientsAllowed()</code>
                </p>
                <button
                  onClick={refreshState}
                  disabled={isReadingState}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-[11px] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isReadingState ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              <StateGroup title="Active mode">
                <StateRow
                  label="Fee Recipients allowed"
                  value={isFeeRecipientsAllowed === null ? '—' : isFeeRecipientsAllowed ? 'Yes' : 'No'}
                  status={isFeeRecipientsAllowed ? 'active' : 'inactive'}
                />
                <StateRow
                  label="Reward Address"
                  value={
                    !currentRewardAddress
                      ? '—'
                      : currentRewardAddress.toLowerCase() === ZERO_ADDRESS.toLowerCase()
                        ? 'Burned (no recipient set)'
                        : currentRewardAddress
                  }
                  status={
                    !currentRewardAddress
                      ? 'inactive'
                      : currentRewardAddress.toLowerCase() === ZERO_ADDRESS.toLowerCase()
                        ? 'warning'
                        : 'active'
                  }
                />
              </StateGroup>

              <div className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {isFeeRecipientMode
                  ? 'Each validator may direct their share of fees to a recipient they specify.'
                  : currentRewardAddress
                    ? 'All transaction fees flow to the configured reward address.'
                    : 'Fees are currently being burned.'}
              </div>

              {txError && (
                <div className="p-3 text-xs text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800">
                  {txError}
                </div>
              )}
            </>
          )}

          {activeTab === 'allow' && (
            <>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Allow validators to specify their own fee recipient address. When enabled, each validator can direct
                transaction fees to their preferred address.
              </p>
              {txError && (
                <div className="p-3 text-xs text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800 whitespace-pre-line">
                  {txError}
                </div>
              )}
              {txHash && <ResultField label="Transaction Successful" value={txHash} showCheck={true} />}
              <Button
                variant="primary"
                onClick={handleAllowFeeRecipients}
                disabled={!walletEVMAddress || isProcessing || !hasPermission}
                loading={isProcessing}
              >
                <Users className="w-4 h-4 mr-2" />
                {!hasPermission ? 'Insufficient Role' : 'Allow Fee Recipients'}
              </Button>
            </>
          )}

          {activeTab === 'set' && (
            <>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Set a specific address to receive all block rewards. This address will receive all transaction fees from
                the network.
              </p>
              <EVMAddressInput
                label="Reward Address"
                value={rewardAddress}
                onChange={setRewardAddress}
                disabled={isProcessing}
              />
              {txError && (
                <div className="p-3 text-xs text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800 whitespace-pre-line">
                  {txError}
                </div>
              )}
              {txHash && <ResultField label="Transaction Successful" value={txHash} showCheck={true} />}
              <Button
                variant="primary"
                onClick={handleSetRewardAddress}
                disabled={!rewardAddress || !walletEVMAddress || isProcessing || !hasPermission}
                loading={isProcessing}
              >
                <MapPin className="w-4 h-4 mr-2" />
                {!hasPermission ? 'Insufficient Role' : 'Set Reward Address'}
              </Button>
            </>
          )}

          {activeTab === 'disable' && (
            <>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Disable reward distribution entirely. Transaction fees will be burned instead of being distributed to
                validators or a reward address.
              </p>
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  This will prevent any rewards from being distributed.
                </p>
              </div>
              {txError && (
                <div className="p-3 text-xs text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800 whitespace-pre-line">
                  {txError}
                </div>
              )}
              {txHash && <ResultField label="Transaction Successful" value={txHash} showCheck={true} />}
              <Button
                variant="secondary"
                onClick={handleDisableRewards}
                disabled={!walletEVMAddress || isProcessing || !hasPermission}
                loading={isProcessing}
              >
                <XCircle className="w-4 h-4 mr-2" />
                {!hasPermission ? 'Insufficient Role' : 'Disable Rewards'}
              </Button>
            </>
          )}
        </PrecompileCard>
      </PrecompileCodeViewer>
    </CheckPrecompile>
  );
}

export default withConsoleToolMetadata(RewardManager, metadata);
