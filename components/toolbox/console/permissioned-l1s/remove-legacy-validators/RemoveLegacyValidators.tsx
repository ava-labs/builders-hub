'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Layers, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/toolbox/components/Button';
import { Alert } from '@/components/toolbox/components/Alert';
import SelectSubnetId from '@/components/toolbox/components/SelectSubnetId';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useConnectedWallet } from '@/components/toolbox/contexts/ConnectedWalletContext';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import {
  BaseConsoleToolProps,
  ConsoleToolMetadata,
  withConsoleToolMetadata,
} from '@/components/toolbox/components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import { getGlacierNetwork } from '@/components/toolbox/utils/avalancheEndpoints';
import { useSubmitPChainTx } from '@/components/toolbox/hooks/useSubmitPChainTx';
import { CoreWalletTransactionButton } from '@/components/toolbox/components/CoreWalletTransactionButton';
import { PCHAIN_COMMANDS } from '@/components/toolbox/console/shared/pchainCommands';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { parsePChainError } from '@/components/toolbox/hooks/contracts';
import { waitForPChainConfirmation } from '@/components/toolbox/utils/pchainConfirmation';
import { getCurrentValidators, getSubnetInfo, type CurrentValidator, type SubnetInfo } from '@/lib/pchain-node';

/** Quorum the ValidatorManager requires of the L1's Warp signing set. */
const QUORUM_PERCENT = 67n;

/** getCurrentValidators returns legacy stakers with txID/endTime alongside
 *  L1 validators, which carry validationID instead. */
type SubnetValidator = CurrentValidator & { txID?: string; endTime?: string };

const metadata: ConsoleToolMetadata = {
  title: 'Remove Legacy Subnet Validators',
  description:
    'Remove leftover legacy Subnet validators from a converted L1. Converting a Subnet to an L1 does not remove validators added before the conversion, and their weight still counts toward the L1 Warp signing set.',
  toolRequirements: [WalletRequirementsConfigKey.WalletConnected],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

const stripPPrefix = (addr: string) => addr.replace(/^P-/i, '').toLowerCase();

const isL1Validator = (v: SubnetValidator) => Boolean(v.validationID);

const sumWeight = (vs: SubnetValidator[]) => vs.reduce((acc, v) => acc + BigInt(v.weight || '0'), 0n);

/** Share of `total` that `part` represents, as a display string. */
function sharePercent(part: bigint, total: bigint): string {
  if (total === 0n) return '0';
  // one decimal place without floating point drift on large weights
  const tenths = (part * 1000n) / total;
  return (Number(tenths) / 10).toFixed(1);
}

function RemoveLegacyValidators({ onSuccess }: BaseConsoleToolProps) {
  const { isTestnet, pChainAddress } = useWalletStore();
  const { coreWalletClient } = useConnectedWallet();
  const { submitPChainTx } = useSubmitPChainTx();
  const { notify } = useConsoleNotifications();

  const network = getGlacierNetwork(isTestnet);

  const [subnetId, setSubnetId] = useState('');
  const [validators, setValidators] = useState<SubnetValidator[] | null>(null);
  const [subnetInfo, setSubnetInfo] = useState<SubnetInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingNodeId, setPendingNodeId] = useState<string | null>(null);
  const [removedTxs, setRemovedTxs] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!subnetId) return;
    setIsLoading(true);
    setLoadError(null);
    setError(null);
    try {
      const [vs, info] = await Promise.all([getCurrentValidators(network, subnetId), getSubnetInfo(network, subnetId)]);
      if (!vs) throw new Error('P-Chain returned no validator set for this Subnet');
      setValidators(vs as SubnetValidator[]);
      setSubnetInfo(info);
    } catch (err) {
      setValidators(null);
      setSubnetInfo(null);
      setLoadError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [subnetId, network]);

  useEffect(() => {
    setValidators(null);
    setSubnetInfo(null);
    setRemovedTxs({});
    setError(null);
    setLoadError(null);
    if (subnetId) void load();
  }, [subnetId, network]);

  const legacy = (validators ?? []).filter((v) => !isL1Validator(v));
  const l1 = (validators ?? []).filter(isL1Validator);
  const remainingLegacy = legacy.filter((v) => !removedTxs[v.nodeID]);

  const totalWeight = sumWeight(validators ?? []);
  const l1Weight = sumWeight(l1);
  const legacyWeight = sumWeight(remainingLegacy);
  // Total once the still-present legacy validators are gone.
  const projectedTotal = totalWeight - legacyWeight;
  const l1MeetsQuorum = totalWeight > 0n && l1Weight * 100n >= totalWeight * QUORUM_PERCENT;

  // The connected wallet must be one of the Subnet owner's control keys.
  const controlKeys = subnetInfo?.controlKeys ?? [];
  const authIndex = pChainAddress ? controlKeys.findIndex((k) => stripPPrefix(k) === stripPPrefix(pChainAddress)) : -1;
  const isAuthorized = authIndex >= 0;

  const handleRemove = async (nodeId: string) => {
    if (!coreWalletClient || authIndex < 0) {
      setError('Connected wallet is not a Subnet owner for this Subnet');
      return;
    }
    setPendingNodeId(nodeId);
    setError(null);
    try {
      const hash = await submitPChainTx(async (client) => {
        const txPromise = client.removeSubnetValidator({
          subnetId,
          nodeId,
          subnetAuth: [authIndex],
        });
        notify('removeSubnetValidator', txPromise);
        return txPromise;
      });

      await waitForPChainConfirmation(hash, isTestnet);
      setRemovedTxs((prev) => ({ ...prev, [nodeId]: hash }));
      onSuccess?.();
    } catch (err) {
      console.error('Error removing subnet validator:', err);
      setError(parsePChainError(err));
    } finally {
      setPendingNodeId(null);
    }
  };

  return (
    <div className="space-y-4 w-full">
      <Alert variant="info">
        <span>
          Converting a Subnet to an L1 does <strong>not</strong> remove validators that were added beforehand. Those
          legacy validators keep contributing weight to the L1 Warp signing set, so if they are offline the weight you
          can collect signatures from may sit below the {String(QUORUM_PERCENT)}% quorum that{' '}
          <code>initializeValidatorSet</code> requires. Removing them lowers the total and restores the quorum.
        </span>
      </Alert>

      <SelectSubnetId value={subnetId} onChange={(id) => setSubnetId(id)} hidePrimaryNetwork={true} />

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Reading the Subnet validator set from the P-Chain...
        </div>
      )}

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {validators && !isLoading && (
        <>
          {/* Warp signing weight breakdown */}
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-zinc-500" />
                <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Warp Signing Weight</h4>
              </div>
              <Button variant="secondary" onClick={load} className="text-xs py-1 px-2">
                <RefreshCw className="w-3 h-3 mr-1 inline" />
                Refresh
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">L1 Validators</div>
                <div className="font-mono text-zinc-900 dark:text-zinc-100">{String(l1Weight)}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">{l1.length} node(s)</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">Legacy Validators</div>
                <div className="font-mono text-zinc-900 dark:text-zinc-100">{String(legacyWeight)}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">{remainingLegacy.length} node(s)</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">Total</div>
                <div className="font-mono text-zinc-900 dark:text-zinc-100">{String(totalWeight)}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">need {String(QUORUM_PERCENT)}% to sign</div>
              </div>
            </div>

            {remainingLegacy.length === 0 ? (
              <Alert variant="success">
                No legacy Subnet validators remain. The L1 validator set holds all {String(totalWeight)} weight.
              </Alert>
            ) : l1MeetsQuorum ? (
              <Alert variant="info">
                L1 validators already hold {sharePercent(l1Weight, totalWeight)}% of the total weight, which clears the{' '}
                {String(QUORUM_PERCENT)}% quorum on their own. Removing the legacy validators is still worth doing to
                keep the signing set clean.
              </Alert>
            ) : (
              <Alert variant="warning">
                <span>
                  L1 validators hold only {sharePercent(l1Weight, totalWeight)}% of the total weight, under the{' '}
                  {String(QUORUM_PERCENT)}% quorum. If the legacy validators below are offline, signature aggregation
                  cannot reach a threshold of stake and will fail. Removing them drops the total to{' '}
                  {String(projectedTotal)}, putting the L1 validators at 100%.
                </span>
              </Alert>
            )}
          </div>

          {/* Owner authorization */}
          {subnetInfo && (
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-zinc-500" />
                <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Subnet Owner</h4>
              </div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">
                Threshold {subnetInfo.threshold} of {controlKeys.length}
              </div>
              <div className="space-y-1">
                {controlKeys.map((key, idx) => {
                  const isMine = idx === authIndex;
                  return (
                    <div
                      key={key}
                      className={`text-xs font-mono p-2 rounded ${
                        isMine
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                          : 'bg-zinc-100 dark:bg-zinc-700/50 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      {key}
                      {isMine && <span className="ml-2">(Your wallet)</span>}
                    </div>
                  );
                })}
              </div>
              {!isAuthorized && (
                <Alert variant="error">
                  Your connected P-Chain address is not a control key for this Subnet, so it cannot authorize removals.
                  Connect the Subnet owner wallet.
                </Alert>
              )}
            </div>
          )}

          {/* Legacy validator list */}
          {legacy.length === 0 ? (
            <Alert variant="success">This Subnet has no legacy validators to remove.</Alert>
          ) : (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Legacy Subnet Validators</h4>
              {legacy.map((v) => {
                const txHash = removedTxs[v.nodeID];
                const isPending = pendingNodeId === v.nodeID;
                return (
                  <div key={v.nodeID} className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="text-xs font-mono break-all text-zinc-900 dark:text-zinc-100">{v.nodeID}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                          Weight {v.weight} ({sharePercent(BigInt(v.weight || '0'), totalWeight)}% of total)
                          {v.endTime && <> · expires {new Date(Number(v.endTime) * 1000).toLocaleString()}</>}
                        </div>
                      </div>
                      {txHash ? (
                        <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <CheckCircle2 className="w-4 h-4" />
                          Removed
                        </div>
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                      )}
                    </div>

                    {txHash ? (
                      <a
                        href={`https://${isTestnet ? 'subnets-test' : 'subnets'}.avax.network/p-chain/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-red-500 hover:text-red-400"
                      >
                        View in Explorer
                      </a>
                    ) : (
                      <CoreWalletTransactionButton
                        onClick={() => handleRemove(v.nodeID)}
                        loading={isPending}
                        loadingText="Removing Validator..."
                        disabled={isPending || pendingNodeId !== null || !isAuthorized || !coreWalletClient}
                        variant="danger"
                        className="w-full"
                        cliCommand={PCHAIN_COMMANDS.removeSubnetValidator({
                          subnetId: subnetId || '<subnet-id>',
                          nodeId: v.nodeID,
                          network: isTestnet ? 'fuji' : 'mainnet',
                        })}
                      >
                        Remove Validator
                      </CoreWalletTransactionButton>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {error && <Alert variant="error">{error}</Alert>}
        </>
      )}
    </div>
  );
}

export default withConsoleToolMetadata(RemoveLegacyValidators, metadata);
