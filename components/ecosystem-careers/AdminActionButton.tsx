'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

interface Props {
  endpoint: string;
  method?: 'POST' | 'DELETE';
  label: string;
  busyLabel: string;
  successMessage: string;
  errorMessage?: string;
  confirmMessage?: string;
  variant?: 'primary' | 'outline';
  size?: 'sm' | 'md';
}

const VARIANT_CLASSES: Record<NonNullable<Props['variant']>, string> = {
  primary:
    'inline-flex items-center shrink-0 font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-60 transition',
  outline:
    'inline-flex items-center font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-60',
};

const SIZE_CLASSES: Record<NonNullable<Props['size']>, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
};

export function AdminActionButton({
  endpoint,
  method = 'POST',
  label,
  busyLabel,
  successMessage,
  errorMessage = 'Could not perform action.',
  confirmMessage,
  variant = 'primary',
  size = 'sm',
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    if (confirmMessage && !confirm(confirmMessage)) return;
    setBusy(true);
    try {
      const res = await fetch(endpoint, { method });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        toast.error(body.error ?? body.message ?? errorMessage);
        return;
      }
      toast.success(successMessage);
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
      className={`${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]}`}
    >
      {busy ? busyLabel : label}
    </button>
  );
}
