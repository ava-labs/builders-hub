'use client';

import { useState } from 'react';
import { Check, X, RotateCcw, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

const TYPE_STYLES: Record<Flashcard['type'], string> = {
  qa: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  cloze: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  code: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
};

function renderCloze(front: string) {
  const parts = front.split(/(\[\[.+?\]\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const match = /^\[\[(.+?)\]\]$/.exec(part);
        if (match) {
          return (
            <span
              key={i}
              className="rounded bg-red-500/15 px-1.5 py-0.5 font-medium text-red-700 dark:text-red-300"
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
    <pre className="overflow-x-auto rounded-md bg-zinc-900 px-4 py-3 text-sm text-zinc-100 dark:bg-zinc-950">
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
          <Badge className={cn('shrink-0', TYPE_STYLES[card.type])} variant="secondary">
            {TYPE_LABELS[card.type]}
          </Badge>
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
            <p className="text-sm leading-relaxed">{renderCloze(card.front)}</p>
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

      <footer className="flex items-center justify-end gap-2 border-t px-4 py-3">
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
