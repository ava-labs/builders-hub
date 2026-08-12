'use client';

import { useEffect, useMemo, useState } from 'react';
import { FastForward, Loader2, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { Alert } from '@/components/toolbox/components/Alert';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import {
  BaseConsoleToolProps,
  ConsoleToolMetadata,
  withConsoleToolMetadata,
} from '@/components/toolbox/components/WithConsoleToolMetadata';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { generateConsoleToolGitHubUrl } from '@/components/toolbox/utils/githubUrl';
import { useSelectedL1 } from '@/components/toolbox/stores/l1ListStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { getPChainTxBlockHeight } from '@/components/toolbox/coreViem/utils/glacier';
import { useProposerVMStatus } from '@/components/toolbox/hooks/useProposerVMStatus';
import { useAdvanceProposerVM, type AdvancePhase } from '@/components/toolbox/hooks/useAdvanceProposerVM';

const metadata: ConsoleToolMetadata = {
  title: 'Advance P-Chain View',
  description:
    'Produce blocks on an idle L1 so its ProposerVM epoch catches up with the P-Chain and pending warp deliveries can verify against the current validator set.',
  toolRequirements: [WalletRequirementsConfigKey.WalletConnected],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

// Vocabulary mirrors the heights ruler on /docs/nodes/architecture/proposervm.
// Copied as literals on purpose: console tools must not import the docs
// figure's layout module.
const HEIGHTS_FOOTER = 'EPOCH HEIGHT ≤ TIP EMBEDS ≤ P-CHAIN HEIGHT';

const C_CHAIN_EVM_IDS = [43113, 43114];

const RUNNING_PHASES: AdvancePhase[] = ['countdown', 'sending', 'confirming', 'verifying'];

function formatHeight(height: bigint | null): string {
  return height === null ? 'unknown' : Number(height).toLocaleString('en-US');
}

function formatAge(sec: number): string {
  if (sec < 90) return `${sec}s`;
  const minutes = Math.floor(sec / 60);
  if (minutes < 90) return `${minutes}m ${sec % 60}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function formatCountdown(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

function AdvancePChainView({ onSuccess }: BaseConsoleToolProps) {
  const selectedL1 = useSelectedL1();
  const isTestnet = useWalletStore((s) => s.isTestnet);
  const [targetInput, setTargetInput] = useState('');
  const [txResolution, setTxResolution] = useState<{ txId: string; height: bigint | null } | null>(null);

  const parsedTarget = useMemo((): {
    kind: 'empty' | 'height' | 'txid' | 'invalid';
    normalized: string;
    height: bigint | null;
    error: string | null;
  } => {
    const normalized = targetInput.trim().replace(/[,_\s]/g, '');
    if (!normalized) return { kind: 'empty', normalized, height: null, error: null };
    if (/^\d+$/.test(normalized)) return { kind: 'height', normalized, height: BigInt(normalized), error: null };
    if (/^[1-9A-HJ-NP-Za-km-z]{40,60}$/.test(normalized))
      return { kind: 'txid', normalized, height: null, error: null };
    return { kind: 'invalid', normalized, height: null, error: 'Enter a block height or a P-Chain txID' };
  }, [targetInput]);

  useEffect(() => {
    if (parsedTarget.kind !== 'txid') return;
    const txId = parsedTarget.normalized;
    let cancelled = false;
    void getPChainTxBlockHeight(txId, isTestnet ? 'testnet' : 'mainnet').then((height) => {
      if (!cancelled) setTxResolution({ txId, height });
    });
    return () => {
      cancelled = true;
    };
  }, [parsedTarget.kind, parsedTarget.normalized, isTestnet]);

  const txResolved = parsedTarget.kind === 'txid' && txResolution?.txId === parsedTarget.normalized;
  const isResolvingTx = parsedTarget.kind === 'txid' && !txResolved;
  const explicitTarget = parsedTarget.height ?? (txResolved ? txResolution.height : null);
  const targetError =
    parsedTarget.error ??
    (txResolved && txResolution.height === null
      ? 'Transaction not found on the P-Chain (a very recent tx may not be indexed yet)'
      : null);

  const status = useProposerVMStatus({ requiredHeight: explicitTarget });
  // No explicit target: catch up to wherever the live P-Chain is right now.
  const advanceTarget = explicitTarget ?? status.liveHeight ?? null;
  const advance = useAdvanceProposerVM({ status, requiredHeight: advanceTarget, onAdvanced: onSuccess });

  const isCChain = selectedL1 ? C_CHAIN_EVM_IDS.includes(selectedL1.evmChainId) : false;
  const isRunning = RUNNING_PHASES.includes(advance.phase);
  const tipAge = status.status.tipAgeSec;

  const curlSnippet = `curl -X POST -H 'content-type: application/json' \\\n  --data '{"jsonrpc":"2.0","id":1,"method":"proposervm.getCurrentEpoch","params":{}}' \\\n  ${status.proposerVMUrl ?? 'https://<your-node>/ext/bc/<blockchainID>/proposervm'}`;

  const progressLine = (() => {
    switch (advance.phase) {
      case 'countdown':
        return advance.countdownSecRemaining !== null
          ? `The current epoch opened less than 5 minutes ago, so a new block cannot seal it yet. Sending in ${formatCountdown(advance.countdownSecRemaining)}.`
          : 'Waiting for the epoch to become sealable.';
      case 'sending':
        return `Sending block-producing transaction ${advance.attempt} of ${advance.maxAttempts}. Confirm it in your wallet.`;
      case 'confirming':
        return 'Waiting for the transaction to land in a block.';
      case 'verifying':
        return 'Reading the epoch state.';
      default:
        return null;
    }
  })();

  return (
    <div className="space-y-4 w-full">
      <Alert variant="info">
        <span>
          A chain&apos;s ProposerVM records a view of the P-Chain that{' '}
          <strong>only advances when the chain produces blocks</strong>. On an idle L1 that view goes stale, and warp
          message delivery (<code>initializeValidatorSet</code>, <code>completeValidatorRegistration</code>, ...) fails
          because it verifies against the validator set at the stale epoch height. This tool produces blocks by sending
          0-value transfers from your wallet to itself. It fixes <strong>delivery</strong> readiness only; it cannot fix
          signature <em>aggregation</em> failures, which depend on the signing validators themselves.{' '}
          <Link href="/docs/nodes/architecture/proposervm" className="underline" target="_blank">
            How this works
          </Link>
        </span>
      </Alert>

      {isCChain ? (
        <Alert variant="success">
          The C-Chain produces blocks continuously, so its P-Chain view never goes stale. There is nothing to advance
          here. Select an L1 to use this tool.
        </Alert>
      ) : (
        <>
          {/* The three heights, in the docs page's vocabulary */}
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {selectedL1 ? `${selectedL1.name}: P-Chain view` : 'P-Chain view'}
              </h4>
              <Button
                variant="secondary"
                onClick={() => void status.refresh()}
                disabled={status.isLoading || isRunning}
                className="text-xs py-1 px-2"
              >
                <RefreshCw className={`w-3 h-3 mr-1 inline ${status.isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">EPOCH HEIGHT</div>
                <div className="font-mono text-zinc-900 dark:text-zinc-100">
                  {formatHeight(status.epoch?.pChainHeight ?? null)}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">pins what warp verifies</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">TIP EMBEDS</div>
                <div className="font-mono text-zinc-900 dark:text-zinc-100">
                  {tipAge === null ? 'unknown' : `last block ${formatAge(tipAge)} ago`}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  sets who may build next (no RPC exposes the value)
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">P-CHAIN HEIGHT</div>
                <div className="font-mono text-zinc-900 dark:text-zinc-100">{formatHeight(status.liveHeight)}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">live registry, climbing</div>
              </div>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs text-zinc-400 dark:text-zinc-500 font-mono">{HEIGHTS_FOOTER}</div>
              {status.status.state === 'satisfied' && (
                <span className="text-xs px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                  {explicitTarget !== null ? 'covers your target' : 'current'}
                </span>
              )}
              {(status.status.state === 'stale-sealable' || status.status.state === 'stale-waiting') && (
                <span className="text-xs px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                  stale
                  {status.status.heightLag !== null ? `, ${formatHeight(status.status.heightLag)} blocks behind` : ''}
                </span>
              )}
              {status.status.state === 'unknown' && (
                <span className="text-xs px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                  unknown
                </span>
              )}
            </div>
          </div>

          {status.unreachable && !status.isLoading && (
            <Alert variant="warning">
              <div className="space-y-2">
                <span>
                  This RPC endpoint does not expose the chain&apos;s <code>/proposervm</code> API (public gateways never
                  do), so the epoch state cannot be read here. You can still advance blind: the tool sends 2
                  block-producing transactions without verifying the result. To read the state yourself, run this
                  against your own node:
                </span>
                <pre className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 rounded p-2 overflow-x-auto whitespace-pre">
                  {curlSnippet}
                </pre>
              </div>
            </Alert>
          )}

          <Input
            label="Target P-Chain height or txID (optional)"
            value={targetInput}
            onChange={setTargetInput}
            placeholder={status.liveHeight !== null ? `current: ${status.liveHeight}` : 'height or P-Chain txID'}
            error={targetError}
            helperText={
              isResolvingTx
                ? 'Resolving the transaction height...'
                : txResolved && txResolution.height !== null
                  ? `Transaction landed at P-Chain height ${txResolution.height}.`
                  : 'Leave empty to catch up to the current P-Chain height. Paste a height or a P-Chain txID when a pending action needs the epoch to cover the block that transaction landed in.'
            }
            disabled={isRunning}
          />

          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={advance.start}
              disabled={isRunning || !selectedL1 || targetError !== null || isResolvingTx}
              loading={isRunning}
              loadingText="Working"
              icon={<FastForward className="w-4 h-4" />}
            >
              Produce blocks ({'≈'}2 transactions)
            </Button>
            {isRunning && (
              <Button variant="outline" onClick={advance.cancel}>
                Cancel
              </Button>
            )}
          </div>

          {isRunning && progressLine && (
            <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              {progressLine}
            </div>
          )}

          {advance.phase === 'done' && advance.verified && (
            <Alert variant="success">
              The epoch now pins P-Chain height {formatHeight(status.epoch?.pChainHeight ?? null)}
              {advance.txHashes.length > 0
                ? ` after ${advance.txHashes.length} transaction(s)`
                : ' (no transactions were needed)'}
              . Warp deliveries that need a height at or below it will verify. Retry your pending action now.
            </Alert>
          )}

          {advance.phase === 'done' && !advance.verified && (
            <Alert variant="warning">
              Sent {advance.txHashes.length} block-producing transactions, but the epoch state cannot be read through
              this RPC, so the result is unverified. Retry your pending action; if it still fails, check the epoch with
              the curl above and run this tool again.
            </Alert>
          )}

          {advance.phase === 'gave-up' && (
            <Alert variant="warning">
              Sent {advance.maxAttempts} transactions and the epoch still pins{' '}
              {formatHeight(status.epoch?.pChainHeight ?? null)}, below your target of {formatHeight(advanceTarget)}.
              The view did advance, so retry your pending action first; it may already succeed. If not, run this tool
              again.
            </Alert>
          )}

          {advance.phase === 'error' && advance.error && (
            <Alert variant="error">
              <div className="space-y-1">
                <span>{advance.error}</span>
                {advance.errorKind === 'no-gas' && selectedL1?.externalFaucetUrl && (
                  <div>
                    <a
                      href={selectedL1.externalFaucetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs underline"
                    >
                      Get {selectedL1.coinName} from the chain&apos;s faucet
                    </a>
                  </div>
                )}
                {advance.errorKind === 'allowlist' && (
                  <div>
                    <Link href="/console/l1-access-restrictions/transactor-allowlist" className="text-xs underline">
                      Manage the Transactor Allowlist
                    </Link>
                  </div>
                )}
              </div>
            </Alert>
          )}

          {advance.txHashes.length > 0 && (
            <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
              {advance.txHashes.map((hash, i) => (
                <div key={hash} className="font-mono break-all">
                  tx {i + 1}: {hash}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default withConsoleToolMetadata(AdvancePChainView, metadata);
