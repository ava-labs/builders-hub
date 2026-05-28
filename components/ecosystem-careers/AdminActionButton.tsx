'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Props {
  endpoint: string;
  method?: 'POST' | 'DELETE';
  label: string;
  busyLabel: string;
  successMessage: string;
  errorMessage?: string;
  confirmMessage?: string;
  variant?: 'primary' | 'outline' | 'destructive';
  size?: 'sm' | 'md';
}

const VARIANT_CLASSES: Record<NonNullable<Props['variant']>, string> = {
  primary:
    'inline-flex items-center shrink-0 font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-60 transition',
  outline:
    'inline-flex items-center font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-60',
  destructive:
    'inline-flex items-center font-semibold rounded-lg bg-red-600 text-white hover:bg-red-500 disabled:opacity-60 transition',
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
  const [confirmOpen, setConfirmOpen] = useState(false);

  const buttonClasses = `${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]}`;

  async function runAction() {
    if (busy) return;
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

  function handleClick() {
    if (busy) return;
    if (confirmMessage) {
      setConfirmOpen(true);
      return;
    }
    void runAction();
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={buttonClasses}
      >
        {busy ? busyLabel : label}
      </button>

      {confirmMessage && (
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{label}?</AlertDialogTitle>
              <AlertDialogDescription>{confirmMessage}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={busy}
                className={buttonClasses}
                onClick={(e) => {
                  e.preventDefault();
                  setConfirmOpen(false);
                  void runAction();
                }}
              >
                {busy ? busyLabel : label}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
