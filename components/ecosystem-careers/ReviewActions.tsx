'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

export function ReviewActions({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);

  async function approve() {
    if (busy) return;
    setBusy('approve');
    try {
      const res = await fetch(
        `/api/admin/ecosystem-careers/projects/${projectId}/approve`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error((body as { error?: string }).error ?? 'Could not approve.');
        return;
      }
      toast.success('Approved — listings are live.');
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error('Network error.');
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    if (busy) return;
    const reason = window.prompt('Reason for rejection (optional, shown to the team):') ?? '';
    if (reason === null) return;
    setBusy('reject');
    try {
      const res = await fetch(
        `/api/admin/ecosystem-careers/projects/${projectId}/reject`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error((body as { error?: string }).error ?? 'Could not reject.');
        return;
      }
      toast.success('Rejected.');
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error('Network error.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={approve}
        disabled={!!busy}
        className="inline-flex items-center px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-60 transition"
      >
        {busy === 'approve' ? 'Approving…' : 'Approve'}
      </button>
      <button
        type="button"
        onClick={reject}
        disabled={!!busy}
        className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg border border-rose-300 dark:border-rose-500/50 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 disabled:opacity-60 transition"
      >
        {busy === 'reject' ? 'Rejecting…' : 'Reject'}
      </button>
    </div>
  );
}
