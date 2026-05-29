'use client';

import { useState } from 'react';
import { Check, X, RotateCcw, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Flashcard } from '@/lib/flashcards/types';

interface StudioCardProps {
  card: Flashcard;
  isRejected: boolean;
  isRegenerating: boolean;
  onAccept: () => void;
  onReject: () => void;
  onRegenerate: () => void;
}

const TYPE_LABELS: Record<Flashcard['type'], string> = {
  qa: 'Q & A',
  cloze: 'Cloze',
  code: 'Code',
};

const TYPE_TOOLTIPS: Record<Flashcard['type'], string> = {
  qa: 'Question on the front, concise answer on the back. Best for definitions and conceptual contrasts.',
  cloze: 'Fill-in-the-blank. A sentence with one term hidden until you reveal the answer.',
  code: 'Code prompt or fill-in. The back contains the correct snippet in a specific language.',
};

const TYPE_STYLES: Record<Flashcard['type'], string> = {
  qa: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  cloze: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  code: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
};

function renderCloze(front: string, revealed: boolean) {
  const parts = front.split(/(\[\[.+?\]\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const match = /^\[\[(.+?)\]\]$/.exec(part);
        if (match) {
          if (!revealed) {
            return (
              <span
                key={i}
                className="mx-0.5 inline-flex items-baseline rounded border border-dashed border-muted-foreground/40 bg-muted px-2 py-0.5 align-baseline font-mono text-xs uppercase tracking-wider text-muted-foreground"
                aria-label="hidden answer"
              >
                ____
              </span>
            );
          }
          return (
            <span
              key={i}
              className="rounded bg-red-500/15 px-1.5 py-0.5 font-medium text-red-700 dark:text-red-300"
              aria-label="answer"
            >
              {match[1]}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  return (
    <pre className="overflow-x-auto rounded-md bg-zinc-900 px-4 py-3 text-xs text-zinc-100 dark:bg-zinc-950 sm:text-sm">
      <code className={language ? `language-${language}` : undefined}>{code}</code>
    </pre>
  );
}

function CardBody({ text, isCode, language }: { text: string; isCode?: boolean; language?: string }) {
  if (isCode) return <CodeBlock code={text} language={language} />;

  const codeFence = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/.exec(text);
  if (codeFence) {
    return <CodeBlock code={codeFence[2].trimEnd()} language={codeFence[1] || language} />;
  }

  return <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>;
}

export function StudioCard({
  card,
  isRejected,
  isRegenerating,
  onAccept,
  onReject,
  onRegenerate,
}: StudioCardProps) {
  const [showBack, setShowBack] = useState(true);

  return (
    <article
      className={cn(
        'rounded-xl border bg-card transition-opacity',
        isRejected && 'opacity-50',
      )}
    >
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                className={cn('shrink-0 cursor-help', TYPE_STYLES[card.type])}
                variant="secondary"
                tabIndex={0}
                aria-label={`${TYPE_LABELS[card.type]} card — ${TYPE_TOOLTIPS[card.type]}`}
              >
                {TYPE_LABELS[card.type]}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              {TYPE_TOOLTIPS[card.type]}
            </TooltipContent>
          </Tooltip>
          <span className="truncate text-xs text-muted-foreground" title={card.source.path}>
            {card.source.chapterTitle}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowBack((v) => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          aria-expanded={showBack}
        >
          {showBack ? (
            <>
              Hide answer <ChevronUp className="h-3 w-3" />
            </>
          ) : (
            <>
              Show answer <ChevronDown className="h-3 w-3" />
            </>
          )}
        </button>
      </header>

      <div className="px-4 py-4">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Front
        </div>
        <div className="mt-2">
          {card.type === 'cloze' ? (
            <p className="text-sm leading-relaxed">
              {renderCloze(card.front, showBack)}
            </p>
          ) : (
            <CardBody text={card.front} isCode={card.type === 'code'} language={card.language} />
          )}
        </div>
      </div>

      {showBack && (
        <div className="border-t bg-muted/30 px-4 py-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Back
          </div>
          <div className="mt-2">
            <CardBody text={card.back} isCode={card.type === 'code'} language={card.language} />
          </div>
        </div>
      )}

      <footer className="flex flex-wrap items-center justify-end gap-2 border-t px-4 py-3">
        {isRejected ? (
          <Button size="sm" variant="outline" onClick={onAccept}>
            <Check className="mr-1.5 h-3.5 w-3.5" />
            Restore
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={onReject} aria-label="Reject card">
            <X className="mr-1.5 h-3.5 w-3.5" />
            Reject
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={onRegenerate}
          disabled={isRegenerating || isRejected}
          aria-label="Regenerate card"
        >
          {isRegenerating ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Regenerating
            </>
          ) : (
            <>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Regenerate
            </>
          )}
        </Button>
      </footer>
    </article>
  );
}
