'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronRight, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { boardContainer, boardItem } from '@/components/console/motion';
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
import type { CombinedL1 } from '../_lib/types';
import { formatRelativeFromNow } from '../_lib/format';

export function NodeListCard({
  l1,
  userActiveTotal,
  onRefetch,
}: {
  l1: CombinedL1;
  userActiveTotal: number;
  onRefetch: () => void;
}) {
  const nodes = l1.nodes ?? [];
  const activeCount = nodes.filter((n) => n.status === 'active').length;
  // Builder Hub enforces a per-user cap of 3 active nodes across all L1s.
  // Disable the provision button proactively when the user is at that limit
  // so they don't hit a 429 mid-click.
  const atUserCap = userActiveTotal >= 3;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-lg">Managed Nodes</CardTitle>
            <CardDescription>
              Builder Hub-managed nodes provisioned for this L1. Each runs for 3 days from
              creation. Provision a fresh one to extend the L1&apos;s lifetime.
            </CardDescription>
          </div>
          <ProvisionNodeButton
            subnetId={l1.subnetId}
            blockchainId={l1.blockchainId}
            disabled={atUserCap}
            disabledReason={atUserCap ? 'You already have 3 active nodes (Builder Hub cap).' : undefined}
            onSuccess={onRefetch}
          />
        </div>
      </CardHeader>
      <CardContent>
        <motion.div
          className="space-y-2"
          variants={boardContainer}
          initial="hidden"
          animate="visible"
        >
          {nodes.map((n) => (
            <motion.div
              key={n.id}
              variants={boardItem}
              className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 p-3 rounded-lg border bg-card"
            >
              <div className="min-w-0">
                <code className="text-xs font-mono text-foreground break-all">{n.nodeId}</code>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Created {new Date(n.createdAt).toLocaleString()} · {formatRelativeFromNow(n.expiresAt)}{' '}
                  remaining
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={n.status === 'active' ? 'default' : 'secondary'}>{n.status}</Badge>
                {n.status === 'active' && (
                  <DeleteNodeButton nodeDbId={n.id} nodeId={n.nodeId} onSuccess={onRefetch} />
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>
        <div className="mt-4 pt-3 border-t flex items-center justify-between gap-3 flex-wrap">
          <Link
            href="/console/testnet-infra/nodes"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Manage all nodes
            <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
          <span className="text-xs text-muted-foreground">
            {activeCount} active on this L1 · {userActiveTotal}/3 total across your account
          </span>
        </div>
      </CardContent>
    </Card>
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
        const msg =
          json?.message ?? json?.error ?? `Failed to provision node (HTTP ${res.status})`;
        throw new Error(msg);
      }
      setSuccess(true);
      toast.success('Node provisioned', 'A fresh 3-day-TTL node is being added to this L1.');
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to provision node';
      setError(msg);
      toast.error('Could not provision node', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1 min-w-0">
      <Button
        size="sm"
        variant="outline"
        onClick={handleClick}
        disabled={disabled || isSubmitting}
        title={disabledReason}
      >
        {isSubmitting ? 'Provisioning…' : success ? 'Provisioned' : 'Provision another node'}
      </Button>
      {error && (
        <span className="text-[11px] text-red-600 dark:text-red-400 max-w-[280px] text-right">
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
      const res = await fetch(
        `/api/managed-testnet-nodes?id=${encodeURIComponent(nodeDbId)}`,
        { method: 'DELETE', credentials: 'include' },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.message ?? json?.error ?? `HTTP ${res.status}`);
      }
      toast.success('Node removed', 'A slot has been freed against your 3-node cap.');
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to remove node';
      setError(msg);
      toast.error('Could not remove node', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          aria-label="Remove node"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this managed node?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="block mb-2">
              <code className="text-xs font-mono break-all">{nodeId}</code>
            </span>
            This frees up a slot against your 3-node Builder Hub cap. The L1 will keep running as
            long as at least one node is still active. Removed nodes can&apos;t be brought back —
            you&apos;d need to provision a fresh one.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={isSubmitting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isSubmitting ? 'Removing…' : 'Remove node'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
