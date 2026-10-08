'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { format } from 'date-fns';
import { Loader2, LogIn, Server, Settings, Trash2 } from 'lucide-react';
import {
  Board,
  CellLabel,
  FIG,
  HEAD,
  HashChip,
  MUTED,
  Rise,
  RowSkeleton,
  SectionHeader,
  StatCell,
  StatDash,
  StatFigure,
  StatStrip,
  Tabs,
  TxTypePill,
} from '@/components/explorer-v2/ui';
import { cn } from '@/lib/utils';
import l1Chains from '@/constants/l1-chains.json';
import { useLoginModalTrigger, useLoginCompleteListener } from '@/hooks/useLoginModal';
import { toast } from '@/lib/toast';
import { AddValidatorForm } from './AddValidatorForm';
import { BulkImportDialog } from './BulkImportDialog';
import { AlertPreferences } from './AlertPreferences';
import { AlertHistory } from './AlertHistory';
import {
  COUNT,
  EYEBROW,
  ICON_DANGER,
  ICON_SECONDARY,
  PRIMARY_BTN,
  SquareSwitch,
  StatusDot,
  TEXT_TONE,
  type Tone,
} from './ui';
import type { ValidatorAlertResponse, CreateAlertRequest, UpdateAlertRequest } from '@/types/validator-alerts';

interface ValidatorP2P {
  node_id: string;
  p50_uptime: number;
  version: string;
  days_left: number;
  end_time: string;
  weight: number;
  total_stake: number;
}

function getL1ChainName(subnetId: string): string {
  const chain = (l1Chains as { subnetId: string; chainName: string }[]).find((c) => c.subnetId === subnetId);
  return chain?.chainName ?? `L1 (${subnetId.slice(0, 8)}...)`;
}

const COLS = 'md:grid-cols-[0.75rem_minmax(0,1.25fr)_minmax(0,10rem)_minmax(0,1.35fr)_6.75rem]';
/** Full outline, so a board standing alone under a section header reads as one box. */
const BOX = 'border-x border-t';

/** The row's dot: what the live data says about this validator against its own thresholds. */
function subscriptionStatus(
  alert: ValidatorAlertResponse,
  validator: ValidatorP2P | undefined,
  dataLoaded: boolean,
): { tone: Tone; label: string } {
  if (!alert.active) return { tone: 'idle', label: 'Paused' };
  if (alert.subnet_id !== 'primary') return { tone: 'healthy', label: 'Watching' };
  if (validator) {
    if (alert.uptime_alert && validator.p50_uptime < alert.uptime_threshold)
      return { tone: 'alerting', label: 'Uptime below threshold' };
    if (alert.expiry_alert && validator.days_left <= alert.expiry_days)
      return { tone: 'warning', label: 'Stake expiring soon' };
    return { tone: 'healthy', label: 'Healthy' };
  }
  if (dataLoaded) return { tone: 'warning', label: 'Not in active set' };
  return { tone: 'healthy', label: 'Watching' };
}

const uptimeTone = (u: number): Tone => (u >= 99 ? 'healthy' : u >= 80 ? 'warning' : 'alerting');
const expiryTone = (d: number): Tone | null => (d <= 7 ? 'alerting' : d <= 30 ? 'warning' : null);

/** One alert type in the row: a filled square when on, hollow and gray when off. */
function AlertToken({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.1em]',
        on ? 'text-zinc-700 dark:text-zinc-200' : 'text-zinc-400 dark:text-zinc-600',
      )}
    >
      <span
        aria-hidden
        className={cn('size-1.5 shrink-0 border', on ? 'border-current bg-current' : 'border-current')}
      />
      {children}
    </span>
  );
}

function Reading({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">{label}</span>
      <span className={cn('font-mono text-[12px] tabular-nums text-zinc-900 dark:text-zinc-50', className)}>
        {children}
      </span>
    </span>
  );
}

/** The opened row: its preferences and the alerts it has sent. */
function SubscriptionDetails({
  alert,
  onSave,
}: {
  alert: ValidatorAlertResponse;
  onSave: (id: string, data: UpdateAlertRequest) => Promise<void>;
}) {
  const [tab, setTab] = useState<'preferences' | 'history'>('preferences');
  return (
    <div
      id={`alert-details-${alert.id}`}
      className="flex flex-col gap-5 border-t border-zinc-200 bg-zinc-50/60 px-5 py-5 md:px-6 dark:border-zinc-800 dark:bg-zinc-900/30"
    >
      <Tabs
        tabs={['preferences', 'history']}
        active={tab}
        onChange={setTab}
        labels={{
          preferences: 'Preferences',
          history: `Alert history · ${alert.alert_logs.length}`,
        }}
      />
      {tab === 'preferences' ? (
        <AlertPreferences alert={alert} onSave={onSave} />
      ) : (
        <AlertHistory logs={alert.alert_logs} />
      )}
    </div>
  );
}

function PageHeader() {
  return (
    <Rise className="flex flex-col gap-3">
      <p className={EYEBROW}>Primary Network</p>
      <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-zinc-900 md:text-4xl dark:text-zinc-50">
        Validator alerts
      </h1>
      <p className="max-w-2xl text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        Watch your validators and get an email when uptime drops, an AvalancheGo upgrade lands, or stake nears expiry.
      </p>
    </Rise>
  );
}

const PAGE = 'mx-auto flex w-full max-w-6xl flex-col gap-10 pb-20 pt-2';

export function AlertDashboard() {
  const { data: session, status } = useSession();
  const { openLoginModal } = useLoginModalTrigger();

  const [alerts, setAlerts] = useState<ValidatorAlertResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [validatorData, setValidatorData] = useState<Map<string, ValidatorP2P>>(new Map());

  const fetchValidators = useCallback(async () => {
    try {
      const res = await fetch('/api/validators');
      if (res.ok) {
        const data: ValidatorP2P[] = await res.json();
        const map = new Map<string, ValidatorP2P>();
        for (const v of data) {
          map.set(v.node_id, v);
        }
        setValidatorData(map);
      }
    } catch (err) {
      console.error('Failed to fetch validator data:', err);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/validator-alerts');
      if (res.ok) {
        const data = await res.json();
        setAlerts(data);
      }
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchAlerts();
      fetchValidators();
    } else if (status === 'unauthenticated') {
      setLoading(false);
    }
  }, [status, fetchAlerts, fetchValidators]);

  // Re-fetch alerts after login completes (fixes post-login refresh issue)
  useLoginCompleteListener(() => {
    setLoading(true);
    fetchAlerts();
    fetchValidators();
  });

  // Also catch returning users who skip the full login flow (OTP → terms → profile)
  // where triggerLoginComplete() never fires but session status transitions
  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current !== 'authenticated' && status === 'authenticated') {
      setLoading(true);
      fetchAlerts();
      fetchValidators();
    }
    prevStatus.current = status;
  }, [status, fetchAlerts, fetchValidators]);

  async function handleAdd(data: CreateAlertRequest): Promise<{ error?: string }> {
    const res = await fetch('/api/validator-alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) return { error: result.error };
    setAlerts((prev) => [result, ...prev]);
    toast.success('Validator added', 'You will receive alerts for this validator.');
    return {};
  }

  async function handleUpdate(id: string, data: UpdateAlertRequest) {
    const res = await fetch(`/api/validator-alerts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const updated = await res.json();
      setAlerts((prev) => prev.map((a) => (a.id === id ? updated : a)));
      toast.success('Preferences saved');
    } else {
      toast.error('Failed to save preferences');
    }
  }

  async function handleToggleActive(id: string, active: boolean) {
    setTogglingId(id);
    const res = await fetch(`/api/validator-alerts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    if (res.ok) {
      const updated = await res.json();
      setAlerts((prev) => prev.map((a) => (a.id === id ? updated : a)));
      toast.success(active ? 'Alerts resumed' : 'Alerts paused');
    } else {
      toast.error('Failed to update alert status');
    }
    setTogglingId(null);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const res = await fetch(`/api/validator-alerts/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      if (expandedId === id) setExpandedId(null);
      toast.success('Validator alert removed');
    } else {
      toast.error('Failed to remove alert');
    }
    setDeletingId(null);
  }

  // Unauthenticated state
  if (status === 'unauthenticated') {
    return (
      <div className={PAGE}>
        <PageHeader />
        <Rise delay={0.04}>
          <div className="flex flex-col gap-4 border border-zinc-200 bg-white/80 px-5 py-5 sm:flex-row sm:items-center sm:justify-between md:px-6 dark:border-zinc-800 dark:bg-zinc-950/80">
            <div className="flex flex-col gap-1.5">
              <p className={EYEBROW}>Signed out</p>
              <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">
                Sign in to manage validator alerts
              </h2>
              <p className="max-w-xl text-[13.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                Get email notifications when your validators experience uptime drops, version mismatches, or approaching
                stake expiry.
              </p>
            </div>
            <button type="button" onClick={() => openLoginModal('/validator-alerts')} className={PRIMARY_BTN}>
              <LogIn className="h-3.5 w-3.5" aria-hidden />
              Sign in
            </button>
          </div>
        </Rise>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className={PAGE} role="status" aria-label="Loading validator alerts">
        <PageHeader />
        <StatStrip cols={4}>
          {['Watched', 'Active', 'Recent alerts', 'Last triggered'].map((label) => (
            <StatCell key={label} label={label} even>
              <StatDash />
            </StatCell>
          ))}
        </StatStrip>
        <section className="flex flex-col gap-4">
          <SectionHeader label="Subscriptions" />
          <Board className={BOX}>
            <RowSkeleton n={3} />
          </Board>
        </section>
      </div>
    );
  }

  const userEmail = session?.user?.email ?? '';

  const activeCount = alerts.filter((a) => a.active).length;
  const l1Count = alerts.filter((a) => a.subnet_id !== 'primary').length;
  const triggered = alerts
    .flatMap((a) => a.alert_logs.filter((l) => l.alert_type !== 'welcome').map((l) => ({ alert: a, log: l })))
    .sort((x, y) => new Date(y.log.sent_at).getTime() - new Date(x.log.sent_at).getTime());
  const lastTriggered = triggered[0];

  return (
    <div className={PAGE}>
      <PageHeader />

      <Rise delay={0.04}>
        <StatStrip cols={4}>
          <StatCell
            label="Watched"
            sub={alerts.length > 0 ? `${alerts.length - l1Count} primary · ${l1Count} L1` : 'No validators yet'}
          >
            <StatFigure value={alerts.length} />
          </StatCell>
          <StatCell
            label="Active"
            live={activeCount > 0}
            sub={alerts.length - activeCount > 0 ? `${alerts.length - activeCount} paused` : 'None paused'}
          >
            <StatFigure value={activeCount} />
          </StatCell>
          <StatCell label="Recent alerts" sub="Latest per validator">
            <StatFigure value={triggered.length} />
          </StatCell>
          <StatCell
            label="Last triggered"
            sub={
              lastTriggered ? (
                <span className="block truncate">{lastTriggered.alert.label ?? lastTriggered.alert.node_id}</span>
              ) : (
                'Nothing sent yet'
              )
            }
          >
            {lastTriggered ? (
              <span className={FIG}>{format(new Date(lastTriggered.log.sent_at), 'MMM d, HH:mm')}</span>
            ) : (
              <StatDash />
            )}
          </StatCell>
        </StatStrip>
      </Rise>

      <Rise delay={0.08}>
        <AddValidatorForm userEmail={userEmail} onAdd={handleAdd} action={<BulkImportDialog onAdd={handleAdd} />} />
      </Rise>

      <Rise delay={0.12}>
        <section className="flex flex-col gap-4">
          <SectionHeader
            label="Subscriptions"
            action={
              <span className={COUNT}>
                {alerts.length} validator{alerts.length !== 1 ? 's' : ''}
              </span>
            }
          />

          {alerts.length === 0 ? (
            <div className="flex flex-col items-start gap-3 border border-zinc-200 bg-white/80 px-5 py-8 md:px-6 dark:border-zinc-800 dark:bg-zinc-950/80">
              <p className={cn(EYEBROW, 'flex items-center gap-2')}>
                <Server className="h-3.5 w-3.5" aria-hidden />
                No validators registered
              </p>
              <p className="max-w-xl text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                Add your first validator above to start receiving uptime, version, and stake expiry alerts.
              </p>
            </div>
          ) : (
            <Board className={BOX}>
              <div className={cn(HEAD, COLS)}>
                <span />
                <span>Validator</span>
                <span>Live status</span>
                <span>Alerts</span>
                <span className="text-right">
                  <span className="sr-only">Actions</span>
                </span>
              </div>
              {alerts.map((alert) => {
                const isExpanded = expandedId === alert.id;
                const recentAlerts = alert.alert_logs.length;
                const validator = validatorData.get(alert.node_id);
                const isL1 = alert.subnet_id !== 'primary';
                const state = subscriptionStatus(alert, validator, validatorData.size > 0);
                const name = alert.label ?? alert.node_id;
                return (
                  <div key={alert.id}>
                    <div
                      className={cn(
                        'grid grid-cols-[0.75rem_minmax(0,1fr)] items-start gap-x-4 gap-y-3 px-5 py-4 transition-colors md:items-center md:px-6 md:py-3',
                        COLS,
                        !alert.active && 'bg-zinc-50/60 dark:bg-zinc-900/30',
                        isExpanded && 'bg-zinc-50 dark:bg-zinc-900/60',
                      )}
                    >
                      <span className="flex h-5 items-center md:h-auto">
                        <StatusDot tone={state.tone} label={state.label} />
                      </span>

                      <div className="flex min-w-0 flex-col gap-1">
                        {alert.label && (
                          <span className="truncate text-[13.5px] font-medium text-zinc-900 dark:text-zinc-50">
                            {alert.label}
                          </span>
                        )}
                        <HashChip value={alert.node_id} len={14} />
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <TxTypePill
                            type={isL1 ? 'l1' : 'primary'}
                            label={isL1 ? getL1ChainName(alert.subnet_id) : 'Primary Network'}
                          />
                          <span
                            className={cn(
                              'font-mono text-[10px] font-bold uppercase tracking-[0.14em]',
                              TEXT_TONE[state.tone],
                            )}
                          >
                            {state.label}
                          </span>
                        </span>
                      </div>

                      <div className="col-start-2 min-w-0 md:col-start-auto">
                        <CellLabel>Live status</CellLabel>
                        {!isL1 && validator ? (
                          <span className="flex flex-wrap gap-x-3 gap-y-1 md:flex-col md:gap-y-0.5">
                            <Reading label="Uptime" className={TEXT_TONE[uptimeTone(validator.p50_uptime)]}>
                              {validator.p50_uptime.toFixed(1)}%
                            </Reading>
                            <Reading label="Version">{validator.version || 'N/A'}</Reading>
                            <Reading
                              label="Expires"
                              className={cn(
                                expiryTone(validator.days_left) && TEXT_TONE[expiryTone(validator.days_left)!],
                              )}
                            >
                              {validator.days_left}d
                            </Reading>
                          </span>
                        ) : !isL1 && validatorData.size > 0 ? (
                          <span className={MUTED}>Not in active set</span>
                        ) : (
                          <span className={MUTED}>—</span>
                        )}
                      </div>

                      <div className="col-start-2 flex min-w-0 flex-col gap-1.5 md:col-start-auto">
                        <CellLabel>Alerts</CellLabel>
                        <span className="flex flex-wrap gap-x-3 gap-y-1">
                          {!isL1 && (
                            <AlertToken on={alert.uptime_alert}>
                              {alert.uptime_alert ? (
                                <span className="tabular-nums">Uptime &lt; {alert.uptime_threshold}%</span>
                              ) : (
                                'Uptime off'
                              )}
                            </AlertToken>
                          )}
                          <AlertToken on={alert.version_alert}>
                            {alert.version_alert ? 'Upgrade' : 'Upgrade off'}
                          </AlertToken>
                          {!isL1 && (
                            <AlertToken on={alert.expiry_alert}>
                              {alert.expiry_alert ? (
                                <span className="tabular-nums">Expiry &lt; {alert.expiry_days}d</span>
                              ) : (
                                'Expiry off'
                              )}
                            </AlertToken>
                          )}
                          {isL1 && (
                            <AlertToken on={alert.balance_alert}>
                              {alert.balance_alert ? (
                                <span className="tabular-nums">
                                  Balance &lt; {alert.balance_threshold_days}d runway
                                </span>
                              ) : (
                                'Balance off'
                              )}
                            </AlertToken>
                          )}
                          {!isL1 && (
                            <AlertToken on={alert.security_alert}>
                              {alert.security_alert ? 'Security' : 'Security off'}
                            </AlertToken>
                          )}
                        </span>
                        <span className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5 font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                          <span className="min-w-0 truncate" title={alert.email}>
                            Email · {alert.email}
                          </span>
                          {recentAlerts > 0 && (
                            <span className="shrink-0 tabular-nums text-amber-700 dark:text-amber-400">
                              {recentAlerts} recent
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="col-start-2 flex items-center gap-2 md:col-start-auto md:justify-end">
                        <span className="flex h-8 w-10 items-center justify-center">
                          {togglingId === alert.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-zinc-400" aria-label="Updating" />
                          ) : (
                            <SquareSwitch
                              checked={alert.active}
                              onCheckedChange={(checked) => handleToggleActive(alert.id, checked)}
                              aria-label={alert.active ? `Pause alerts for ${name}` : `Resume alerts for ${name}`}
                            />
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                          aria-expanded={isExpanded}
                          aria-controls={isExpanded ? `alert-details-${alert.id}` : undefined}
                          aria-label={`Preferences and history for ${name}`}
                          title="Preferences and history"
                          className={cn(
                            ICON_SECONDARY,
                            isExpanded && 'border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-50',
                          )}
                        >
                          <Settings className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(alert.id)}
                          disabled={deletingId === alert.id}
                          aria-label={`Remove alerts for ${name}`}
                          title="Remove"
                          className={ICON_DANGER}
                        >
                          {deletingId === alert.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {isExpanded && <SubscriptionDetails alert={alert} onSave={handleUpdate} />}
                  </div>
                );
              })}
            </Board>
          )}
        </section>
      </Rise>
    </div>
  );
}
