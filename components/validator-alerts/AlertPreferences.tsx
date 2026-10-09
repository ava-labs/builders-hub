'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ValidatorAlertResponse, UpdateAlertRequest } from '@/types/validator-alerts';
import { FIELD, FIELD_LABEL, HoverArrow, PRIMARY_BTN, SquareSlider, SquareSwitch } from './ui';

interface AlertPreferencesProps {
  alert: ValidatorAlertResponse;
  onSave: (id: string, data: UpdateAlertRequest) => Promise<void>;
}

/** One alert type: its name and what it does, the switch on the right, its threshold below while on. */
function PreferenceRow({
  id,
  title,
  description,
  checked,
  onCheckedChange,
  children,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 py-4">
      <div className="flex items-start justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-1">
          <span id={`${id}-title`} className="text-[13.5px] font-medium text-zinc-900 dark:text-zinc-50">
            {title}
          </span>
          <span id={`${id}-desc`} className="text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            {description}
          </span>
        </div>
        <SquareSwitch
          checked={checked}
          onCheckedChange={onCheckedChange}
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-desc`}
        />
      </div>
      {checked && children && <div className="max-w-md">{children}</div>}
    </div>
  );
}

export function AlertPreferences({ alert, onSave }: AlertPreferencesProps) {
  const isL1 = alert.subnet_id !== 'primary';
  const fieldId = (name: string) => `${alert.id}-${name}`;

  const [uptimeAlert, setUptimeAlert] = useState(alert.uptime_alert);
  const [uptimeThreshold, setUptimeThreshold] = useState(alert.uptime_threshold);
  const [versionAlert, setVersionAlert] = useState(alert.version_alert);
  const [expiryAlert, setExpiryAlert] = useState(alert.expiry_alert);
  const [expiryDays, setExpiryDays] = useState(alert.expiry_days);
  const [balanceAlert, setBalanceAlert] = useState(alert.balance_alert);
  const [balanceThresholdDays, setBalanceThresholdDays] = useState(alert.balance_threshold_days ?? 30);
  const [securityAlert, setSecurityAlert] = useState(alert.security_alert ?? false);
  const [saving, setSaving] = useState(false);

  const hasChanges =
    uptimeAlert !== alert.uptime_alert ||
    uptimeThreshold !== alert.uptime_threshold ||
    versionAlert !== alert.version_alert ||
    expiryAlert !== alert.expiry_alert ||
    expiryDays !== alert.expiry_days ||
    balanceAlert !== alert.balance_alert ||
    balanceThresholdDays !== (alert.balance_threshold_days ?? 30) ||
    securityAlert !== (alert.security_alert ?? false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(alert.id, {
        ...(isL1
          ? {}
          : {
              uptime_alert: uptimeAlert,
              uptime_threshold: uptimeThreshold,
              expiry_alert: expiryAlert,
              expiry_days: expiryDays,
              security_alert: securityAlert,
            }),
        version_alert: versionAlert,
        ...(isL1
          ? {
              balance_alert: balanceAlert,
              balance_threshold_days: Math.max(1, Math.min(365, Math.round(balanceThresholdDays))),
            }
          : {}),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col">
      <div className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {/* Uptime Alert — Primary Network only */}
        {!isL1 && (
          <PreferenceRow
            id={fieldId('uptime')}
            title="Uptime alerts"
            description="Alert when uptime drops below threshold."
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
          </PreferenceRow>
        )}

        {/* Version Alert — both Primary and L1 */}
        <PreferenceRow
          id={fieldId('version')}
          title="AvalancheGo upgrade alerts"
          description="Alert when a new AvalancheGo version is available (mandatory upgrades are escalated)."
          checked={versionAlert}
          onCheckedChange={setVersionAlert}
        />

        {/* Expiry Alert — Primary Network only */}
        {!isL1 && (
          <PreferenceRow
            id={fieldId('expiry')}
            title="Stake expiry alerts"
            description="Alert when stake expiration is approaching."
            checked={expiryAlert}
            onCheckedChange={setExpiryAlert}
          >
            <div className="flex flex-col gap-2">
              <label className="flex items-center justify-between gap-3" htmlFor={fieldId('expiry-days')}>
                <span className={FIELD_LABEL}>Days before expiry</span>
                <input
                  id={fieldId('expiry-days')}
                  type="number"
                  min={1}
                  max={365}
                  value={expiryDays}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (Number.isFinite(value)) setExpiryDays(value);
                  }}
                  className={cn(FIELD, 'h-8 w-24 font-mono tabular-nums')}
                />
              </label>
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                You&apos;ll also receive escalated alerts at <span className="font-mono tabular-nums">24h</span> and{' '}
                <span className="font-mono tabular-nums">1h</span> before expiry.
              </p>
            </div>
          </PreferenceRow>
        )}

        {/* Balance Alert — L1 only */}
        {isL1 && (
          <PreferenceRow
            id={fieldId('balance')}
            title="Low balance alerts"
            description="Alert when projected fee runway falls below your threshold."
            checked={balanceAlert}
            onCheckedChange={setBalanceAlert}
          >
            <div className="flex flex-col gap-2">
              <label className="flex items-center justify-between gap-3" htmlFor={fieldId('balance-days')}>
                <span className={FIELD_LABEL}>Days of runway</span>
                <input
                  id={fieldId('balance-days')}
                  type="number"
                  min={1}
                  max={365}
                  value={balanceThresholdDays}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (Number.isFinite(value)) setBalanceThresholdDays(value);
                  }}
                  className={cn(FIELD, 'h-8 w-28 font-mono tabular-nums')}
                />
              </label>
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                Critical alerts trigger at <span className="font-mono tabular-nums">7</span> days or less of projected
                runway.
              </p>
            </div>
          </PreferenceRow>
        )}

        {/* Security Alert — Primary Network only */}
        {!isL1 && (
          <PreferenceRow
            id={fieldId('security')}
            title="Security checks"
            description="Detect public port 9650 exposure and notify on validator IP changes."
            checked={securityAlert}
            onCheckedChange={setSecurityAlert}
          />
        )}

        {/* Email — bound to the account email, not editable */}
        <label className="flex flex-col gap-2 py-4" htmlFor={fieldId('email')}>
          <span className={FIELD_LABEL}>Notification email</span>
          <input
            id={fieldId('email')}
            type="email"
            value={alert.email}
            readOnly
            disabled
            className={cn(FIELD, 'max-w-md font-mono text-[12.5px]')}
          />
          <span className="text-[12px] text-zinc-500 dark:text-zinc-400">Alerts are sent to your account email.</span>
        </label>
      </div>

      {hasChanges && (
        <div className="flex justify-end pt-4">
          <button type="button" onClick={handleSave} disabled={saving} className={PRIMARY_BTN}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            Save preferences
            <HoverArrow />
          </button>
        </div>
      )}
    </div>
  );
}
