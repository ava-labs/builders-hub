'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Loader2 } from 'lucide-react';
import type { ValidatorAlertResponse, UpdateAlertRequest } from '@/types/validator-alerts';

interface AlertPreferencesProps {
  alert: ValidatorAlertResponse;
  onSave: (id: string, data: UpdateAlertRequest) => Promise<void>;
}

export function AlertPreferences({ alert, onSave }: AlertPreferencesProps) {
  const isL1 = alert.subnet_id !== 'primary';

  const [uptimeAlert, setUptimeAlert] = useState(alert.uptime_alert);
  const [uptimeThreshold, setUptimeThreshold] = useState(alert.uptime_threshold);
  const [versionAlert, setVersionAlert] = useState(alert.version_alert);
  const [expiryAlert, setExpiryAlert] = useState(alert.expiry_alert);
  const [expiryDays, setExpiryDays] = useState(alert.expiry_days);
  const [balanceAlert, setBalanceAlert] = useState(alert.balance_alert);
  const [balanceThresholdDays, setBalanceThresholdDays] = useState(alert.balance_threshold_days ?? 30);
  const [securityAlert, setSecurityAlert] = useState(alert.security_alert ?? false);
  const [email, setEmail] = useState(alert.email);
  const [saving, setSaving] = useState(false);

  const hasChanges =
    uptimeAlert !== alert.uptime_alert ||
    uptimeThreshold !== alert.uptime_threshold ||
    versionAlert !== alert.version_alert ||
    expiryAlert !== alert.expiry_alert ||
    expiryDays !== alert.expiry_days ||
    balanceAlert !== alert.balance_alert ||
    balanceThresholdDays !== (alert.balance_threshold_days ?? 30) ||
    securityAlert !== (alert.security_alert ?? false) ||
    email !== alert.email;

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(alert.id, {
        ...(isL1 ? {} : {
          uptime_alert: uptimeAlert,
          uptime_threshold: uptimeThreshold,
          expiry_alert: expiryAlert,
          expiry_days: expiryDays,
          security_alert: securityAlert,
        }),
        version_alert: versionAlert,
        ...(isL1 ? {
          balance_alert: balanceAlert,
          balance_threshold_days: Math.max(1, Math.min(365, Math.round(balanceThresholdDays))),
        } : {}),
        email,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Uptime Alert — Primary Network only */}
      {!isL1 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Uptime Alerts</Label>
              <p className="text-xs text-muted-foreground">
                Alert when uptime drops below threshold
              </p>
            </div>
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
      )}

      {/* Version Alert — both Primary and L1 */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">AvalancheGo Upgrade Alerts</Label>
          <p className="text-xs text-muted-foreground">
            Alert when a new AvalancheGo version is available (mandatory upgrades are escalated)
          </p>
        </div>
        <Switch checked={versionAlert} onCheckedChange={setVersionAlert} />
      </div>

      {/* Expiry Alert — Primary Network only */}
      {!isL1 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Stake Expiry Alerts</Label>
              <p className="text-xs text-muted-foreground">
                Alert when stake expiration is approaching
              </p>
            </div>
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
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (Number.isFinite(value)) setExpiryDays(value);
                }}
                className="mt-2 w-24 h-8 text-sm"
              />
              <p className="text-xs text-muted-foreground mt-2 italic">
                You&apos;ll also receive escalated alerts at 24 hours and 1 hour before expiry.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Balance Alert — L1 only */}
      {isL1 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Low Balance Alerts</Label>
              <p className="text-xs text-muted-foreground">
                Alert when projected fee runway falls below your threshold
              </p>
            </div>
            <Switch checked={balanceAlert} onCheckedChange={setBalanceAlert} />
          </div>
          {balanceAlert && (
            <div className="pl-1">
              <Label className="text-xs text-muted-foreground">
                Alert threshold (days of runway)
              </Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={balanceThresholdDays}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (Number.isFinite(value)) setBalanceThresholdDays(value);
                }}
                className="mt-2 w-28 h-8 text-sm"
              />
              <p className="text-xs text-muted-foreground mt-2 italic">
                Critical alerts trigger at 7 days or less of projected runway.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Security Alert — Primary Network only */}
      {!isL1 && (
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Security Checks</Label>
            <p className="text-xs text-muted-foreground">
              Detect public port 9650 exposure and notify on validator IP changes
            </p>
          </div>
          <Switch checked={securityAlert} onCheckedChange={setSecurityAlert} />
        </div>
      )}

      {/* Email */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Notification Email</Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="h-9 text-sm"
        />
      </div>

      {hasChanges && (
        <Button
          onClick={handleSave}
          disabled={saving}
          size="sm"
          className="w-full"
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Preferences
        </Button>
      )}
    </div>
  );
}
