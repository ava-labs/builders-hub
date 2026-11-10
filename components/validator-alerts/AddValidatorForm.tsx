'use client';

import { useState } from 'react';
import { Activity, AlertTriangle, Clock, GitBranch, Loader2, Shield } from 'lucide-react';
import { Board, BoardHeader } from '@/components/explorer-v2/ui';
import { cn } from '@/lib/utils';
import type { CreateAlertRequest } from '@/types/validator-alerts';
import { AlertOption, EYEBROW, FIELD, FIELD_LABEL, HoverArrow, OPTION_GRID, PRIMARY_BTN, SquareSlider } from './ui';

interface AddValidatorFormProps {
  userEmail: string;
  onAdd: (data: CreateAlertRequest) => Promise<{ error?: string }>;
  /** extra controls in the board's title bar (bulk import) */
  action?: React.ReactNode;
}

export function AddValidatorForm({ userEmail, onAdd, action }: AddValidatorFormProps) {
  const [nodeId, setNodeId] = useState('');
  const [label, setLabel] = useState('');
  const [uptimeAlert, setUptimeAlert] = useState(true);
  const [uptimeThreshold, setUptimeThreshold] = useState(95);
  const [versionAlert, setVersionAlert] = useState(true);
  const [expiryAlert, setExpiryAlert] = useState(true);
  const [expiryDays, setExpiryDays] = useState(7);
  const [securityAlert, setSecurityAlert] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setNodeId('');
    setLabel('');
    setUptimeAlert(true);
    setUptimeThreshold(95);
    setVersionAlert(true);
    setExpiryAlert(true);
    setExpiryDays(7);
    setSecurityAlert(false);
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
        uptime_alert: uptimeAlert,
        uptime_threshold: uptimeThreshold,
        version_alert: versionAlert,
        expiry_alert: expiryAlert,
        expiry_days: expiryDays,
        security_alert: securityAlert,
      });
      if (result.error) {
        setError(result.error);
      } else {
        resetForm();
      }
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Board divide={false} className="border-x border-t">
      <BoardHeader label="Add a validator" display action={action} />
      <form onSubmit={handleSubmit} className="flex flex-col gap-6 px-5 py-5 md:px-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <label className="flex flex-col gap-2" htmlFor="nodeId">
            <span className={FIELD_LABEL}>
              Node ID <span className="text-[#E6212F]">*</span>
            </span>
            <input
              id="nodeId"
              value={nodeId}
              onChange={(e) => setNodeId(e.target.value)}
              placeholder="NodeID-..."
              required
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!!error || undefined}
              aria-describedby={error ? 'add-validator-error' : undefined}
              className={cn(FIELD, 'font-mono')}
            />
          </label>
          <label className="flex flex-col gap-2" htmlFor="label">
            <span className={FIELD_LABEL}>Label (optional)</span>
            <input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="My primary validator"
              className={FIELD}
            />
          </label>
        </div>

        <div className="flex flex-col gap-3">
          <p className={EYEBROW}>Alert me about</p>
          <div className={OPTION_GRID}>
            <AlertOption
              id="add-uptime"
              icon={<Activity className="h-4 w-4" />}
              title="Uptime"
              description="When uptime drops below your threshold."
              checked={uptimeAlert}
              onCheckedChange={setUptimeAlert}
            >
              <div className="flex flex-col gap-3">
                <span className="flex items-baseline justify-between gap-3">
                  <span className={FIELD_LABEL}>Threshold</span>
                  <span className="font-mono text-[13px] tabular-nums text-zinc-900 dark:text-zinc-50">
                    {uptimeThreshold}%
                  </span>
                </span>
                <SquareSlider
                  value={uptimeThreshold}
                  onValueChange={setUptimeThreshold}
                  min={50}
                  max={99}
                  step={1}
                  aria-label="Uptime threshold"
                />
              </div>
            </AlertOption>
            <AlertOption
              id="add-version"
              icon={<GitBranch className="h-4 w-4" />}
              title="AvalancheGo upgrades"
              description="When a new AvalancheGo release ships. Mandatory upgrades are escalated."
              checked={versionAlert}
              onCheckedChange={setVersionAlert}
            />
            <AlertOption
              id="add-expiry"
              icon={<Clock className="h-4 w-4" />}
              title="Stake expiry"
              description="When your stake is close to its end time."
              checked={expiryAlert}
              onCheckedChange={setExpiryAlert}
            >
              <label className="flex items-center justify-between gap-3" htmlFor="add-expiry-days">
                <span className={FIELD_LABEL}>Days before expiry</span>
                <input
                  id="add-expiry-days"
                  type="number"
                  min={1}
                  max={365}
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(Number(e.target.value))}
                  className={cn(FIELD, 'h-8 w-24 font-mono tabular-nums')}
                />
              </label>
            </AlertOption>
            <AlertOption
              id="add-security"
              icon={<Shield className="h-4 w-4" />}
              title="Security checks"
              description="Primary Network validators: public port 9650 exposure and IP address changes."
              checked={securityAlert}
              onCheckedChange={setSecurityAlert}
            />
          </div>
        </div>

        {error && (
          <div
            id="add-validator-error"
            role="alert"
            className="flex items-center gap-3 border border-red-200 bg-red-50/60 px-4 py-3 text-[13px] text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4 border-t border-zinc-200 pt-5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
          <p className="min-w-0 text-[13px] text-zinc-500 dark:text-zinc-400">
            Alerts go to your account email{' '}
            <span className="font-mono text-[12.5px] text-zinc-900 [overflow-wrap:anywhere] dark:text-zinc-50">
              {userEmail}
            </span>
          </p>
          <button type="submit" disabled={loading} className={PRIMARY_BTN}>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            Add validator
            <HoverArrow />
          </button>
        </div>
      </form>
    </Board>
  );
}
