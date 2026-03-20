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
  const [uptimeAlert, setUptimeAlert] = useState(alert.uptime_alert);
  const [uptimeThreshold, setUptimeThreshold] = useState(alert.uptime_threshold);
  const [versionAlert, setVersionAlert] = useState(alert.version_alert);
  const [expiryAlert, setExpiryAlert] = useState(alert.expiry_alert);
  const [expiryDays, setExpiryDays] = useState(alert.expiry_days);
  const [email, setEmail] = useState(alert.email);
  const [saving, setSaving] = useState(false);

  const hasChanges =
    uptimeAlert !== alert.uptime_alert ||
    uptimeThreshold !== alert.uptime_threshold ||
    versionAlert !== alert.version_alert ||
    expiryAlert !== alert.expiry_alert ||
    expiryDays !== alert.expiry_days ||
    email !== alert.email;

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(alert.id, {
        uptime_alert: uptimeAlert,
        uptime_threshold: uptimeThreshold,
        version_alert: versionAlert,
        expiry_alert: expiryAlert,
        expiry_days: expiryDays,
        email,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Uptime Alert */}
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

      {/* Version Alert */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">AvalancheGo Upgrade Alerts</Label>
          <p className="text-xs text-muted-foreground">
            Alert when a new AvalancheGo version is available (mandatory upgrades are escalated)
          </p>
        </div>
        <Switch checked={versionAlert} onCheckedChange={setVersionAlert} />
      </div>

      {/* Expiry Alert */}
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
              onChange={(e) => setExpiryDays(Number(e.target.value))}
              className="mt-2 w-24 h-8 text-sm"
            />
          </div>
        )}
      </div>

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
