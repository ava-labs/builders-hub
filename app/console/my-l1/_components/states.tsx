'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { AlertTriangle, Layers, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useModalTrigger } from '@/components/toolbox/hooks/useModal';

// Shared chrome for the centered illustration: a soft gradient halo behind
// a tinted icon disc. Tone picks the accent — emerald for empty (positive
// invitation: "let's get started") and amber for error (warning: something
// needs attention).
function StateIcon({
  icon: Icon,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: 'emerald' | 'amber';
}) {
  const ringClass = tone === 'emerald'
    ? 'from-emerald-500/15 via-emerald-500/5 to-transparent'
    : 'from-amber-500/15 via-amber-500/5 to-transparent';
  const discClass = tone === 'emerald'
    ? 'bg-emerald-500/10 ring-1 ring-emerald-500/20 text-emerald-600 dark:text-emerald-400'
    : 'bg-amber-500/10 ring-1 ring-amber-500/20 text-amber-600 dark:text-amber-400';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="relative mb-5 flex items-center justify-center"
    >
      {/* Soft radial halo. Pure decoration — the disc carries the icon. */}
      <div
        className={`absolute h-28 w-28 rounded-full bg-gradient-radial ${ringClass} blur-md`}
        style={{
          background: `radial-gradient(circle, var(--tw-gradient-stops))`,
        }}
        aria-hidden="true"
      />
      <div
        className={`relative flex h-16 w-16 items-center justify-center rounded-2xl ${discClass}`}
      >
        <Icon className="h-7 w-7" />
      </div>
    </motion.div>
  );
}

export function EmptyState() {
  const { openModal: openAddChainModal } = useModalTrigger<{ success: boolean }>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My L1 Dashboard</h1>
        <p className="text-muted-foreground">Manage and monitor your Layer 1 blockchains</p>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="flex flex-col items-center justify-center py-12"
      >
        <StateIcon icon={Layers} tone="emerald" />
        <h2 className="text-xl font-semibold text-foreground mb-2 tracking-tight">
          Ready to launch your first L1?
        </h2>
        <p className="text-sm text-muted-foreground text-center max-w-md mb-6 leading-relaxed">
          Provision a managed L1 with the Quick wizard — it spins up a node, ICM, and a token
          bridge in under 3 minutes. Or connect an existing L1 by RPC URL.
        </p>
        <div className="flex gap-2 flex-wrap justify-center">
          <Link href="/console/create-l1">
            <Button className="gap-1.5">
              <Sparkles className="w-4 h-4" />
              Create L1
            </Button>
          </Link>
          <Button variant="outline" onClick={() => openAddChainModal()}>
            Connect by RPC
          </Button>
          <Link href="/console">
            <Button variant="ghost">Back to Console</Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My L1 Dashboard</h1>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="flex flex-col items-center justify-center py-12"
      >
        <StateIcon icon={AlertTriangle} tone="amber" />
        <h2 className="text-xl font-semibold text-foreground mb-2 tracking-tight">
          We couldn&apos;t load your L1s
        </h2>
        <p className="text-sm text-muted-foreground text-center max-w-md mb-6 leading-relaxed">
          {message}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onRetry}>
            Retry
          </Button>
          <Link href="/api/auth/signin">
            <Button>Sign in</Button>
          </Link>
        </div>
      </motion.div>
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

