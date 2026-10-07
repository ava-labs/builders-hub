'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Globe } from 'lucide-react';
import { Board, BoardHeader, MUTED } from '@/components/explorer-v2/ui';
import { cn } from '@/lib/utils';
import { api, errorText } from './api';
import { Button, INPUT, Notice, Pill, timeAgo } from './ui';

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

  return (
    <Board>
      <BoardHeader
        label="Publish"
        action={status?.published ? <Pill tone="good">live</Pill> : status ? <Pill>not published</Pill> : undefined}
      />
      <div className="flex flex-col gap-3 px-5 py-4 md:px-6">
        {status?.published && url ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
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
                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open the site"
                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <span className={cn(MUTED, 'text-[11px]')}>
              Published {timeAgo(status.publishedAt)}. Visitors get this snapshot of the frontend and the deployed
              contracts; publish again to send them your latest changes.
            </span>
            {behind && (
              <Notice tone="warn">The frontend changed since you published. Update the site to share it.</Notice>
            )}
            <div className="flex flex-wrap gap-2">
              <Button busy={busy === 'publish'} disabled={busy !== null} onClick={() => void publish()}>
                Update site
              </Button>
              <Button
                variant="ghost"
                busy={busy === 'unpublish'}
                disabled={busy !== null}
                onClick={() => void unpublish()}
              >
                Unpublish
              </Button>
            </div>
          </>
        ) : draft ? (
          <>
            <span className="text-[13px] text-zinc-700 dark:text-zinc-300">
              Share this app with anyone at a Builder Hub address. It runs sandboxed, and visitors use their own wallet.
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[12px] text-zinc-500 dark:text-zinc-400">
                {window.location.host}/builder/
              </span>
              {draft.ownerEditable ? (
                <input
                  value={owner}
                  onChange={(e) => setOwner(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  maxLength={40}
                  aria-label="Your builder name"
                  placeholder="your-name"
                  className={cn(INPUT, 'w-36')}
                />
              ) : (
                <span className="font-mono text-[12px] text-zinc-900 dark:text-zinc-100">{draft.owner}</span>
              )}
              <span className="font-mono text-[12px] text-zinc-500 dark:text-zinc-400">/</span>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                maxLength={40}
                aria-label="Site address"
                className={cn(INPUT, 'w-44')}
              />
              <Button
                busy={busy === 'publish'}
                disabled={!slug || (draft.ownerEditable && !owner) || busy !== null}
                onClick={() => void publish()}
              >
                Publish
              </Button>
            </div>
            <span className={cn(MUTED, 'text-[11px]')}>
              {draft.ownerEditable
                ? "You don't have a Builder Hub username yet, so pick the name your sites live under. It stays the same for all your sites once you publish."
                : 'Your sites live under your Builder Hub name.'}{' '}
              Testnet contracts only, as deployed from this project.
            </span>
          </>
        ) : null}
        {error && <Notice tone="bad">{error}</Notice>}
      </div>
    </Board>
  );
}
