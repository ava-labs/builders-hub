'use client';

import { Plus, RefreshCw, Server, XCircle } from 'lucide-react';
import { Board, BoardHeader, RowSkeleton, SectionHeader } from '@/components/explorer-v2/ui';
import { NodeRegistration } from '@/components/toolbox/console/testnet-infra/managed-testnet-nodes/types';
import NodeCard from '@/components/toolbox/console/testnet-infra/managed-testnet-nodes/NodeCard';
import { COUNT, EYEBROW, HoverArrow, PRIMARY_BTN } from './ui';

interface NodesListProps {
  nodes: NodeRegistration[];
  isLoadingNodes: boolean;
  nodesError: string | null;
  onRefresh: () => void;
  onShowCreateForm: () => void;
  onDeleteNode: (node: NodeRegistration) => void;
  deletingNodes: Set<string>;
}

export default function NodesList({
  nodes,
  isLoadingNodes,
  nodesError,
  onRefresh,
  onShowCreateForm,
  onDeleteNode,
  deletingNodes,
}: NodesListProps) {
  if (isLoadingNodes) {
    return (
      <section role="status" aria-label="Loading nodes" className="flex flex-col gap-4">
        <SectionHeader label="Nodes" />
        <Board className="border-x border-t">
          <BoardHeader label="Fetching your nodes" />
          <RowSkeleton n={3} />
        </Board>
      </section>
    );
  }

  if (nodes.length === 0) {
    return (
      <Board divide={false} className="flex flex-col items-start gap-3 border-x border-t px-5 py-8 md:px-6">
        <p className={`${EYEBROW} flex items-center gap-2`}>
          <Server className="h-3.5 w-3.5" />
          No hosted nodes
        </p>
        <p className="max-w-xl text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          Spin up a free Fuji node for your L1. It runs for 3 days.
        </p>
        <button type="button" onClick={onShowCreateForm} className={`${PRIMARY_BTN} mt-2`}>
          <Plus className="h-3.5 w-3.5" />
          Set up your first node
          <HoverArrow />
        </button>
      </Board>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        label="Nodes"
        action={
          <div className="flex items-center gap-4">
            <span className={COUNT}>
              {nodes.length} {nodes.length === 1 ? 'node' : 'nodes'}
            </span>
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoadingNodes}
              title="Refresh nodes"
              className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              <RefreshCw className={`h-3 w-3 ${isLoadingNodes ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        }
      />

      {nodesError && (
        <div
          role="alert"
          className="flex items-start gap-3 border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/60 dark:bg-red-950/30"
        >
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-red-800 dark:text-red-200">
              Could not load nodes
            </p>
            <p className="mt-1 text-[13px] text-red-700 dark:text-red-300">{nodesError}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {nodes.map((node) => (
          <NodeCard key={node.id} node={node} onDeleteNode={onDeleteNode} isDeletingNode={deletingNodes.has(node.id)} />
        ))}
      </div>
    </section>
  );
}
