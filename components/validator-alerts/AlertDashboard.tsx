'use client';

import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { useLoginModalTrigger } from '@/hooks/useLoginModal';
import { AddValidatorDialog } from './AddValidatorDialog';
import { AlertPreferences } from './AlertPreferences';
import { AlertHistory } from './AlertHistory';
import type {
  ValidatorAlertResponse,
  CreateAlertRequest,
  UpdateAlertRequest,
} from '@/types/validator-alerts';

export function AlertDashboard() {
  const { data: session, status } = useSession();
  const { openLoginModal } = useLoginModalTrigger();

  const [alerts, setAlerts] = useState<ValidatorAlertResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

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
    } else if (status === 'unauthenticated') {
      setLoading(false);
    }
  }, [status, fetchAlerts]);

  async function handleAdd(data: CreateAlertRequest): Promise<{ error?: string }> {
    const res = await fetch('/api/validator-alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) return { error: result.error };
    setAlerts((prev) => [result, ...prev]);
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
    }
  }

  async function handleToggleActive(id: string, active: boolean) {
    setTogglingId(id);
    await handleUpdate(id, { active });
    setTogglingId(null);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const res = await fetch(`/api/validator-alerts/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      if (expandedId === id) setExpandedId(null);
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
        <AddValidatorDialog userEmail={userEmail} onAdd={handleAdd} />
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
                    <Bell className="h-3 w-3" /> Version
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs gap-1 opacity-50">
                    <BellOff className="h-3 w-3" /> Version off
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
