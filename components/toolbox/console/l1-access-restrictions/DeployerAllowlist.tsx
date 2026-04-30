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
import { FileCode, AlertTriangle } from 'lucide-react';

const DEFAULT_DEPLOYER_ALLOWLIST_ADDRESS = '0x0200000000000000000000000000000000000000';

const metadata: ConsoleToolMetadata = {
  title: 'Deployer Allowlist',
  description: 'Control which addresses can deploy smart contracts on your L1',
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function DeployerAllowlist({ onSuccess }: BaseConsoleToolProps) {
  const [highlightFunction, setHighlightFunction] = useState<string>('setEnabled');
  const [role, setRole] = useState<PrecompileRole | null>(null);
  const [roleRefreshKey, setRoleRefreshKey] = useState(0);

  // To grant Enabled/None roles you need Manager or Admin (≥2). To grant Admin you need Admin (=2).
  // We surface a warning at None.
  const hasManagerOrAbove = role !== null && (role === 2 || role === 3);

  return (
    <CheckPrecompile configKey="contractDeployerAllowListConfig" precompileName="Deployer Allowlist">
      <PrecompileCodeViewer precompileName="ContractDeployerAllowList" highlightFunction={highlightFunction}>
        <PrecompileCard
          icon={FileCode}
          iconWrapperClass="bg-indigo-100 dark:bg-indigo-900/30"
          iconClass="text-indigo-600 dark:text-indigo-400"
          title="Contract Deployment Permissions"
          subtitle="Grant or revoke smart-contract deployment rights for any address"
          precompileAddress={DEFAULT_DEPLOYER_ALLOWLIST_ADDRESS}
          minimumRole={2}
          roleRefreshKey={roleRefreshKey}
          onRoleChange={setRole}
        >
          {role === 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="text-xs text-red-700 dark:text-red-300">
                Your wallet has no role on the Deployer Allowlist. Only existing Admin/Manager addresses can grant or
                revoke roles — your transactions will revert.
              </div>
            </div>
          )}
          {role === 1 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/50">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-700 dark:text-amber-300">
                You have <span className="font-semibold">Enabled</span> role — you can deploy contracts but cannot
                manage other addresses' roles. Manager or Admin role is required to grant/revoke roles.
              </div>
            </div>
          )}

          <AllowlistRoleManager
            precompileAddress={DEFAULT_DEPLOYER_ALLOWLIST_ADDRESS}
            precompileType="Deployer"
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

export default withConsoleToolMetadata(DeployerAllowlist, metadata);
