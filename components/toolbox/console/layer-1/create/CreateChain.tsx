'use client';

import { useCreateChainStore } from '@/components/toolbox/stores/createChainStore';
import { useEffect, useState, useRef } from 'react';
import { GenesisBuilderInner } from '@/components/toolbox/console/layer-1/create/GenesisBuilder';
import { Step, Steps } from '@/components/toolbox/components/Steps';
import { SUBNET_EVM_VM_ID } from '@/constants/console';
import {
  BaseConsoleToolProps,
  ConsoleToolMetadata,
  withConsoleToolMetadata,
} from '@/components/toolbox/components/WithConsoleToolMetadata';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { CoreWalletTransactionButton } from '@/components/toolbox/components/CoreWalletTransactionButton';
import { useSubmitPChainTx } from '@/components/toolbox/hooks/useSubmitPChainTx';
import { Success } from '@/components/toolbox/components/Success';
import { Alert } from '@/components/toolbox/components/Alert';
import { waitForPChainConfirmation } from '@/components/toolbox/utils/pchainConfirmation';
import { parsePChainError } from '@/components/toolbox/hooks/contracts/parsePChainError';

// Import Genesis Wizard components
import { GenesisWizard } from '@/components/toolbox/components/genesis/GenesisWizard';
import { ChainConfigStep, generateRandomChainName } from '@/components/toolbox/components/genesis/ChainConfigStep';
import type { PreinstallConfig } from '@/components/toolbox/components/genesis/types';
import { parseGenesisEvmChainId } from '@/lib/console/create-l1-chain';

const metadata: ConsoleToolMetadata = {
  title: 'Create Chain',
  description: (
    <>
      A{' '}
      <Link href="/docs/avalanche-l1s" className="text-primary hover:underline">
        chain
      </Link>{' '}
      is your L1 configuration running on a{' '}
      <Link href="/docs/avalanche-l1s" className="text-primary hover:underline">
        Subnet
      </Link>
      . A Subnet can have one or more chains, each with its own name,{' '}
      <Link
        href="/docs/avalanche-l1s/evm-configuration/customize-avalanche-l1"
        className="text-primary hover:underline"
      >
        virtual machine
      </Link>
      , and{' '}
      <Link href="/academy/avalanche-l1/avalanche-fundamentals" className="text-primary hover:underline">
        genesis parameters
      </Link>
      .
    </>
  ),
  toolRequirements: [WalletRequirementsConfigKey.WalletConnected],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

interface CreateChainProps extends BaseConsoleToolProps {
  embedded?: boolean;
  /**
   * Pre-deploy defaults forwarded to the underlying GenesisBuilder. The
   * user can still flip any toggle from the UI; this only seeds the
   * initial state. Used by the Create L1 flow to pre-fill based on the
   * questionnaire's interoperability answer.
   */
  preinstallDefaults?: Partial<PreinstallConfig>;
  /**
   * When `false`, strips the Warp precompile from the generated genesis.
   * Defaults to `true` for backwards compatibility.
   */
  warpEnabled?: boolean;
}

function CreateChain({ onSuccess: _onSuccess, embedded = false, preinstallDefaults, warpEnabled }: CreateChainProps) {
  const store = useCreateChainStore();
  const subnetId = store((state) => state.subnetId);
  const chainID = store((state) => state.chainID);
  const chainName = store((state) => state.chainName);
  const setChainID = store((state) => state.setChainID);
  const genesisData = store((state) => state.genesisData);
  const setGenesisData = store((state) => state.setGenesisData);
  const setChainName = store((state) => state.setChainName);
  const storedEvmChainId = store((state) => state.evmChainId);
  const setEvmChainId = store((state) => state.setEvmChainId);

  const coreWalletClient = useWalletStore((s) => s.coreWalletClient);
  const { isTestnet } = useWalletStore();
  const { notify } = useConsoleNotifications();
  const { submitPChainTx } = useSubmitPChainTx();

  const [isCreatingChain, setIsCreatingChain] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [issuedTxId, setIssuedTxId] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [localChainName, setLocalChainName] = useState<string>(generateRandomChainName());
  const [vmId, setVmId] = useState<string>(SUBNET_EVM_VM_ID);
  const prevVmIdRef = useRef(vmId);

  useEffect(() => {
    const genesisEvmChainId = parseGenesisEvmChainId(genesisData);
    if (genesisEvmChainId !== null && genesisEvmChainId !== storedEvmChainId) {
      setEvmChainId(genesisEvmChainId);
    }
  }, [genesisData, setEvmChainId, storedEvmChainId]);

  // Clear genesis data when switching FROM Subnet-EVM TO custom VM
  const handleVmIdChange = (newVmId: string) => {
    if (prevVmIdRef.current === SUBNET_EVM_VM_ID && newVmId !== SUBNET_EVM_VM_ID) {
      setGenesisData('');
    }
    prevVmIdRef.current = newVmId;
    setVmId(newVmId);
  };

  async function handleCreateChain() {
    if (!coreWalletClient) return;

    setIssuedTxId('');
    setCreateError(null);
    setIsCreatingChain(true);

    let txID: string | null = null;
    try {
      txID = await submitPChainTx(async (client) => {
        const createChainTx = client.createChain({
          chainName: localChainName,
          subnetId: subnetId,
          vmId,
          fxIds: [],
          genesisData: genesisData,
          subnetAuth: [0],
        });

        notify('createChain', createChainTx);

        return createChainTx;
      });

      // Don't hand the Chain ID downstream until the P-Chain accepts the tx:
      // ConvertSubnetToL1 and the node bootstrap both need a Committed chain.
      setIsConfirming(true);
      await waitForPChainConfirmation(txID, isTestnet);

      setChainID(txID);
      setChainName(localChainName);
      setLocalChainName(generateRandomChainName());
    } catch (err) {
      // Keep an issued-but-unconfirmed txID visible so the user can track it. It
      // stays out of the store on purpose: ConvertSubnetToL1 must not run against
      // a chain the P-Chain hasn't accepted.
      if (txID) setIssuedTxId(txID);
      setCreateError(parsePChainError(err));
    } finally {
      setIsConfirming(false);
      setIsCreatingChain(false);
    }
  }

  const hasSubnet = !!subnetId;
  const canProceedToStep2 = hasSubnet && !!localChainName;
  const canProceedToStep3 =
    canProceedToStep2 && !!genesisData && genesisData !== '' && !genesisData.startsWith('Error:');
  const canCreateChain = canProceedToStep3;

  // Show warning if no subnet selected
  if (!hasSubnet) {
    return (
      <div className="flex flex-col items-start gap-2 border border-zinc-200 bg-white/80 px-5 py-6 dark:border-zinc-800 dark:bg-zinc-950/80">
        <p className="flex items-center gap-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          No Subnet Selected
        </p>
        <p className="max-w-xl text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          Please create or select a subnet with the Create Subnet tool before configuring your chain.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Steps>
        {/* Step 1: Chain Configuration */}
        <Step>
          <div>
            <h2 className="text-sm font-semibold mb-1">Chain Configuration</h2>
            <p className="text-xs text-muted-foreground">Configure your chain name and virtual machine.</p>
          </div>
          <ChainConfigStep
            chainName={localChainName}
            onChainNameChange={setLocalChainName}
            vmId={vmId}
            onVmIdChange={handleVmIdChange}
          />
        </Step>

        {/* Step 2: Genesis Configuration */}
        <Step>
          <div>
            <h2 className="text-sm font-semibold mb-1">Genesis Configuration</h2>
            <p className="text-xs text-muted-foreground">
              {vmId === SUBNET_EVM_VM_ID
                ? 'Configure the genesis parameters for your chain.'
                : 'Provide the genesis JSON for your custom virtual machine.'}
            </p>
          </div>
          {!canProceedToStep2 ? (
            <div className="flex flex-col gap-1.5 border border-zinc-200 px-5 py-5 dark:border-zinc-800">
              <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                Configure Chain First
              </p>
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                Please configure your chain name in Step 1 before proceeding.
              </p>
            </div>
          ) : vmId === SUBNET_EVM_VM_ID ? (
            // For Subnet-EVM, use the GenesisBuilder
            <GenesisWizard genesisData={genesisData} onGenesisDataChange={setGenesisData} embedded={embedded}>
              <GenesisBuilderInner
                genesisData={genesisData}
                setGenesisData={setGenesisData}
                initiallyExpandedSections={['chainParams']}
                preinstallDefaults={preinstallDefaults}
                warpEnabled={warpEnabled}
              />
            </GenesisWizard>
          ) : (
            // For custom VMs, provide a simple JSON input
            <div className="space-y-4">
              <Alert variant="warning">
                <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em]">Custom Virtual Machine</p>
                <p className="mt-1">You're using a custom VM. Please provide your own genesis JSON configuration.</p>
              </Alert>

              <div>
                <label className="mb-2 block font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                  Genesis JSON
                </label>
                <textarea
                  className="h-96 w-full resize-none border border-zinc-200 bg-zinc-950 px-4 py-3 font-mono text-[12px] text-zinc-100 transition-colors hover:border-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-800 dark:hover:border-zinc-600 dark:focus:border-zinc-300"
                  placeholder='{"config": {...}, "alloc": {...}, ...}'
                  value={genesisData}
                  onChange={(e) => setGenesisData(e.target.value)}
                />
                {genesisData &&
                  (() => {
                    try {
                      JSON.parse(genesisData);
                      return (
                        <p className="mt-2 font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                          ✓ Valid JSON ({(new Blob([genesisData]).size / 1024).toFixed(2)} KiB)
                        </p>
                      );
                    } catch (e) {
                      return (
                        <p className="mt-2 font-mono text-[11px] text-red-700 dark:text-red-400">
                          ✗ Invalid JSON: {(e as Error).message}
                        </p>
                      );
                    }
                  })()}
              </div>
            </div>
          )}
        </Step>

        {/* Step 3: Create Blockchain */}
        <Step>
          <div>
            <h2 className="text-sm font-semibold mb-1">Create Chain</h2>
            <p className="text-xs text-muted-foreground">
              Issues a{' '}
              <Link
                href="/docs/rpcs/p-chain/txn-format#unsigned-create-chain-tx"
                className="text-primary hover:underline"
              >
                CreateChainTx
              </Link>{' '}
              on the P-Chain.
            </p>
          </div>
          {!canProceedToStep3 ? (
            <div className="flex flex-col gap-1.5 border border-zinc-200 px-5 py-5 dark:border-zinc-800">
              <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                Configure Genesis First
              </p>
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                Please complete the genesis configuration in Step 2 before creating your chain.
              </p>
            </div>
          ) : (
            <CoreWalletTransactionButton
              onClick={handleCreateChain}
              loading={isCreatingChain || isConfirming}
              loadingText={isConfirming ? 'Confirming...' : 'Creating Chain...'}
              // A CreateChainTx is already out there: a second click would issue another one
              disabled={!canCreateChain || !!issuedTxId}
              className="w-full"
              cliCommand={`platform-cli chain create --subnet-id ${subnetId || '<subnet-id>'} --genesis ./genesis.json --name "${localChainName}"${vmId !== SUBNET_EVM_VM_ID ? ` --vm-id ${vmId}` : ''} --network ${isTestnet ? 'fuji' : 'mainnet'}`}
              downloadFile={genesisData ? { data: genesisData, filename: 'genesis.json' } : undefined}
            >
              Create Chain
            </CoreWalletTransactionButton>
          )}

          {chainID && (
            <div className="mt-4">
              <Success
                label={`Chain${chainName ? ` "${chainName}"` : ''} created (CreateChainTx ID)`}
                value={chainID}
                isTestnet={Boolean(isTestnet)}
                confirmed={true}
              />
            </div>
          )}

          {issuedTxId && (
            <div className="mt-4">
              <Success
                label="CreateChainTx ID (not confirmed)"
                value={issuedTxId}
                isTestnet={isTestnet}
                confirmed={false}
              />
            </div>
          )}

          {createError && (
            <div className="mt-4">
              <Alert variant="error">
                {createError}
                {issuedTxId && (
                  <p className="mt-2">
                    The transaction was issued and may still be committed on the P-Chain. Check the CreateChainTx ID
                    above before you issue another one.
                  </p>
                )}
              </Alert>
            </div>
          )}
        </Step>
      </Steps>
    </div>
  );
}

export { CreateChain };
export default withConsoleToolMetadata(CreateChain, metadata);
