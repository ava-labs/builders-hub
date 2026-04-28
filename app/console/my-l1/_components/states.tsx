'use client';

import Link from 'next/link';
import { Layers, RefreshCw, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useModalTrigger } from '@/components/toolbox/hooks/useModal';

export function EmptyState() {
  const { openModal: openAddChainModal } = useModalTrigger<{ success: boolean }>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My L1 Dashboard</h1>
        <p className="text-muted-foreground">Manage and monitor your Layer 1 blockchains</p>
      </div>
      <div className="flex flex-col items-center justify-center py-16">
        <div className="p-4 rounded-full bg-muted mb-4">
          <Layers className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">No L1s yet</h2>
        <p className="text-muted-foreground text-center max-w-md mb-6">
          You haven&apos;t provisioned a managed L1 or added one to your wallet yet. Create one
          with the Quick L1 wizard — it spins up a node, ICM, and a token bridge in under 3
          minutes — or connect an existing L1 by RPC URL.
        </p>
        <div className="flex gap-3 flex-wrap justify-center">
          <Link href="/console/create-l1">
            <Button>Create L1</Button>
          </Link>
          <Button variant="outline" onClick={() => openAddChainModal()}>
            Connect by RPC
          </Button>
          <Link href="/console">
            <Button variant="ghost">Back to Console</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My L1 Dashboard</h1>
      </div>
      <div className="flex flex-col items-center justify-center py-16">
        <div className="p-4 rounded-full bg-muted mb-4">
          <Wallet className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground text-center max-w-md mb-6">{message}</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onRetry}>
            Retry
          </Button>
          <Link href="/api/auth/signin">
            <Button>Sign in</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export function HeaderSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    </div>
  );
}

export function NoActiveL1sNote({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My L1 Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            No active L1s right now — your past chains are listed below for reference.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Link href="/console/create-l1">
            <Button size="sm">
              <Layers className="w-4 h-4 mr-2" />
              Create L1
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
