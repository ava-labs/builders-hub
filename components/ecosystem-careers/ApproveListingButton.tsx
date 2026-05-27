'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

export function ApproveListingButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function approve() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/ecosystem-careers/listings/${listingId}/approve`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error((body as { error?: string }).error ?? 'Could not approve.');
        return;
      }
      toast.success('Listing approved.');
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error('Network error.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={approve}
      disabled={busy}
      className="shrink-0 inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-60 transition"
    >
      {busy ? 'Approving…' : 'Approve'}
    </button>
  );
}
