'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Loader2, Upload, X } from 'lucide-react';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import type { CreateAlertRequest } from '@/types/validator-alerts';
import { EYEBROW, FIELD_LABEL, HoverArrow, PRIMARY_BTN, SECONDARY_BTN } from './ui';

interface BulkImportDialogProps {
  onAdd: (data: CreateAlertRequest) => Promise<{ error?: string }>;
}

export function BulkImportDialog({ onAdd }: BulkImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ nodeId: string; ok: boolean; error?: string }[]>([]);

  function parseNodeIds(text: string): string[] {
    return text
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.startsWith('NodeID-'));
  }

  const nodeIds = parseNodeIds(raw);

  async function handleImport() {
    if (nodeIds.length === 0) return;

    setLoading(true);
    setResults([]);
    const importResults: { nodeId: string; ok: boolean; error?: string }[] = [];

    for (const nodeId of nodeIds) {
      const result = await onAdd({
        node_id: nodeId,
      });
      importResults.push({
        nodeId,
        ok: !result.error,
        error: result.error,
      });
    }

    setResults(importResults);
    setLoading(false);

    const succeeded = importResults.filter((r) => r.ok).length;
    const failed = importResults.filter((r) => !r.ok).length;

    if (succeeded > 0 && failed === 0) {
      toast.success(`${succeeded} validator${succeeded > 1 ? 's' : ''} added`);
      setOpen(false);
      setRaw('');
      setResults([]);
    } else if (succeeded > 0) {
      toast.warning(`${succeeded} added, ${failed} failed`);
    } else {
      toast.error('All imports failed');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setRaw('');
          setResults([]);
        }
      }}
    >
      <DialogTrigger asChild>
        <button type="button" className={cn(SECONDARY_BTN, 'h-7 px-3 text-[10px]')}>
          <Upload className="h-3 w-3" aria-hidden />
          Bulk import
        </button>
      </DialogTrigger>
      <DialogContent
        hideCloseButton
        className="max-h-[85vh] gap-0 overflow-y-auto rounded-none border-zinc-200 bg-white p-0 shadow-xl sm:max-w-lg dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
          <div className="flex flex-col gap-2">
            <p className={EYEBROW}>Bulk import</p>
            <DialogTitle className="text-[18px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Add several validators at once
            </DialogTitle>
            <DialogDescription className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              Default preferences apply: uptime below <span className="font-mono tabular-nums">95%</span>, upgrade
              alerts, expiry at <span className="font-mono tabular-nums">7d</span>.
            </DialogDescription>
          </div>
          <DialogClose
            className="-m-1.5 p-1.5 text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </DialogClose>
        </div>

        <div className="flex flex-col gap-5 px-6 py-5">
          <label className="flex flex-col gap-2" htmlFor="bulk-node-ids">
            <span className={FIELD_LABEL}>Node IDs, one per line</span>
            <textarea
              id="bulk-node-ids"
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value);
                setResults([]);
              }}
              placeholder={'NodeID-...\nNodeID-...\nNodeID-...'}
              rows={6}
              spellCheck={false}
              className="w-full resize-y border border-zinc-300 bg-white/80 px-3 py-2 font-mono text-[12.5px] leading-relaxed text-zinc-900 transition-colors placeholder:text-zinc-400 hover:border-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950/80 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:hover:border-zinc-600 dark:focus:border-zinc-100"
            />
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-zinc-400 dark:text-zinc-500">
              {nodeIds.length} valid NodeID{nodeIds.length !== 1 ? 's' : ''} detected
            </span>
          </label>

          {results.length > 0 && (
            <div className="max-h-40 divide-y divide-zinc-200 overflow-y-auto border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {results.map((r) => (
                <div key={r.nodeId} className="flex items-center gap-3 px-3 py-2 font-mono text-[11.5px]">
                  <span
                    className={cn(
                      'shrink-0 font-bold uppercase tracking-[0.14em]',
                      r.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400',
                    )}
                  >
                    {r.ok ? 'OK' : 'ERR'}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-zinc-900 dark:text-zinc-50">{r.nodeId}</span>
                  {r.error && <span className="shrink-0 text-zinc-500 dark:text-zinc-400">{r.error}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <button
            type="button"
            onClick={handleImport}
            disabled={nodeIds.length === 0 || loading}
            className={PRIMARY_BTN}
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            Import {nodeIds.length} validator{nodeIds.length !== 1 ? 's' : ''}
            <HoverArrow />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
