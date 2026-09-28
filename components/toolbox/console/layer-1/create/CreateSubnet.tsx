'use client';

import { useState } from 'react';
import { useCreateChainStore } from '@/components/toolbox/stores/createChainStore';
import InputSubnetId from '@/components/toolbox/components/InputSubnetId';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import {
  BaseConsoleToolProps,
  ConsoleToolMetadata,
  withConsoleToolMetadata,
} from '@/components/toolbox/components/WithConsoleToolMetadata';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import Link from 'next/link';
import { CoreWalletTransactionButton } from '@/components/toolbox/components/CoreWalletTransactionButton';
import { useSubmitPChainTx } from '@/components/toolbox/hooks/useSubmitPChainTx';
import { Success } from '@/components/toolbox/components/Success';
import { Alert } from '@/components/toolbox/components/Alert';
import { waitForPChainConfirmation } from '@/components/toolbox/utils/pchainConfirmation';
import { parsePChainError } from '@/components/toolbox/hooks/contracts/parsePChainError';

const metadata: ConsoleToolMetadata = {
  title: 'Create Subnet',
  description: (
    <>
      Every{' '}
      <Link href="/docs/avalanche-l1s" className="text-primary hover:underline">
        Layer 1
      </Link>{' '}
      blockchain is validated by exactly one{' '}
      <Link href="/docs/avalanche-l1s" className="text-primary hover:underline">
        Subnet
      </Link>
      . Issues a{' '}
      <Link href="/docs/rpcs/p-chain/txn-format#unsigned-create-subnet-tx" className="text-primary hover:underline">
        CreateSubnetTx
      </Link>{' '}
      on the P-Chain.
    </>
  ),
  toolRequirements: [WalletRequirementsConfigKey.WalletConnected],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function CreateSubnet(_props: BaseConsoleToolProps) {
  const store = useCreateChainStore();
  const subnetId = store((state) => state.subnetId);
  const setSubnetID = store((state) => state.setSubnetID);

  const { pChainAddress, isTestnet } = useWalletStore();
  const coreWalletClient = useWalletStore((s) => s.coreWalletClient);
  const { notify } = useConsoleNotifications();
  const { submitPChainTx } = useSubmitPChainTx();
  const [isCreatingSubnet, setIsCreatingSubnet] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [issuedTxId, setIssuedTxId] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreateSubnet() {
    if (!coreWalletClient) return;

    setIssuedTxId('');
    setCreateError(null);
    setIsCreatingSubnet(true);

    let txID: string | null = null;
    try {
      txID = await submitPChainTx(async (client) => {
        const createSubnetTx = client.createSubnet({
          subnetOwners: [pChainAddress],
        });

        notify('createSubnet', createSubnetTx);

        return createSubnetTx;
      });

      // Don't hand the Subnet ID downstream until the P-Chain accepts the tx:
      // CreateChainTx and every Glacier lookup need a Committed subnet.
      setIsConfirming(true);
      await waitForPChainConfirmation(txID, isTestnet);

      setSubnetID(txID);
    } catch (err) {
      // Keep an issued-but-unconfirmed txID visible so the user can track it and
      // paste it below once it commits. It stays out of the store on purpose:
      // downstream steps must not run against a subnet the P-Chain hasn't accepted.
      if (txID) setIssuedTxId(txID);
      setCreateError(parsePChainError(err));
    } finally {
      setIsConfirming(false);
      setIsCreatingSubnet(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Create Subnet — primary action */}
      <CoreWalletTransactionButton
        onClick={handleCreateSubnet}
        loading={isCreatingSubnet || isConfirming}
        loadingText={isConfirming ? 'Confirming...' : 'Creating...'}
        // A CreateSubnetTx is already out there: a second click would issue another one
        disabled={!!issuedTxId}
        variant="primary"
        className="w-full"
        cliCommand={`platform-cli subnet create --network ${isTestnet ? 'fuji' : 'mainnet'}`}
      >
        Create Subnet
      </CoreWalletTransactionButton>

      {subnetId && (
        <Success label="Subnet ID (CreateSubnetTx)" value={subnetId} isTestnet={Boolean(isTestnet)} confirmed={true} />
      )}

      {issuedTxId && (
        <Success
          label="Subnet ID (CreateSubnetTx, not confirmed)"
          value={issuedTxId}
          isTestnet={isTestnet}
          confirmed={false}
        />
      )}

      {createError && (
        <Alert variant="error">
          {createError}
          {issuedTxId && (
            <p className="mt-2">
              The transaction was issued and may still be committed on the P-Chain. Check the Subnet ID above before you
              issue another one.
            </p>
          )}
        </Alert>
      )}

      {/* "or" divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-3 text-xs text-muted-foreground uppercase tracking-wider">or</span>
        </div>
      </div>

      {/* Paste Subnet ID — fallback for CLI users */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Already have a Subnet ID?</p>
        <p className="text-xs text-muted-foreground">
          If you created a subnet via the platform-cli or already own one, paste the Subnet ID below.
        </p>
        <InputSubnetId
          id="create-subnet-id"
          label=""
          value={subnetId}
          onChange={setSubnetID}
          validationDelayMs={3000}
          hideSuggestions={true}
          placeholder="Paste Subnet ID"
        />
      </div>
    </div>
  );
}

export { CreateSubnet };
export default withConsoleToolMetadata(CreateSubnet, metadata);
