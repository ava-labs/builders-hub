'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

export function DeactivateListingButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    if (!confirm('Deactivate this listing? It will be removed from the public board.')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/ecosystem-careers/listings/${listingId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error((body as { message?: string }).message ?? 'Could not deactivate.');
        return;
      }
      toast.success('Listing deactivated.');
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-60"
    >
      {busy ? 'Deactivating…' : 'Deactivate'}
    </button>
  );
}
