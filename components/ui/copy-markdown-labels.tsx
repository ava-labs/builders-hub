import { Check, Copy } from 'lucide-react';
import { cn } from '@/utils/cn';

export type CopyMarkdownState = 'idle' | 'busy' | 'done';

/* docs-copy-markdown: the three labels share one grid cell, so a Copy Markdown button keeps the width of the longest,
   Copy Markdown, in every state, and the label it shows cross-fades in place: 160ms on the strong ease-out, the hidden
   ones at opacity 0 with a 2px blur. The hidden labels are aria-hidden, so the button's name is the shown label, and
   inert, so find in page never lands on a label nobody sees. Under Reduce Motion the labels cross-fade in 120ms
   without blur; !important wins over the site policy's 150ms. */
const LABEL =
  'col-start-1 row-start-1 inline-flex items-center gap-2 whitespace-nowrap transition-[opacity,filter] duration-160 ease-out motion-reduce:duration-120!';
const LABEL_HIDDEN = 'opacity-0 motion-safe:blur-[2px]';

export interface CopyMarkdownLabelsProps {
  state: CopyMarkdownState;
  /** The label after a copy. */
  done: string;
  /** Where a shorter label sits in the cell. */
  align?: 'center' | 'start';
  /** Pulse the copy icon while the Markdown loads. */
  pulse?: boolean;
}

export function CopyMarkdownLabels({ state, done, align = 'center', pulse = false }: CopyMarkdownLabelsProps) {
  const labels = [
    { key: 'idle', icon: <Copy className="size-4" />, text: 'Copy Markdown' },
    {
      key: 'busy',
      icon: <Copy className={cn('size-4', pulse && state === 'busy' && 'animate-pulse')} />,
      text: 'Copying...',
    },
    { key: 'done', icon: <Check className="size-4" />, text: done },
  ] as const;

  return (
    <span className={cn('grid', align === 'center' ? 'justify-items-center' : 'justify-items-start')}>
      {labels.map(({ key, icon, text }) => (
        <span
          key={key}
          aria-hidden={key !== state || undefined}
          inert={key !== state || undefined}
          className={cn(LABEL, key !== state && LABEL_HIDDEN)}
        >
          {icon}
          {text}
        </span>
      ))}
    </span>
  );
}
