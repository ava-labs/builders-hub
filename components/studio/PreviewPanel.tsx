'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minimize2, RotateCw } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Board, EmptyRow, HashChip, MUTED, SectionHeader } from '@/components/explorer-v2/ui';
import { AvalancheLogo } from '@/components/navigation/avalanche-logo';
import { useActiveWalletProvider } from '@/components/toolbox/hooks/useLiveWalletChainId';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { cn } from '@/lib/utils';
import { api, errorText, type ProjectOverview } from './api';
import type { PreviewContext } from './preview';
import { REACT_ENTRY, buildAppDocument } from './preview-react';
import { PublishSite } from './PublishSite';
import { Button, LABEL, Notice, Pill } from './ui';
import { useFullScreen } from './useFullScreen';
import { usePreviewBridge, type Eip1193 } from './usePreviewBridge';

/** Runs frontend/ in a sandboxed frame against the project's deployed contracts, signing with the builder's wallet. */
export function PreviewPanel({ overview }: { overview: ProjectOverview }) {
  const projectId = overview.project.id;
  const address = useWalletStore((s) => s.walletEVMAddress);
  const provider = useActiveWalletProvider({ enabled: Boolean(address), refreshKey: address }) as Eip1193 | null;
  const { resolvedTheme } = useTheme();
  const theme: 'light' | 'dark' = resolvedTheme === 'dark' ? 'dark' : 'light';
  const [context, setContext] = useState<PreviewContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [frameErrors, setFrameErrors] = useState<string[]>([]);
  const [reloads, setReloads] = useState(0);
  const [full, setFull] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const channel = useMemo(() => crypto.randomUUID(), []);
  const themeRef = useRef(theme);
  themeRef.current = theme;

  // Refetched when the frontend files change, so an edit from the chat shows on the next render.
  const frontendKey = overview.files
    .filter((f) => f.path.startsWith('frontend/'))
    .map((f) => `${f.path}:${f.sha256}`)
    .join('|');

  useEffect(() => {
    let cancelled = false;
    api<PreviewContext>(`/api/studio/projects/${projectId}/frontend`)
      .then((c) => !cancelled && setContext(c))
      .catch((e) => !cancelled && setError(errorText(e)));
    return () => {
      cancelled = true;
    };
  }, [projectId, frontendKey, reloads]);

  // The theme at build time only seeds the document; later changes are posted to the running page. A React app is
  // compiled here in the browser, so the document arrives a moment after the files do: undefined until it does.
  const [doc, setDoc] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!context) return;
    let alive = true;
    buildAppDocument(context, channel, themeRef.current).then(
      (built) => alive && setDoc(built),
      (e) => {
        if (!alive) return;
        setDoc(null);
        setError(`The frontend couldn't be compiled: ${errorText(e)}`);
      },
    );
    return () => {
      alive = false;
    };
  }, [context, channel]);

  useEffect(() => setFrameErrors([]), [doc, reloads]);

  useFullScreen(shell, full, setFull);

  usePreviewBridge({
    frame,
    channel,
    wallet: provider,
    tokensUrl: `/api/studio/projects/${projectId}/tokens`,
    noWalletMessage: 'Connect a wallet from the Builder Hub header to use the preview.',
    onError: (message) => setFrameErrors((prev) => [...prev.slice(-4), message]),
    theme,
    app: context,
  });

  if (error) return <Notice tone="bad">{error}</Notice>;
  if (!context || doc === undefined) return <EmptyRow>Loading the preview…</EmptyRow>;

  const errorsNotice = frameErrors.length > 0 && (
    <Notice tone="bad">
      <span className="flex flex-col gap-1">
        <span className="font-medium">The page reported errors</span>
        {frameErrors.map((e, i) => (
          <code key={i} className="block whitespace-pre-wrap break-all font-mono text-[11px]">
            {e}
          </code>
        ))}
        <span className={cn(MUTED, 'text-[11px]')}>Paste these into the chat and Studio will fix the page.</span>
      </span>
    </Notice>
  );

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader label="Preview" />
      <Board>
        {context.contracts.length === 0 ? (
          <EmptyRow>
            No contract is deployed on testnet yet. The page still loads; `window.studio.contracts` fills in once a
            deployment runs.
          </EmptyRow>
        ) : (
          context.contracts.map((c) => (
            <div key={c.name} className="flex items-center gap-3 px-5 py-2.5 md:px-6">
              <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-900 dark:text-zinc-50">{c.name}</span>
              <span className={cn(MUTED, 'hidden text-[11px] sm:inline')}>{c.network}</span>
              <HashChip value={c.address} href={c.explorerUrl ?? undefined} len={6} />
            </div>
          ))
        )}
      </Board>

      {doc && <PublishSite projectId={projectId} projectName={overview.project.name} frontendKey={frontendKey} />}

      {!doc ? (
        <Notice>
          This project has no frontend yet. Ask Studio in the chat to build one, for example: “Build an app for my
          contracts”. It writes a React app in {REACT_ENTRY}, in the Builder Hub design and backed by your deployed
          contracts, and it runs here.
        </Notice>
      ) : (
        // One element in both modes, so the frame keeps its state when it goes full screen.
        <div
          ref={shell}
          className={cn('flex flex-col', full ? 'fixed inset-0 z-[100] bg-white dark:bg-zinc-950' : 'gap-3')}
          role={full ? 'dialog' : undefined}
          aria-modal={full || undefined}
          aria-label={full ? 'Frontend preview, full screen' : undefined}
        >
          <div
            className={cn(
              'flex flex-wrap items-center gap-2',
              full && 'border-b border-zinc-200 px-4 py-2 dark:border-zinc-800',
            )}
          >
            {full && (
              <>
                <AvalancheLogo width={18} height={16} aria-label="Avalanche" className="shrink-0" />
                <span className={LABEL}>{overview.project.name} · preview</span>
              </>
            )}
            <Pill tone={address ? 'good' : 'warn'}>{address ? 'wallet connected' : 'no wallet'}</Pill>
            {!full && (
              <span className={cn(MUTED, 'min-w-0 flex-1 text-[11px]')}>
                Sandboxed: the page can&apos;t reach Builder Hub. Wallet requests go to your connected wallet, which
                asks before signing.
              </span>
            )}
            <span className={cn(full && 'flex-1')} />
            <Button variant="ghost" className="h-7 px-1.5" onClick={() => setReloads((n) => n + 1)}>
              <RotateCw className="h-3 w-3" /> Reload
            </Button>
            <Button
              variant="ghost"
              className="h-7 px-1.5"
              onClick={() => setFull((f) => !f)}
              aria-label={full ? 'Exit full screen' : 'Full screen'}
              title={full ? 'Exit full screen (Esc)' : 'Full screen'}
            >
              {full ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              {full ? 'Exit' : 'Full screen'}
            </Button>
          </div>
          <iframe
            key={reloads}
            ref={frame}
            title="Frontend preview"
            srcDoc={doc}
            onLoad={() => frame.current?.contentWindow?.postMessage({ channel, type: 'theme', theme }, '*')}
            sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
            className={cn(
              'w-full bg-white dark:bg-zinc-950',
              full ? 'min-h-0 flex-1' : 'h-[70vh] min-h-[520px] border border-zinc-200 dark:border-zinc-800',
            )}
          />
          {full
            ? frameErrors.length > 0 && <div className="max-h-40 overflow-auto p-3">{errorsNotice}</div>
            : errorsNotice}
        </div>
      )}
    </div>
  );
}
