'use client';

import Link from 'next/link';
import { Check, Clock3, ExternalLink, X } from 'lucide-react';

import { type DemoTransaction, USDCM_TOKEN_ADDRESS, formatTokenAmount, shortenIdentifier } from './demo';

interface AccountActivityProps {
  unlinkAddress: string | null;
  transactionId: string | null;
  transaction: DemoTransaction | null;
  isRefreshing: boolean;
}

export type TransactionDisplayState = 'failed' | 'pending' | 'processed';

export function getTransactionDisplayState(transaction: DemoTransaction): TransactionDisplayState {
  if (transaction.status === 'failed' || transaction.confirmation_status === 'failed') return 'failed';
  if (transaction.status === 'processed' || transaction.confirmation_status === 'processed') return 'processed';
  return 'pending';
}

const transactionDateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="mt-1 break-all text-sm text-zinc-900 dark:text-zinc-100">{children}</dd>
    </div>
  );
}

export function AccountActivity({ unlinkAddress, transactionId, transaction, isRefreshing }: AccountActivityProps) {
  const matchingTransaction = transaction?.id === transactionId ? transaction : null;
  const transactionState = matchingTransaction ? getTransactionDisplayState(matchingTransaction) : null;
  const createdAt = matchingTransaction ? new Date(matchingTransaction.created_at) : null;
  const hasValidCreatedAt = createdAt !== null && !Number.isNaN(createdAt.getTime());

  return (
    <section
      className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6"
      aria-labelledby="unlink-account-activity-title"
      aria-busy={isRefreshing}
    >
      <div>
        <h2
          id="unlink-account-activity-title"
          className="text-balance text-lg font-semibold text-zinc-900 dark:text-zinc-100"
        >
          My Private Activity
        </h2>
        <p className="mt-1 max-w-xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          This view shows the transfer details available to the connected account.
        </p>
      </div>

      <div className="mt-5">
        <div aria-live="polite" aria-atomic="true">
          {!unlinkAddress ? (
            <p className="rounded-xl border border-dashed border-zinc-300 p-5 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              Create the private account to enable its activity view.
            </p>
          ) : !transactionId ? (
            <p className="rounded-xl border border-dashed border-zinc-300 p-5 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              Complete the fixed transfer to view its details here.
            </p>
          ) : !matchingTransaction ? (
            <p className="rounded-xl border border-dashed border-zinc-300 p-5 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              {isRefreshing
                ? 'Looking for the matching account transaction...'
                : 'The matching transaction is not visible yet. Check its status from the transfer step.'}
            </p>
          ) : transactionState === 'failed' ? (
            <div className="flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              <X aria-hidden="true" className="h-4 w-4 shrink-0" />
              The matching private transfer failed.
            </div>
          ) : transactionState === 'processed' ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
              <Check aria-hidden="true" className="h-4 w-4 shrink-0" />
              Matching private transfer processed for this account.
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <Clock3 aria-hidden="true" className="h-4 w-4 shrink-0" />
              Matching private transfer found and still processing.
            </div>
          )}
        </div>

        {matchingTransaction ? (
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <Detail label="Amount">
              {matchingTransaction.amount ? (
                <span className="font-mono tabular-nums">{formatTokenAmount(matchingTransaction.amount)} USDCm</span>
              ) : (
                'Unavailable'
              )}
            </Detail>
            <Detail label="Status">{transactionState}</Detail>
            <Detail label="Sender">
              <code title={matchingTransaction.sender_address ?? unlinkAddress ?? undefined} translate="no">
                {shortenIdentifier(matchingTransaction.sender_address ?? unlinkAddress ?? 'Unavailable', 10)}
              </code>
            </Detail>
            <Detail label="Recipient">
              <code
                title={
                  matchingTransaction.recipient_address ?? matchingTransaction.recipient_addresses?.[0] ?? undefined
                }
                translate="no"
              >
                {shortenIdentifier(
                  matchingTransaction.recipient_address ??
                    matchingTransaction.recipient_addresses?.[0] ??
                    'Unavailable',
                  10,
                )}
              </code>
            </Detail>
            <Detail label="Token">
              <span>
                USDCm -{' '}
                <code title={matchingTransaction.token ?? USDCM_TOKEN_ADDRESS} translate="no">
                  {shortenIdentifier(matchingTransaction.token ?? USDCM_TOKEN_ADDRESS, 8)}
                </code>
              </span>
            </Detail>
            <Detail label="Created">
              {hasValidCreatedAt && createdAt ? (
                <time dateTime={matchingTransaction.created_at}>{transactionDateFormatter.format(createdAt)}</time>
              ) : (
                'Unavailable'
              )}
            </Detail>
            <Detail label="Transaction ID">
              <code translate="no">{matchingTransaction.id}</code>
            </Detail>
            <Detail label="Fuji transaction hash">
              {matchingTransaction.tx_hash ? (
                <Link
                  href={`/explorer/avalanche-c-chain/tx/${matchingTransaction.tx_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={matchingTransaction.tx_hash}
                  className="inline-flex items-center gap-1.5 font-mono text-zinc-700 underline underline-offset-2 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:text-zinc-300 dark:hover:text-white dark:focus-visible:ring-zinc-100 dark:focus-visible:ring-offset-zinc-900"
                  translate="no"
                >
                  {shortenIdentifier(matchingTransaction.tx_hash, 10)}
                  <span className="sr-only"> (opens in a new tab)</span>
                  <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                </Link>
              ) : (
                'Pending'
              )}
            </Detail>
          </dl>
        ) : null}
      </div>
    </section>
  );
}
