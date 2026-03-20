'use client';

import { Badge } from '@/components/ui/badge';
import type { AlertLogResponse } from '@/types/validator-alerts';

const TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  uptime: { label: 'Uptime', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  version: { label: 'Version', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  expiry: { label: 'Expiry', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
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
        const config = TYPE_CONFIG[log.alert_type] ?? TYPE_CONFIG.uptime;
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
