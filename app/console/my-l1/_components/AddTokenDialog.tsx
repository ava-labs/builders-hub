'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
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

export interface AddTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  l1ChainName: string;
  onSubmit: (address: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}

export function AddTokenDialog({ open, onOpenChange, l1ChainName, onSubmit }: AddTokenDialogProps) {
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset form when the dialog opens — paste-and-add flow is the common
  // case, and a stale error message from the previous attempt is noise.
  useEffect(() => {
    if (open) {
      setAddress('');
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const result = await onSubmit(address);
      if (result.ok) {
        onOpenChange(false);
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
              disabled={submitting}
              className="font-mono text-xs"
            />
            {error && (
              <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p>
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
            <Button type="submit" disabled={!address || submitting}>
              {submitting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              {submitting ? 'Verifying…' : 'Add token'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
