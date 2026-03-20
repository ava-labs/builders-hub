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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Loader2, Plus } from 'lucide-react';
import type { CreateAlertRequest } from '@/types/validator-alerts';

interface AddValidatorDialogProps {
  userEmail: string;
  onAdd: (data: CreateAlertRequest) => Promise<{ error?: string }>;
}

export function AddValidatorDialog({ userEmail, onAdd }: AddValidatorDialogProps) {
  const [open, setOpen] = useState(false);
  const [nodeId, setNodeId] = useState('');
  const [label, setLabel] = useState('');
  const [email, setEmail] = useState(userEmail);
  const [uptimeAlert, setUptimeAlert] = useState(true);
  const [uptimeThreshold, setUptimeThreshold] = useState(95);
  const [versionAlert, setVersionAlert] = useState(true);
  const [expiryAlert, setExpiryAlert] = useState(true);
  const [expiryDays, setExpiryDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setNodeId('');
    setLabel('');
    setEmail(userEmail);
    setUptimeAlert(true);
    setUptimeThreshold(80);
    setVersionAlert(true);
    setExpiryAlert(true);
    setExpiryDays(14);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedId = nodeId.trim();
    if (!trimmedId.startsWith('NodeID-')) {
      setError('NodeID must start with "NodeID-"');
      return;
    }

    setLoading(true);
    try {
      const result = await onAdd({
        node_id: trimmedId,
        label: label.trim() || undefined,
        email,
        uptime_alert: uptimeAlert,
        uptime_threshold: uptimeThreshold,
        version_alert: versionAlert,
        expiry_alert: expiryAlert,
        expiry_days: expiryDays,
      });
      if (result.error) {
        setError(result.error);
      } else {
        resetForm();
        setOpen(false);
      }
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Validator
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Validator Alert</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="nodeId">Node ID <span className="text-destructive">*</span></Label>
            <Input
              id="nodeId"
              value={nodeId}
              onChange={(e) => setNodeId(e.target.value)}
              placeholder="NodeID-..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="label">Label (optional)</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="My primary validator"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="alertEmail">Notification Email</Label>
            <Input
              id="alertEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-4 rounded-lg border border-border p-4">
            <p className="text-sm font-medium">Alert Preferences</p>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Uptime Alerts</Label>
                <Switch checked={uptimeAlert} onCheckedChange={setUptimeAlert} />
              </div>
              {uptimeAlert && (
                <div className="pl-1">
                  <Label className="text-xs text-muted-foreground">
                    Threshold: {uptimeThreshold}%
                  </Label>
                  <Slider
                    value={[uptimeThreshold]}
                    onValueChange={([val]) => setUptimeThreshold(val)}
                    min={50}
                    max={99}
                    step={1}
                    className="mt-2"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm">AvalancheGo Upgrade Alerts</Label>
              <Switch checked={versionAlert} onCheckedChange={setVersionAlert} />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Stake Expiry Alerts</Label>
                <Switch checked={expiryAlert} onCheckedChange={setExpiryAlert} />
              </div>
              {expiryAlert && (
                <div className="pl-1">
                  <Label className="text-xs text-muted-foreground">
                    Alert when fewer than {expiryDays} days remain
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(Number(e.target.value))}
                    className="mt-2 w-24 h-8 text-sm"
                  />
                </div>
              )}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Validator
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
