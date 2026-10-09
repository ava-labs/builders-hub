'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useLoginModalTrigger } from '@/hooks/useLoginModal';
import { cn } from '@/lib/utils';
import { api, errorText } from './api';
import { ComposerBeam, type ComposerBeamColor } from './Beam';
import { Button, LABEL, Notice } from './ui';

const TYPE_MS = 42;
const DELETE_MS = 18;
const HOLD_MS = 1800;
const GAP_MS = 400;

/**
 * Types each phrase, holds it, deletes it, then types the next, for an
 * animated placeholder. Off when `enabled` is false or the builder prefers
 * reduced motion; it then returns the first phrase as is.
 */
function useTypewriter(phrases: string[], enabled: boolean) {
  const [shown, setShown] = useState('');
  const key = phrases.join('\n');

  useEffect(() => {
    const list = key ? key.split('\n') : [];
    const still = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!enabled || still || list.length === 0) {
      setShown(list[0] ?? '');
      return;
    }
    let phrase = 0;
    let length = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const target = list[phrase];
      if (!deleting) {
        length += 1;
        setShown(target.slice(0, length));
        if (length >= target.length) {
          deleting = true;
          timer = setTimeout(tick, HOLD_MS);
          return;
        }
        timer = setTimeout(tick, TYPE_MS);
        return;
      }
      length -= 1;
      setShown(target.slice(0, length));
      if (length <= 0) {
        deleting = false;
        phrase = (phrase + 1) % list.length;
        timer = setTimeout(tick, GAP_MS);
        return;
      }
      timer = setTimeout(tick, DELETE_MS);
    };
    setShown('');
    timer = setTimeout(tick, GAP_MS);
    return () => clearTimeout(timer);
  }, [enabled, key]);

  return shown;
}

const TYPED_PROMPTS = [
  'A USDC checkout on Fuji with refunds',
  'Bring USDC from Base straight to my L1',
  'KYC once on the C-Chain, verified accounts only on my L1',
  'A token where balances are private',
  'Chainlink prices on my L1 over ICM',
];

/** One box to describe an app; creates a project and opens it with the prompt queued for the agent. */
export function PromptComposer({
  examples = [],
  className,
  compact = false,
  beam,
}: {
  examples?: string[];
  className?: string;
  /** One line with the button inline, for a docked box. */
  compact?: boolean;
  beam?: ComposerBeamColor;
}) {
  const router = useRouter();
  const { status } = useSession();
  const { openLoginModal } = useLoginModalTrigger();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  // The docked box types example prompts while it's empty and idle.
  const typed = useTypewriter(TYPED_PROMPTS, compact && !text && !focused);

  const start = async () => {
    const prompt = text.trim();
    if (!prompt) return;
    if (status !== 'authenticated') {
      openLoginModal();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const name = prompt.replace(/\s+/g, ' ').slice(0, 60);
      const { project, chatId } = await api<{ project: { id: string }; chatId: string }>('/api/studio/projects', {
        method: 'POST',
        json: { name },
      });
      const query = new URLSearchParams({ prompt, ...(chatId ? { chat: chatId } : {}) });
      router.push(`/console/studio/${project.id}?${query}`);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <ComposerBeam colorVariant={beam}>
        {compact ? (
          <div className="flex items-center gap-2 bg-white py-1.5 pl-4 pr-1.5 dark:bg-zinc-950">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void start();
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={focused ? 'Describe an app for Studio to build' : `Ask Studio: ${typed}`}
              aria-label="Describe an app for Studio to build"
              className="h-9 min-w-0 flex-1 bg-transparent text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-50 dark:placeholder:text-zinc-500"
            />
            <Button onClick={() => void start()} busy={busy} disabled={!text.trim()}>
              Build <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-950">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void start();
              }}
              rows={3}
              placeholder="Describe what to build, e.g. a USDC checkout on Fuji with refunds, or bring USDC from Base to my L1"
              className="block w-full resize-none bg-transparent px-4 py-3.5 text-[15px] leading-relaxed text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-50 dark:placeholder:text-zinc-500"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                Testnet first · audited before every deploy · your wallet signs
              </span>
              <Button onClick={() => void start()} busy={busy} disabled={!text.trim()}>
                Build with Studio <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </ComposerBeam>
      {error && <Notice tone="bad">{error}</Notice>}
      {examples.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className={LABEL}>Try</span>
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setText(example)}
              className="border border-zinc-200 px-2.5 py-1 text-left text-[12px] text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
            >
              {example}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
