'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export type AddTokenResult =
  | { ok: true; persisted: boolean }
  | { ok: false; error: string };

export interface AddTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  l1ChainName: string;
  onSubmit: (address: string) => Promise<AddTokenResult>;
}

// How long the persistence-failed note stays on screen before the dialog
// closes itself. Short enough to feel like a confirmation, long enough
// for a user to actually read it.
const PERSISTENCE_WARNING_DELAY_MS = 2500;

export function AddTokenDialog({ open, onOpenChange, l1ChainName, onSubmit }: AddTokenDialogProps) {
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Holds the inline note shown when the add succeeded but localStorage
  // refused the write. When non-null, the dialog stays open for a short
  // delay so the user sees the message before it closes itself.
  const [persistenceWarning, setPersistenceWarning] = useState<string | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset form when the dialog opens — paste-and-add flow is the common
  // case, and a stale error message from the previous attempt is noise.
  useEffect(() => {
    if (open) {
      setAddress('');
      setError(null);
      setSubmitting(false);
      setPersistenceWarning(null);
    }
  }, [open]);

  // Clear any pending auto-close timeout on unmount or when the dialog
  // closes — otherwise a fast-clicking user could trigger onOpenChange
  // twice (once via the timeout, once via their own click).
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, []);

  const handleSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (submitting || persistenceWarning) return;

    setSubmitting(true);
    setError(null);
    try {
      const result = await onSubmit(address);
      if (result.ok) {
        if (result.persisted) {
          onOpenChange(false);
          return;
        }
        // The token is in the session map but the browser refused to
        // persist it. Surface the outcome before closing so the user
        // knows it won't survive a reload.
        setPersistenceWarning(
          'Saved for this session — your browser blocked saving it across reloads.',
        );
        closeTimeoutRef.current = setTimeout(() => {
          closeTimeoutRef.current = null;
          onOpenChange(false);
        }, PERSISTENCE_WARNING_DELAY_MS);
        return;
      }
      setError(result.error);
    } catch (err) {
      console.error('AddTokenDialog submit failed:', err);
      setError('Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit button is disabled while we're verifying, while the post-
  // success warning is on screen (the work is done — re-submitting it
  // would just trigger a noop), and when the address field is empty.
  const submitDisabled = !address || submitting || persistenceWarning !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a custom token</DialogTitle>
          <DialogDescription>
            Paste the ERC-20 contract address. We&apos;ll verify it lives on {l1ChainName} and add
            it to your token list.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="token-address" className="text-xs font-medium text-foreground mb-1.5 block">
              Contract address
            </label>
            <Input
              id="token-address"
              type="text"
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="off"
              placeholder="0x..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={submitting || persistenceWarning !== null}
              className="font-mono text-xs"
            />
            {error && (
              <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
            {persistenceWarning && (
              <p
                className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300"
                role="status"
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{persistenceWarning}</span>
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitDisabled}>
              {submitting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              {submitting ? 'Verifying…' : 'Add token'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
