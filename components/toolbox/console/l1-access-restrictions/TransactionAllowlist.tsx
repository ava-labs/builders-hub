'use client';

import { useState } from 'react';
import { AllowlistRoleManager } from '@/components/toolbox/components/AllowListComponents';
import { CheckPrecompile } from '@/components/toolbox/components/CheckPrecompile';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import {
  BaseConsoleToolProps,
  ConsoleToolMetadata,
  withConsoleToolMetadata,
} from '../../components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import { PrecompileCodeViewer } from '@/components/console/precompile-code-viewer';
import { PrecompileCard } from '@/components/toolbox/components/PrecompileCard';
import type { PrecompileRole } from '@/components/toolbox/components/PrecompileRoleBadge';
import { ArrowRightLeft, AlertTriangle } from 'lucide-react';

const DEFAULT_TRANSACTION_ALLOWLIST_ADDRESS = '0x0200000000000000000000000000000000000002';

const metadata: ConsoleToolMetadata = {
  title: 'Transaction Allowlist',
  description: 'Manage addresses allowed to send transactions on your L1',
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function TransactionAllowlist({ onSuccess }: BaseConsoleToolProps) {
  const [highlightFunction, setHighlightFunction] = useState<string>('setEnabled');
  const [role, setRole] = useState<PrecompileRole | null>(null);
  const [roleRefreshKey, setRoleRefreshKey] = useState(0);

  const hasManagerOrAbove = role !== null && (role === 2 || role === 3);

  return (
    <CheckPrecompile configKey="txAllowListConfig" precompileName="Transaction Allowlist">
      <PrecompileCodeViewer precompileName="TxAllowList" highlightFunction={highlightFunction}>
        <PrecompileCard
          icon={ArrowRightLeft}
          iconWrapperClass="bg-teal-100 dark:bg-teal-900/30"
          iconClass="text-teal-600 dark:text-teal-400"
          title="Transaction Permissions"
          subtitle="Grant or revoke transaction-sending rights for any address"
          precompileAddress={DEFAULT_TRANSACTION_ALLOWLIST_ADDRESS}
          minimumRole={2}
          roleRefreshKey={roleRefreshKey}
          onRoleChange={setRole}
        >
          {role === 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="text-xs text-red-700 dark:text-red-300">
                Your wallet has no role on the Transaction Allowlist. Only existing Admin/Manager addresses can grant or
                revoke roles — your transactions will revert.
              </div>
            </div>
          )}
          {role === 1 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/50">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-700 dark:text-amber-300">
                You have <span className="font-semibold">Enabled</span> role — you can send transactions but cannot
                grant or revoke other addresses' permissions. Manager or Admin role is required.
              </div>
            </div>
          )}

          <AllowlistRoleManager
            precompileAddress={DEFAULT_TRANSACTION_ALLOWLIST_ADDRESS}
            precompileType="Transaction"
            onSuccess={() => {
              setRoleRefreshKey((k) => k + 1);
              onSuccess?.();
            }}
            onFunctionChange={setHighlightFunction}
          />

          {!hasManagerOrAbove && role !== 0 && role !== null && (
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Setting a role requires at least <span className="font-medium">Manager</span> permission on this
              allowlist.
            </p>
          )}
        </PrecompileCard>
      </PrecompileCodeViewer>
    </CheckPrecompile>
  );
}

export default withConsoleToolMetadata(TransactionAllowlist, metadata);
