'use client';

import { useCallback, useId, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Coins, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { CombinedL1 } from '@/lib/console/my-l1/types';
import { useL1TokenBalances, type TokenBalance, type TokenSource } from '@/hooks/useL1TokenBalances';
import { AddTokenDialog } from './AddTokenDialog';

interface TokenListProps {
  l1: CombinedL1;
  userAddress: `0x${string}` | '';
  enabled: boolean;
}

const SOURCE_LABELS: Record<TokenSource, string> = {
  ictt: 'Bridged',
  wrapped: 'Wrapped native',
  'user-added': 'Custom',
};

const SOURCE_TONES: Record<TokenSource, string> = {
  ictt: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20',
  wrapped: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  'user-added': 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20',
};

export function TokenList({ l1, userAddress, enabled }: TokenListProps) {
  const { tokens, isLoading, error, addToken, removeToken, isWalletOnL1 } = useL1TokenBalances({
    l1,
    userAddress,
    enabled,
  });
  const [showZero, setShowZero] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  // Default to collapsed so a user with many tokens doesn't have their
  // dashboard's lower sections pushed off the fold on page load. Resets
  // on L1 switch via the parent's <AnimatePresence> key in DashboardBody.
  const [expanded, setExpanded] = useState(false);
  // Stable id so aria-controls links the toggle button to the body
  // region without colliding if multiple TokenList instances mount.
  const bodyId = useId();

  const visibleTokens = useMemo(
    () => (showZero ? tokens : tokens.filter((t) => t.balance > 0n)),
    [tokens, showZero],
  );

  const hiddenZeroCount = tokens.length - visibleTokens.length;

  // Count of tokens with a positive balance — what we surface in the
  // collapsed subtitle so users know whether expanding is worthwhile.
  const nonZeroCount = useMemo(
    () => tokens.filter((t) => t.balance > 0n).length,
    [tokens],
  );

  const subtitle = useMemo(() => {
    const base = `ERC-20 balances on ${l1.chainName}`;
    if (!isWalletOnL1) return base;
    if (isLoading && tokens.length === 0) return `${base} · Loading…`;
    if (nonZeroCount === 0) return `${base} · No tokens yet`;
    return `${base} · ${nonZeroCount} token${nonZeroCount === 1 ? '' : 's'}`;
  }, [isWalletOnL1, isLoading, tokens.length, nonZeroCount, l1.chainName]);

  // Wrap addToken so a successful add auto-expands the body. The user
  // just engaged with the list and almost always wants to verify the
  // new entry appeared — making them click the toggle would be friction
  // for the most common post-add intent. Failures (including the
  // persistence warning) intentionally don't auto-expand.
  const handleAddToken = useCallback(
    async (address: string) => {
      const result = await addToken(address);
      if (result.ok) setExpanded(true);
      return result;
    },
    [addToken],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="rounded-3xl border border-border bg-card overflow-hidden"
    >
      <div className="flex items-center justify-between gap-2 px-5 py-4">
        {/* Toggle region — explicitly NOT wrapping the Add Token button
            so its click doesn't get hijacked by the toggle. flex-1 +
            min-w-0 lets the subtitle truncate on narrow widths instead
            of pushing the button off the right edge. */}
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-controls={bodyId}
          className="flex items-center gap-2.5 flex-1 min-w-0 text-left rounded-lg -mx-1 px-1 py-1 hover:bg-muted/40 transition-colors"
        >
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Coins className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Tokens</h2>
            <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
          </div>
          <ChevronDown
            className={cn(
              'w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200',
              expanded && 'rotate-180',
            )}
            aria-hidden="true"
          />
        </button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAddOpen(true)}
          disabled={!isWalletOnL1}
          className="shrink-0"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add Token
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={bodyId}
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="overflow-hidden border-t border-border"
          >
            {!isWalletOnL1 ? (
              <EmptyMessage>Switch your wallet to this L1 to see token balances.</EmptyMessage>
            ) : error ? (
              <EmptyMessage tone="error">{error}</EmptyMessage>
            ) : isLoading && tokens.length === 0 ? (
              <TokenSkeletonRows />
            ) : visibleTokens.length === 0 && tokens.length === 0 ? (
              <EmptyMessage>
                No bridged or custom tokens found yet. Add one with the button above to start
                tracking it here.
              </EmptyMessage>
            ) : visibleTokens.length === 0 ? (
              <EmptyMessage>
                All known tokens have a zero balance.
                <button
                  type="button"
                  className="ml-1 underline-offset-2 hover:underline text-foreground"
                  onClick={() => setShowZero(true)}
                >
                  Show them anyway
                </button>
                .
              </EmptyMessage>
            ) : (
              <ul className="divide-y divide-border">
                {visibleTokens.map((token) => (
                  <TokenRow
                    key={token.address}
                    token={token}
                    onRemove={
                      token.source === 'user-added' ? () => removeToken(token.address) : null
                    }
                  />
                ))}
              </ul>
            )}

            {tokens.length > 0 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/30">
                <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showZero}
                    onChange={(e) => setShowZero(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-border"
                  />
                  Show 0-balance tokens
                  {hiddenZeroCount > 0 && !showZero && (
                    <span className="text-muted-foreground/70">({hiddenZeroCount} hidden)</span>
                  )}
                </label>
                <span className="text-[11px] text-muted-foreground">Refreshes every 15s</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AddTokenDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        l1ChainName={l1.chainName}
        onSubmit={handleAddToken}
      />
    </motion.div>
  );
}

function TokenRow({ token, onRemove }: { token: TokenBalance; onRemove: (() => void) | null }) {
  const initial = token.symbol.charAt(0).toUpperCase();
  const formatted = formatTokenBalance(token.balanceFormatted);

  return (
    <li className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
      <div className="w-9 h-9 rounded-full bg-muted text-foreground/80 flex items-center justify-center text-sm font-semibold shrink-0">
        {initial}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold tracking-tight text-foreground truncate">
            {token.symbol}
          </span>
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider shrink-0',
              SOURCE_TONES[token.source],
            )}
          >
            {SOURCE_LABELS[token.source]}
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate">{token.name}</p>
      </div>

      <div className="text-right shrink-0">
        <p className="text-sm font-semibold tabular-nums tracking-tight text-foreground">
          {formatted}
        </p>
        <p className="text-[11px] text-muted-foreground">{token.symbol}</p>
      </div>

      {onRemove && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Token actions" className="shrink-0">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onRemove} className="text-red-600 dark:text-red-400">
              <Trash2 className="w-3.5 h-3.5 mr-2" />
              Remove from list
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}

function EmptyMessage({
  children,
  tone = 'muted',
}: {
  children: React.ReactNode;
  tone?: 'muted' | 'error';
}) {
  return (
    <div
      className={cn(
        'px-5 py-8 text-center text-sm',
        tone === 'error' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
      )}
    >
      {children}
    </div>
  );
}

function TokenSkeletonRows() {
  return (
    <ul className="divide-y divide-border">
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex items-center gap-3 px-5 py-3">
          <div className="w-9 h-9 rounded-full bg-muted animate-pulse shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-20 rounded bg-muted animate-pulse" />
            <div className="h-2.5 w-28 rounded bg-muted animate-pulse" />
          </div>
          <div className="space-y-1.5 text-right">
            <div className="h-3 w-16 rounded bg-muted animate-pulse ml-auto" />
            <div className="h-2.5 w-10 rounded bg-muted animate-pulse ml-auto" />
          </div>
        </li>
      ))}
    </ul>
  );
}

// Formats a token balance using thousands separators and a sensible
// number of decimal places. Very small non-zero balances are rounded up
// so a real holding never shows as "0" — better to read "0.0001" than
// hide a position behind the rounding.
function formatTokenBalance(formatted: string): string {
  const num = parseFloat(formatted);
  if (!Number.isFinite(num)) return formatted;
  if (num === 0) return '0';
  if (num < 0.0001) return '<0.0001';
  if (num < 1) return num.toFixed(4);
  if (num < 1000) return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
