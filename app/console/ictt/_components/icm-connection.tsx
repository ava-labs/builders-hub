'use client';

import { cn } from '@/components/toolbox/lib/utils';

interface ICMConnectionProps {
  accent: string;
  active: boolean;
  count: number;
  orientation?: 'vertical' | 'horizontal';
}

/**
 * Center column rail showing ICM as the live link between two chains.
 * Animates the dashed gradient path when an ICM message is in flight
 * (active phase = register or transfer). Center pill shows the message
 * count for the current bridge.
 *
 * Two orientations:
 *   - vertical (default): wide-screen layout, rail runs top-to-bottom in
 *     the center column between the two chain panels.
 *   - horizontal: tablet-or-narrow layout, rail runs left-to-right
 *     between stacked chain panels.
 */
export function ICMConnection({ accent, active, count, orientation = 'vertical' }: ICMConnectionProps) {
  const isVertical = orientation === 'vertical';

  if (isVertical) {
    return (
      <div className="flex flex-col items-center justify-center w-32 relative py-4">
        <svg viewBox="0 0 128 600" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
          <defs>
            <linearGradient id="icm-grad-v" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={accent} stopOpacity="0.6" />
              <stop offset="0.5" stopColor={accent} stopOpacity="1" />
              <stop offset="1" stopColor={accent} stopOpacity="0.6" />
            </linearGradient>
          </defs>
          <path
            d="M 64 0 L 64 600"
            stroke="url(#icm-grad-v)"
            strokeWidth="1.5"
            fill="none"
            strokeDasharray="4 6"
            opacity={active ? 1 : 0.3}
          >
            {active && (
              <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1.2s" repeatCount="indefinite" />
            )}
          </path>
        </svg>
        <ICMPill accent={accent} active={active} count={count} />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center w-full h-20 relative">
      <svg viewBox="0 0 600 80" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
        <defs>
          <linearGradient id="icm-grad-h" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor={accent} stopOpacity="0.6" />
            <stop offset="0.5" stopColor={accent} stopOpacity="1" />
            <stop offset="1" stopColor={accent} stopOpacity="0.6" />
          </linearGradient>
        </defs>
        <path
          d="M 0 40 L 600 40"
          stroke="url(#icm-grad-h)"
          strokeWidth="1.5"
          fill="none"
          strokeDasharray="4 6"
          opacity={active ? 1 : 0.3}
        >
          {active && (
            <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1.2s" repeatCount="indefinite" />
          )}
        </path>
      </svg>
      <ICMPill accent={accent} active={active} count={count} />
    </div>
  );
}

function ICMPill({ accent, active, count }: { accent: string; active: boolean; count: number }) {
  return (
    <div className="relative z-10 flex flex-col items-center gap-1">
      <div
        className={cn(
          'px-3 py-2 rounded-xl border bg-card transition-shadow',
          active ? 'border-border shadow-sm' : 'border-border/60',
        )}
      >
        <div className="text-[9px] uppercase tracking-widest font-bold" style={{ color: accent }}>
          ICM
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5 text-center">{count} msgs</div>
      </div>
      <div className="text-[10px] text-muted-foreground text-center px-1 leading-tight">
        Interchain
        <br />
        Messaging
      </div>
    </div>
  );
}
