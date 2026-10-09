'use client';

import { cn } from '@/lib/utils';
import type { AlertLogResponse } from '@/types/validator-alerts';
import { StatusDot, TEXT_TONE, type Tone } from './ui';

const TYPE_CONFIG: Record<string, { label: string; tone: Tone }> = {
  uptime: { label: 'Uptime', tone: 'alerting' },
  version_mandatory: { label: 'Upgrade Required', tone: 'warning' },
  version_mandatory_urgent: { label: 'Upgrade Urgent', tone: 'alerting' },
  version_mandatory_critical: { label: 'Upgrade Critical', tone: 'alerting' },
  version_optional: { label: 'Update Available', tone: 'idle' },
  expiry: { label: 'Expiry', tone: 'warning' },
  expiry_urgent: { label: 'Expiry Urgent', tone: 'alerting' },
  expiry_critical: { label: 'Expiry Critical', tone: 'alerting' },
  check_failed: { label: 'Check Failed', tone: 'idle' },
  balance_low: { label: 'Low Balance', tone: 'warning' },
  balance_low_urgent: { label: 'Balance Urgent', tone: 'alerting' },
  balance_critical: { label: 'Balance Critical', tone: 'alerting' },
  balance_low_critical: { label: 'Balance Critical', tone: 'alerting' },
  security_port_exposed: { label: 'Security: Port Exposed', tone: 'alerting' },
  security_ip_changed: { label: 'Security: IP Changed', tone: 'warning' },
  welcome: { label: 'Welcome', tone: 'healthy' },
};

export function formatAlertDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const COLS = 'md:grid-cols-[0.75rem_minmax(0,11rem)_minmax(0,1fr)_minmax(0,11rem)]';

interface AlertHistoryProps {
  logs: AlertLogResponse[];
}

export function AlertHistory({ logs }: AlertHistoryProps) {
  if (logs.length === 0) {
    return (
      <p className="border border-zinc-200 px-4 py-4 font-mono text-[11px] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        No alerts have been sent yet.
      </p>
    );
  }

  return (
    <div className="divide-y divide-zinc-200 border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {logs.map((log) => {
        const config = TYPE_CONFIG[log.alert_type] ?? { label: log.alert_type, tone: 'idle' as Tone };
        return (
          <div
            key={log.id}
            className={cn(
              'grid grid-cols-[0.75rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1 px-4 py-3 md:gap-x-4',
              COLS,
            )}
          >
            <span className="flex h-4 items-center">
              <StatusDot tone={config.tone} label={config.label} />
            </span>
            <span
              className={cn(
                'font-mono text-[10px] font-bold uppercase leading-4 tracking-[0.14em]',
                TEXT_TONE[config.tone],
              )}
            >
              {config.label}
            </span>
            <p className="col-start-2 text-[13px] leading-relaxed text-zinc-700 md:col-start-auto dark:text-zinc-300">
              {log.message}
            </p>
            <span className="col-start-2 font-mono text-[11.5px] leading-4 tabular-nums text-zinc-400 md:col-start-auto md:text-right dark:text-zinc-500">
              {formatAlertDate(log.sent_at)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
