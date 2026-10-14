'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronRight, Copy, ExternalLink, Globe } from 'lucide-react';
import { Board, BoardHeader, MUTED } from '@/components/explorer-v2/ui';
import { cn } from '@/lib/utils';
import { api, errorText } from './api';
import { Bone, Button, INPUT, LABEL, Notice, timeAgo } from './ui';

/** Skeleton bars for tinted boards, where the default bar fill is the board's own tint. Matches Runner's BoardBone. */
export const BONE = 'bg-zinc-200/80 dark:bg-zinc-800';

/** The longer explanation of a pane, closed until the builder asks for it. Drawn like Runner's HowItWorks. */
export function HowItWorks({ title = 'How this works', children }: { title?: string; children: React.ReactNode }) {
  return (
    <details className="group">
      <summary
        className={cn(
          LABEL,
          'flex w-fit cursor-pointer select-none list-none items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100 [&::-webkit-details-marker]:hidden',
        )}
      >
        <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
        {title}
      </summary>
      <div className="mt-2 flex max-w-prose flex-col gap-2 pl-4 text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        {children}
      </div>
    </details>
  );
}

/** A load that ends sooner than this shows no skeleton, so a quick one is a single fade with no flash of bars. */
const SKELETON_AFTER_MS = 150;
const FADE_MS = 200;
const EASE = [0.22, 1, 0.36, 1] as const;

type Phase = 'still' | 'wait' | 'bones' | 'cover' | 'fade';

/**
 * Stands a skeleton in for content until the content is ready. The skeleton shows only when the load lasts past
 * 150 ms. The content fades in where the skeleton was; a skeleton that showed fades out over it in the same spot, so
 * the pane never drops to blank between the two. Content that is ready at mount shows at once.
 */
export function Handoff({
  ready,
  skeleton,
  children,
  className,
  after = SKELETON_AFTER_MS,
}: {
  ready: boolean;
  skeleton: React.ReactNode;
  children?: React.ReactNode;
  /** Layout for both the content and the skeleton box. */
  className?: string;
  /** How long a load runs before its skeleton shows. Work the builder started, which takes seconds, uses less. */
  after?: number;
}) {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<Phase>(ready ? 'still' : 'wait');
  // Phases move during render, so the frame that brings the content never paints without its fade.
  if (ready && (phase === 'wait' || phase === 'bones')) setPhase(phase === 'bones' && !reduced ? 'cover' : 'fade');
  if (!ready && (phase === 'still' || phase === 'cover' || phase === 'fade')) setPhase('wait');

  useEffect(() => {
    if (phase !== 'wait' && phase !== 'cover') return;
    const t = setTimeout(() => setPhase(phase === 'wait' ? 'bones' : 'fade'), phase === 'wait' ? after : FADE_MS);
    return () => clearTimeout(t);
  }, [after, phase]);

  return (
    <div className="relative">
      {ready && (
        <motion.div
          key="content"
          className={className}
          initial={phase === 'still' || reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: FADE_MS / 1000, ease: EASE }}
        >
          {children}
        </motion.div>
      )}
      {(!ready || phase === 'cover') && (
        <div
          key="skeleton"
          aria-hidden={ready || undefined}
          className={cn(
            className,
            'transition-opacity duration-200 motion-reduce:transition-none',
            ready && 'pointer-events-none absolute inset-0 overflow-hidden',
            phase === 'bones' ? 'opacity-100' : 'opacity-0',
          )}
        >
          {skeleton}
        </div>
      )}
    </div>
  );
}

/** A quiet state word with its dot: emerald when live, zinc while a draft. */
function SiteState({ live }: { live: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em]',
        live ? 'text-emerald-700 dark:text-emerald-300' : 'text-zinc-500 dark:text-zinc-400',
      )}
    >
      <span
        aria-hidden
        className={cn('h-1.5 w-1.5 rounded-full', live ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600')}
      />
      {live ? 'Live' : 'Not published'}
    </span>
  );
}

/** The board's one row, as bars: the address and its button. */
function PublishSkeleton() {
  return (
    <div role="status" aria-label="Loading the site" className="flex items-center gap-3">
      <Bone className={cn(BONE, 'h-8 min-w-0 flex-1')} />
      <Bone className={cn(BONE, 'h-8 w-24 shrink-0')} delay={0.06} />
    </div>
  );
}

type Status =
  | { published: true; path: string; slug: string; publishedAt: string }
  | { published: false; suggestedSlug: string; owner: string; ownerEditable: boolean };

/** Publishes the project's frontend at /builder/{owner}/{site}, as a snapshot the builder refreshes by republishing. */
export function PublishSite({
  projectId,
  projectName,
  frontendKey,
}: {
  projectId: string;
  projectName: string;
  /** Changes whenever a frontend/ file changes, so the panel can say the live site is behind. */
  frontendKey: string;
}) {
  const base = `/api/studio/projects/${projectId}/site`;
  const [status, setStatus] = useState<Status | null>(null);
  const [slug, setSlug] = useState('');
  const [owner, setOwner] = useState('');
  const [busy, setBusy] = useState<'publish' | 'unpublish' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [publishedKey, setPublishedKey] = useState<string | null>(null);
  // A phone shows the address as one line until the builder asks to change it.
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    api<Status>(base)
      .then((s) => {
        setStatus(s);
        setSlug(s.published ? s.slug : s.suggestedSlug);
        if (!s.published) setOwner(s.owner);
      })
      .catch((e) => setError(errorText(e)));
  }, [base]);

  const publish = async () => {
    setBusy('publish');
    setError(null);
    try {
      const s = await api<Status>(base, {
        method: 'POST',
        json: { slug, ...(status && !status.published && status.ownerEditable ? { owner } : {}) },
      });
      setStatus(s);
      setPublishedKey(frontendKey);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const unpublish = async () => {
    if (!window.confirm(`Take ${projectName} offline? The address stops working until you publish again.`)) return;
    setBusy('unpublish');
    setError(null);
    try {
      await api(base, { method: 'DELETE' });
      setStatus(await api<Status>(base));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const url = status?.published ? `${window.location.origin}${status.path}` : null;
  const behind = status?.published && publishedKey !== null && publishedKey !== frontendKey;
  const draft = status && !status.published ? status : null;
  const addressText = 'shrink-0 font-mono text-[12px] text-zinc-500 dark:text-zinc-400';

  return (
    <Board className="border-x border-t border-zinc-200 dark:border-zinc-800">
      <BoardHeader label="Publish" action={status ? <SiteState live={status.published} /> : undefined} />
      <div className="flex flex-col gap-3 px-5 py-4 md:px-6">
        {error && !status ? (
          <Notice tone="bad">{error}</Notice>
        ) : (
          <Handoff ready={status !== null} skeleton={<PublishSkeleton />}>
            {status?.published && url ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <Globe className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 truncate font-mono text-[12.5px] text-[#0061E2] hover:underline dark:text-[#5f9dff]"
                    >
                      {url.replace(/^https?:\/\//, '')}
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(url);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }}
                      aria-label="Copy link"
                      className="shrink-0 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Open the site"
                      className="shrink-0 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      className="px-2"
                      busy={busy === 'unpublish'}
                      disabled={busy !== null}
                      onClick={() => void unpublish()}
                    >
                      Unpublish
                    </Button>
                    <Button
                      variant={behind ? 'primary' : 'secondary'}
                      busy={busy === 'publish'}
                      disabled={busy !== null}
                      onClick={() => void publish()}
                    >
                      Update site
                    </Button>
                  </span>
                </div>
                <span className={cn(MUTED, 'flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]')}>
                  Published {timeAgo(status.publishedAt)}
                  {behind && (
                    <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      The frontend changed since then
                    </span>
                  )}
                </span>
              </div>
            ) : draft ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  {!editing && (
                    <span className="flex min-w-0 items-center justify-between gap-2 sm:hidden">
                      <span
                        title={`${window.location.host}/builder/${owner || 'your-name'}/${slug}`}
                        className="min-w-0 truncate font-mono text-[12px] text-zinc-500 dark:text-zinc-400"
                      >
                        /builder/
                        <span className="text-zinc-900 dark:text-zinc-100">{owner || 'your-name'}</span>/
                        <span className="text-zinc-900 dark:text-zinc-100">{slug}</span>
                      </span>
                      <Button variant="ghost" className="h-7 px-2" onClick={() => setEditing(true)}>
                        Edit
                      </Button>
                    </span>
                  )}
                  <span
                    className={cn(
                      'min-w-0 flex-1 flex-wrap items-center gap-1.5 sm:flex sm:flex-nowrap',
                      editing ? 'flex' : 'hidden',
                    )}
                  >
                    <span className={addressText}>{window.location.host}/builder/</span>
                    {draft.ownerEditable ? (
                      <input
                        value={owner}
                        onChange={(e) => setOwner(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        maxLength={40}
                        aria-label="Your builder name"
                        placeholder="your-name"
                        className={cn(INPUT, 'w-32 shrink-0')}
                      />
                    ) : (
                      <span className="font-mono text-[12px] text-zinc-900 dark:text-zinc-100">{draft.owner}</span>
                    )}
                    <span className={addressText}>/</span>
                    <input
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      maxLength={40}
                      aria-label="Site address"
                      className={cn(INPUT, 'w-auto min-w-[10rem] flex-1')}
                    />
                  </span>
                  <Button
                    className="self-start sm:self-auto"
                    busy={busy === 'publish'}
                    disabled={!slug || (draft.ownerEditable && !owner) || busy !== null}
                    onClick={() => void publish()}
                  >
                    Publish
                  </Button>
                </div>
                {draft.ownerEditable && (
                  <p className="text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                    Your builder name is permanent.
                  </p>
                )}
              </div>
            ) : null}
          </Handoff>
        )}
        {error && status && <Notice tone="bad">{error}</Notice>}
      </div>
    </Board>
  );
}
