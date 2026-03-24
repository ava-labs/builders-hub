'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  AlertTriangle,
  Bell,
  BellOff,
  Trash2,
  Settings,
  History,
  Loader2,
  Server,
  Activity,
  Clock,
  GitBranch,
} from 'lucide-react';
import { useLoginModalTrigger, useLoginCompleteListener } from '@/hooks/useLoginModal';
import { toast } from '@/lib/toast';
import { AddValidatorDialog } from './AddValidatorDialog';
import { BulkImportDialog } from './BulkImportDialog';
import { AlertPreferences } from './AlertPreferences';
import { AlertHistory } from './AlertHistory';
import type {
  ValidatorAlertResponse,
  CreateAlertRequest,
  UpdateAlertRequest,
} from '@/types/validator-alerts';

interface ValidatorP2P {
  node_id: string;
  p50_uptime: number;
  version: string;
  days_left: number;
  end_time: string;
  weight: number;
  total_stake: number;
}

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

  // Also handle direct session transitions (returning users skip the full
  // login flow so triggerLoginComplete may never fire).
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
      <Card className="max-w-2xl mx-auto">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <Bell className="h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Sign in to manage validator alerts</h2>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Get email notifications when your validators experience uptime drops, version mismatches, or approaching stake expiry.
          </p>
          <Button onClick={() => openLoginModal('/validator-alerts')}>
            Sign In
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-36" />
        </div>
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const userEmail = session?.user?.email ?? '';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Validator Alerts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor your validators and get notified of issues
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BulkImportDialog userEmail={userEmail} onAdd={handleAdd} />
          <AddValidatorDialog userEmail={userEmail} onAdd={handleAdd} />
        </div>
      </div>

      {/* Empty state */}
      {alerts.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Server className="h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-medium">No validators registered</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Add your first validator to start receiving uptime, version, and stake expiry alerts.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Alert cards */}
      {alerts.map((alert) => {
        const isExpanded = expandedId === alert.id;
        const recentAlerts = alert.alert_logs.length;
        const validator = validatorData.get(alert.node_id);
        return (
          <Card key={alert.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-base font-mono truncate">
                      {alert.label ?? alert.node_id}
                    </CardTitle>
                    {!alert.active && (
                      <Badge variant="secondary" className="text-xs">
                        Paused
                      </Badge>
                    )}
                  </div>
                  {alert.label && (
                    <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                      {alert.node_id}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {togglingId === alert.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Switch
                      checked={alert.active}
                      onCheckedChange={(checked) => handleToggleActive(alert.id, checked)}
                      aria-label={alert.active ? 'Pause alerts' : 'Resume alerts'}
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(alert.id)}
                    disabled={deletingId === alert.id}
                  >
                    {deletingId === alert.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              {/* Live validator status */}
              {validator ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-border bg-muted/40 px-3 py-2 mb-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    Uptime:{' '}
                    <span className={
                      validator.p50_uptime >= 99
                        ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                        : validator.p50_uptime >= 80
                          ? 'text-amber-600 dark:text-amber-400 font-medium'
                          : 'text-red-600 dark:text-red-400 font-medium'
                    }>
                      {validator.p50_uptime.toFixed(1)}%
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <GitBranch className="h-3 w-3" />
                    Version: <span className="font-medium text-foreground">{validator.version || 'N/A'}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Expires:{' '}
                    <span className={
                      validator.days_left <= 7
                        ? 'text-red-600 dark:text-red-400 font-medium'
                        : validator.days_left <= 30
                          ? 'text-amber-600 dark:text-amber-400 font-medium'
                          : 'text-foreground font-medium'
                    }>
                      {validator.days_left}d
                    </span>
                  </span>
                </div>
              ) : validatorData.size > 0 ? (
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2 mb-3 text-xs text-muted-foreground">
                  Not in active set
                </div>
              ) : null}

              {/* Status badges */}
              <div className="flex flex-wrap gap-2 mb-3">
                {alert.uptime_alert ? (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Bell className="h-3 w-3" /> Uptime &lt; {alert.uptime_threshold}%
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs gap-1 opacity-50">
                    <BellOff className="h-3 w-3" /> Uptime off
                  </Badge>
                )}
                {alert.version_alert ? (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Bell className="h-3 w-3" /> AvalancheGo Upgrade
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs gap-1 opacity-50">
                    <BellOff className="h-3 w-3" /> Upgrade off
                  </Badge>
                )}
                {alert.expiry_alert ? (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Bell className="h-3 w-3" /> Expiry &lt; {alert.expiry_days}d
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs gap-1 opacity-50">
                    <BellOff className="h-3 w-3" /> Expiry off
                  </Badge>
                )}
                {recentAlerts > 0 && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <AlertTriangle className="h-3 w-3" /> {recentAlerts} recent
                  </Badge>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Notifications to {alert.email}
              </p>

              {/* Expanded section */}
              {isExpanded && (
                <div className="mt-4 border-t border-border pt-4">
                  <Tabs defaultValue="preferences">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="preferences" className="gap-1.5 text-xs">
                        <Settings className="h-3.5 w-3.5" /> Preferences
                      </TabsTrigger>
                      <TabsTrigger value="history" className="gap-1.5 text-xs">
                        <History className="h-3.5 w-3.5" /> Alert History
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="preferences" className="mt-4">
                      <AlertPreferences alert={alert} onSave={handleUpdate} />
                    </TabsContent>
                    <TabsContent value="history" className="mt-4">
                      <AlertHistory logs={alert.alert_logs} />
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
