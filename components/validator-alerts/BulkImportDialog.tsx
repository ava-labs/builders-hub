'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Upload } from 'lucide-react';
import { toast } from '@/lib/toast';
import type { CreateAlertRequest } from '@/types/validator-alerts';

interface BulkImportDialogProps {
  userEmail: string;
  onAdd: (data: CreateAlertRequest) => Promise<{ error?: string }>;
}

export function BulkImportDialog({ userEmail, onAdd }: BulkImportDialogProps) {
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
        email: userEmail,
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
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setRaw(''); setResults([]); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-2" />
          Bulk Import
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Import Validators</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Paste Node IDs (one per line)</Label>
            <Textarea
              value={raw}
              onChange={(e) => { setRaw(e.target.value); setResults([]); }}
              placeholder={"NodeID-...\nNodeID-...\nNodeID-..."}
              rows={6}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {nodeIds.length} valid NodeID{nodeIds.length !== 1 ? 's' : ''} detected. Default alert preferences will be applied (uptime 95%, version alerts, expiry 7d).
            </p>
          </div>

          {results.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto rounded-md border border-border p-3">
              {results.map((r) => (
                <div key={r.nodeId} className="flex items-center gap-2 text-xs font-mono">
                  <span className={r.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                    {r.ok ? 'OK' : 'ERR'}
                  </span>
                  <span className="truncate flex-1">{r.nodeId}</span>
                  {r.error && <span className="text-muted-foreground shrink-0">{r.error}</span>}
                </div>
              ))}
            </div>
          )}

          <Button
            onClick={handleImport}
            disabled={nodeIds.length === 0 || loading}
            className="w-full"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Import {nodeIds.length} Validator{nodeIds.length !== 1 ? 's' : ''}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
