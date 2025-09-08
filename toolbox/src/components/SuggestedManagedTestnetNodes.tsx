"use client"

import { useEffect, useState } from "react"
import { Button } from "./Button"

export type ManagedTestnetNodeSuggestion = {
  id: string;
  node_id: string;
  chain_name: string | null;
  public_key?: string;
  proof_of_possession?: string;
  subnet_id?: string;
}

interface SuggestedManagedTestnetNodesProps {
  managedNodes?: ManagedTestnetNodeSuggestion[]; // optional; if omitted we'll fetch
  selectedSubnetId?: string | null;
  canAddMore: boolean;
  onAdd: (node: ManagedTestnetNodeSuggestion) => void;
}

export function SuggestedManagedTestnetNodes({
  managedNodes,
  selectedSubnetId = null,
  canAddMore,
  onAdd,
}: SuggestedManagedTestnetNodesProps) {
  const [nodes, setNodes] = useState<ManagedTestnetNodeSuggestion[]>(managedNodes || [])
  const [loaded, setLoaded] = useState<boolean>(Boolean(managedNodes))

  useEffect(() => {
    let isMounted = true
    if (managedNodes && managedNodes.length > 0) {
      setLoaded(true)
      setNodes(managedNodes)
      return
    }
    const fetchManagedNodes = async () => {
      try {
        const response = await fetch('/api/managed-testnet-nodes', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })
        const data = await response.json()
        if (!response.ok || data.error) {
          throw new Error(data.message || data.error || 'Failed to fetch hosted nodes')
        }
        if (isMounted && Array.isArray(data.nodes)) {
          setNodes(data.nodes as ManagedTestnetNodeSuggestion[])
        }
      } catch (e) {
        console.error('Failed to fetch hosted nodes for autofill:', e)
      } finally {
        if (isMounted) setLoaded(true)
      }
    }
    fetchManagedNodes()
    return () => { isMounted = false }
  }, [managedNodes])

  const filtered = nodes.filter(n => !selectedSubnetId || n.subnet_id === selectedSubnetId)

  if (!loaded) {
    return null
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-1 border-b border-zinc-200 dark:border-zinc-700">
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Suggested Hosted Nodes</span>
      </div>
      <div className="space-y-2">
        {filtered.map((n) => (
          <div key={n.id} className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md p-3">
            <div className="min-w-0 space-y-0.5">
              <div className="font-mono text-sm text-zinc-900 dark:text-zinc-100 truncate leading-tight">{n.node_id}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate leading-tight">
                {(n.chain_name ? `${n.chain_name} — ` : "")}Subnet: {n.subnet_id || "unknown"}
              </div>
              {(n.public_key && n.proof_of_possession) ? (
                <div className="text-xs text-green-600 dark:text-green-400 leading-tight">BLS PoP available</div>
              ) : (
                <div className="text-xs text-amber-600 dark:text-amber-400 leading-tight">BLS info not available; paste JSON or enter manually</div>
              )}
            </div>
            <Button
              onClick={() => onAdd(n)}
              variant="primary"
              className="shrink-0 !w-auto"
              size="sm"
              disabled={!canAddMore}
            >
              Add
            </Button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-sm text-zinc-600 dark:text-zinc-400">No hosted nodes found for the selected Subnet.</div>
        )}
      </div>
    </div>
  );
}
