'use client';

import { Badge } from '@/components/ui/badge';
import type { AlertLogResponse } from '@/types/validator-alerts';

const TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  uptime: { label: 'Uptime', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  version_mandatory: { label: 'Upgrade Required', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  version_mandatory_urgent: { label: 'Upgrade Urgent', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  version_mandatory_critical: { label: 'Upgrade Critical', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  version_optional: { label: 'Update Available', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  expiry: { label: 'Expiry', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  expiry_urgent: { label: 'Expiry Urgent', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  expiry_critical: { label: 'Expiry Critical', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  check_failed: { label: 'Check Failed', className: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-400' },
  balance_low: { label: 'Low Balance', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  balance_low_urgent: { label: 'Balance Urgent', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  balance_critical: { label: 'Balance Critical', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  balance_low_critical: { label: 'Balance Critical', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  security_port_exposed: { label: 'Security: Port Exposed', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  security_ip_changed: { label: 'Security: IP Changed', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  welcome: { label: 'Welcome', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface AlertHistoryProps {
  logs: AlertLogResponse[];
}

export function AlertHistory({ logs }: AlertHistoryProps) {
  if (logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        No alerts have been sent yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => {
        const config = TYPE_CONFIG[log.alert_type] ?? { label: log.alert_type, className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' };
        return (
          <div
            key={log.id}
            className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
          >
            <Badge variant="secondary" className={config.className}>
              {config.label}
            </Badge>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">{log.message}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatDate(log.sent_at)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
