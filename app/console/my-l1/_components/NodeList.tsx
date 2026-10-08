'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Server, ShieldCheck, Trash2 } from 'lucide-react';
import { Board, BoardHeader, HashChip, MUTED } from '@/components/explorer-v2/ui';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from '@/lib/toast';
import type { CombinedL1 } from '@/lib/console/my-l1/types';
import { formatRelativeFromNow } from '@/lib/console/my-l1/format';
import type { L1ValidatorSetState } from '@/hooks/useL1ValidatorSet';
import { getAddValidatorPath, type ValidatorManagerKind } from '@/lib/console/my-l1/validator-manager-routing';
import { cn } from '@/lib/utils';
import { BTN_DANGER, BTN_SECONDARY, COUNT, EYEBROW, ROW_BTN, ROW_BTN_DANGER } from './chrome';

type ManagedNode = NonNullable<CombinedL1['nodes']>[number];
type NodeRole = 'validator' | 'rpc' | 'detecting' | 'unknown';

export function NodeListCard({
  l1,
  userActiveTotal,
  onRefetch,
  validators,
  validatorManagerKind,
}: {
  l1: CombinedL1;
  userActiveTotal: number;
  onRefetch: () => void;
  validators: L1ValidatorSetState;
  validatorManagerKind: ValidatorManagerKind | null;
}) {
  const nodes = l1.nodes ?? [];
  const activeCount = nodes.filter((n) => n.status === 'active').length;
  const validatorNodeIds = new Set(validators.nodeIds);
  // Builder Hub enforces a per-user cap of 3 active nodes across all L1s.
  // Disable the provision button proactively when the user is at that limit
  // so they don't hit a 429 mid-click.
  const atUserCap = userActiveTotal >= 3;

  const roleForNode = (nodeId: string): NodeRole => {
    if (validators.isLoading) return 'detecting';
    if (validators.error) return 'unknown';
    return validatorNodeIds.has(nodeId) ? 'validator' : 'rpc';
  };

  const renderNode = (node: ManagedNode) => {
    const role = roleForNode(node.nodeId);
    const isActive = node.status === 'active';

    return (
      <div
        key={node.id}
        className="flex flex-col gap-2 px-5 py-3 md:flex-row md:items-center md:justify-between md:px-6"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <HashChip value={node.nodeId} len={60} />
            <NodeRoleBadge role={role} />
          </div>
          <p className={cn(MUTED, 'text-[11px]')}>
            Created {new Date(node.createdAt).toLocaleString()} · {formatRelativeFromNow(node.expiresAt)} remaining
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em]',
              isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-500',
            )}
          >
            <span
              aria-hidden="true"
              className={cn('h-1.5 w-1.5 rounded-full', isActive ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700')}
            />
            {node.status}
          </span>
          {isActive && role === 'rpc' && (
            <Link
              href={getAddValidatorPath(validatorManagerKind, l1, { nodeId: node.nodeId })}
              className={ROW_BTN}
              title="Convert this node into a validator"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span className="sr-only">Convert this node into a validator</span>
            </Link>
          )}
          {isActive && <DeleteNodeButton nodeDbId={node.id} nodeId={node.nodeId} onSuccess={onRefetch} />}
        </div>
      </div>
    );
  };

  return (
    <Board className="border-x border-t">
      <BoardHeader label="Managed nodes" action={<span className={COUNT}>{activeCount} active</span>} />
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between md:px-6">
        <p className="max-w-xl text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          Builder Hub-managed nodes provisioned for this L1. Each runs for 3 days from creation. Provision a fresh one
          to extend the L1&apos;s lifetime.
        </p>
        <ProvisionNodeButton
          subnetId={l1.subnetId}
          blockchainId={l1.blockchainId}
          disabled={atUserCap}
          disabledReason={atUserCap ? 'You already have 3 active nodes (Builder Hub cap).' : undefined}
          onSuccess={onRefetch}
        />
      </div>
      {nodes.length === 0 ? (
        // Empty state for managed L1s with no provisioned nodes — surfaces
        // the "your L1 is dark" reality directly instead of hiding the
        // entire Node fleet section. The Provision button is already in
        // the header for the click target.
        <div className="flex flex-col gap-2 px-5 py-6 md:px-6">
          <p className={cn(EYEBROW, 'flex items-center gap-2')}>
            <Server className="h-3.5 w-3.5" aria-hidden="true" />
            No active managed nodes
          </p>
          <p className="max-w-xl text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Your L1 won&apos;t respond to RPC calls until at least one node is running. Provision one above to bring it
            back online.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">{nodes.map(renderNode)}</div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/console/testnet-infra/nodes"
          className="group/row flex items-center gap-2 px-5 py-2.5 text-[13.5px] font-medium text-zinc-900 underline-offset-4 hover:underline md:px-6 dark:text-zinc-50"
        >
          Manage all nodes
          <ArrowRight className="h-3.5 w-3.5 -translate-x-1 text-[#E6212F] opacity-0 transition-all group-hover/row:translate-x-0 group-hover/row:opacity-100" />
        </Link>
        <span className={cn(COUNT, 'px-5 py-2.5 md:px-6')}>
          {activeCount} active on this L1 · {userActiveTotal}/3 total across your account
        </span>
      </div>
    </Board>
  );
}

const ROLE_LABEL: Record<NodeRole, { label: string; dot: string; text: string }> = {
  validator: { label: 'Validator', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' },
  rpc: { label: 'RPC node', dot: 'bg-zinc-400', text: 'text-zinc-500 dark:text-zinc-400' },
  detecting: { label: 'Detecting…', dot: 'bg-zinc-300 dark:bg-zinc-700', text: 'text-zinc-400 dark:text-zinc-500' },
  unknown: { label: 'Unknown role', dot: 'bg-zinc-300 dark:bg-zinc-700', text: 'text-zinc-400 dark:text-zinc-500' },
};

function NodeRoleBadge({ role }: { role: NodeRole }) {
  const { label, dot, text } = ROLE_LABEL[role];
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em]', text)}>
      <span aria-hidden="true" className={cn('size-1 shrink-0', dot)} />
      {label}
    </span>
  );
}

// Compact "Provision another node" button + inline error/success surface.
// Calls the existing POST /api/managed-testnet-nodes endpoint. The server
// enforces the 3-day TTL + the 3-node-per-user cap; we disable the button
// when we already know the cap is hit so the user doesn't get a 429.
function ProvisionNodeButton({
  subnetId,
  blockchainId,
  disabled,
  disabledReason,
  onSuccess,
}: {
  subnetId: string;
  blockchainId: string;
  disabled: boolean;
  disabledReason?: string;
  onSuccess: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleClick = async () => {
    if (disabled || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch('/api/managed-testnet-nodes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subnetId, blockchainId }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        const msg = json?.message ?? json?.error ?? `Failed to provision node (HTTP ${res.status})`;
        throw new Error(msg);
      }
      setSuccess(true);
      toast.success('Node provisioning…', undefined, { id: `provision:${subnetId}` });
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to provision node';
      setError(msg);
      toast.error('Could not provision node', msg, {
        id: `provision:${subnetId}`,
        action: { label: 'Retry', onClick: () => void handleClick() },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-w-0 shrink-0 flex-col items-start gap-1 sm:items-end">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isSubmitting}
        className={BTN_SECONDARY}
        title={disabledReason}
        aria-label={disabledReason ? `Provision another node — ${disabledReason}` : 'Provision another node'}
      >
        {isSubmitting ? 'Provisioning…' : success ? 'Provisioned' : 'Provision another node'}
      </button>
      {error && (
        <span className="max-w-[280px] font-mono text-[11px] text-red-600 sm:text-right dark:text-red-400">
          {error}
        </span>
      )}
    </div>
  );
}

// Confirmation-gated DELETE for a single managed node. Frees up a slot
// against the per-user 3-node cap. Wrapping in AlertDialog because losing
// a node is destructive — once terminated, the L1 may go down if no other
// nodes are running.
function DeleteNodeButton({
  nodeDbId,
  nodeId,
  onSuccess,
}: {
  nodeDbId: string;
  nodeId: string;
  onSuccess: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/managed-testnet-nodes?id=${encodeURIComponent(nodeDbId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.message ?? json?.error ?? `HTTP ${res.status}`);
      }
      toast.success('Node removed', undefined, { id: `remove-node:${nodeDbId}` });
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to remove node';
      setError(msg);
      toast.error('Could not remove node', msg, {
        id: `remove-node:${nodeDbId}`,
        action: { label: 'Retry', onClick: () => void handleDelete() },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button type="button" className={ROW_BTN_DANGER} aria-label="Remove node">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="gap-0 rounded-none border-zinc-200 bg-white p-0 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <AlertDialogHeader className="gap-2 border-b border-zinc-200 px-6 py-5 text-left dark:border-zinc-800">
          <p className={EYEBROW}>Managed node</p>
          <AlertDialogTitle className="text-[18px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Remove this managed node?
          </AlertDialogTitle>
        </AlertDialogHeader>
        <div className="flex flex-col gap-3 px-6 py-5">
          <code className="block break-all border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-[12px] text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
            {nodeId}
          </code>
          <AlertDialogDescription className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            This frees up a slot against your 3-node Builder Hub cap. The L1 will keep running as long as at least one
            node is still active. Removed nodes can&apos;t be brought back — you&apos;d need to provision a fresh one.
          </AlertDialogDescription>
          {error && <p className="font-mono text-[11px] text-red-600 dark:text-red-400">{error}</p>}
        </div>
        <AlertDialogFooter className="gap-2 border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <AlertDialogCancel disabled={isSubmitting} className={cn(BTN_SECONDARY, 'mt-0 rounded-none shadow-none')}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={isSubmitting}
            className={cn(BTN_DANGER, 'rounded-none shadow-none')}
          >
            {isSubmitting ? 'Removing…' : 'Remove node'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
