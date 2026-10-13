'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AppWindow, Maximize2, Minimize2, RotateCw } from 'lucide-react';
import { useTheme } from 'next-themes';
import { HashChip, MUTED, SectionHeader } from '@/components/explorer-v2/ui';
import { AvalancheLogo } from '@/components/navigation/avalanche-logo';
import { useActiveWalletProvider } from '@/components/toolbox/hooks/useLiveWalletChainId';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { cn } from '@/lib/utils';
import { api, errorText, type ProjectOverview } from './api';
import { referenceInChat } from './chat-reference';
import { PREVIEW_ENTRY, type PreviewContext } from './preview';
import { REACT_ENTRY, buildAppDocument } from './preview-react';
import { BONE, HowItWorks, PublishSite } from './PublishSite';
import { Bone, Button, EmptyState, LABEL, Notice } from './ui';
import { useFullScreen } from './useFullScreen';
import { usePreviewBridge, type Eip1193 } from './usePreviewBridge';

/** The strip on top of the frame, like a browser's: wallet state, the wired contracts, reload and full screen. */
const TOOLBAR =
  'flex min-h-10 flex-wrap items-center gap-x-4 gap-y-1 border-b border-zinc-200 bg-zinc-50/80 py-1.5 pl-4 pr-2 dark:border-zinc-800 dark:bg-zinc-900/40';
const FRAME_BOX = 'relative h-[70vh] min-h-[520px]';

/**
 * Stands in for the page while the frame boots: a header, a stat strip, a form and rows, the shape most Studio apps
 * have. It fades out once the frame has loaded, and covers the frame again at once on a reload.
 */
function FrameSkeleton({ painted }: { painted: boolean }) {
  return (
    <div
      aria-hidden={painted || undefined}
      role={painted ? undefined : 'status'}
      aria-label={painted ? undefined : 'Loading the preview'}
      className={cn(
        // zinc-50, not white: the light console tints white surfaces, and the frame's own page is white.
        'absolute inset-0 z-10 flex flex-col gap-6 overflow-hidden bg-zinc-50 p-6 dark:bg-zinc-950',
        // Only the way out fades: on a reload the bars cover the frame at once, so the old page never shows through.
        painted
          ? 'pointer-events-none opacity-0 transition-opacity duration-300 motion-reduce:transition-none'
          : 'opacity-100 transition-none',
      )}
    >
      <div className="flex items-center gap-3">
        <Bone className={cn(BONE, 'h-5 w-44')} />
        <Bone className={cn(BONE, 'h-4 w-20')} delay={0.04} />
        <span className="flex-1" />
        <Bone className={cn(BONE, 'h-8 w-28')} delay={0.08} />
      </div>
      <div className="h-px bg-zinc-200 dark:bg-zinc-800" />
      <Bone className={cn(BONE, 'h-2.5 w-16')} delay={0.12} />
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Bone key={i} className={cn(BONE, 'h-16')} delay={0.16 + i * 0.04} />
        ))}
      </div>
      <Bone className={cn(BONE, 'h-2.5 w-16')} delay={0.28} />
      <div className="flex gap-3">
        <Bone className={cn(BONE, 'h-8 flex-1')} delay={0.32} />
        <Bone className={cn(BONE, 'h-8 w-36')} delay={0.36} />
      </div>
      <Bone className={cn(BONE, 'h-2.5 w-24')} delay={0.4} />
      {[0, 1, 2].map((i) => (
        <Bone key={i} className={cn(BONE, 'h-9 w-full')} delay={0.44 + i * 0.04} />
      ))}
    </div>
  );
}

function WalletState({ connected }: { connected: boolean }) {
  return (
    <span
      title={connected ? undefined : 'Connect a wallet from the Builder Hub header to use the preview.'}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em]',
        connected ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300',
      )}
    >
      <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', connected ? 'bg-emerald-500' : 'bg-amber-400')} />
      {connected ? 'Wallet connected' : 'No wallet'}
    </span>
  );
}

/** Runs frontend/ in a sandboxed frame against the project's deployed contracts, signing with the builder's wallet. */
export function PreviewPanel({ overview }: { overview: ProjectOverview }) {
  const projectId = overview.project.id;
  const address = useWalletStore((s) => s.walletEVMAddress);
  const provider = useActiveWalletProvider({ enabled: Boolean(address), refreshKey: address }) as Eip1193 | null;
  const { resolvedTheme } = useTheme();
  const theme: 'light' | 'dark' = resolvedTheme === 'dark' ? 'dark' : 'light';
  const [context, setContext] = useState<PreviewContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compileError, setCompileError] = useState<string | null>(null);
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
    setError(null);
    api<PreviewContext>(`/api/studio/projects/${projectId}/frontend`)
      .then((c) => !cancelled && setContext(c))
      .catch((e) => !cancelled && setError(errorText(e)));
    return () => {
      cancelled = true;
    };
  }, [projectId, frontendKey, reloads]);

  // The theme at build time only seeds the document; later changes are posted to the running page. A React app is
  // compiled here in the browser, so the document arrives a moment after the files do: undefined until it does. A
  // compile error stays up until a later compile succeeds, so a fix from the chat replaces it without a flash.
  const [doc, setDoc] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!context) return;
    let alive = true;
    buildAppDocument(context, channel, themeRef.current).then(
      (built) => {
        if (!alive) return;
        setDoc(built);
        setCompileError(null);
      },
      (e) => {
        if (!alive) return;
        setDoc(null);
        setCompileError(errorText(e));
      },
    );
    return () => {
      alive = false;
    };
  }, [context, channel]);

  useEffect(() => setFrameErrors([]), [doc, reloads]);

  // The skeleton stays over the frame until this document, at this reload, has loaded and had a moment to render its
  // app. It is keyed on both, so a reload covers the frame in the same render that swaps it, not one frame later.
  const [paintedFor, setPaintedFor] = useState<{ doc: string; reloads: number } | null>(null);
  const painted = typeof doc === 'string' && paintedFor?.doc === doc && paintedFor.reloads === reloads;
  const paintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (paintTimer.current) clearTimeout(paintTimer.current);
    },
    [doc, reloads],
  );

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

  const hasFrontend = overview.files.some((f) => f.path === REACT_ENTRY || f.path === PREVIEW_ENTRY);

  if (error || !hasFrontend || compileError)
    return (
      <section className="flex flex-col gap-3">
        <SectionHeader label="Preview" />
        {error ? (
          <Notice tone="bad">{error}</Notice>
        ) : compileError ? (
          <Notice tone="bad">
            <span className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <span className="flex min-w-0 flex-col gap-1">
                <span className="font-medium">The frontend did not compile.</span>
                <code className="block whitespace-pre-wrap break-all font-mono text-[11px]">{compileError}</code>
              </span>
              <Button
                className="self-start"
                onClick={() => referenceInChat(`Fix this compile error in frontend/:\n\n${compileError}`)}
              >
                Ask Studio to fix
              </Button>
            </span>
          </Notice>
        ) : (
          <EmptyState
            icon={AppWindow}
            title="No frontend yet"
            action={
              <Button variant="secondary" onClick={() => referenceInChat('Build an app for my contracts.')}>
                Ask Studio to build one
              </Button>
            }
          >
            Studio writes a React app for your contracts, and it runs here.
          </EmptyState>
        )}
      </section>
    );

  // One tree while the frame boots and once it runs, so the publish board and the toolbar stay put when it lands.
  const ready = context !== null && typeof doc === 'string';

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
    <div className="flex flex-col gap-6">
      <PublishSite projectId={projectId} projectName={overview.project.name} frontendKey={frontendKey} />
      <section className="flex flex-col gap-3">
        <SectionHeader label="Preview" />
        {/* One element in both modes, so the frame keeps its state when it goes full screen. */}
        <div
          ref={shell}
          className={cn(
            'flex flex-col',
            full ? 'fixed inset-0 z-[100] bg-white dark:bg-zinc-950' : 'border border-zinc-200 dark:border-zinc-800',
          )}
          role={full ? 'dialog' : undefined}
          aria-modal={full || undefined}
          aria-label={full ? 'Frontend preview, full screen' : undefined}
        >
          <div className={TOOLBAR}>
            {full && (
              <>
                <AvalancheLogo width={18} height={16} aria-label="Avalanche" className="shrink-0" />
                <span className={LABEL}>{overview.project.name} · preview</span>
              </>
            )}
            <WalletState connected={Boolean(address)} />
            <span className="hidden min-w-0 flex-1 items-center gap-4 overflow-hidden sm:flex">
              {!context ? (
                <Bone className={cn(BONE, 'h-3 w-36')} />
              ) : context.contracts.length === 0 ? (
                <span className={cn(MUTED, 'text-[11px]')}>No contracts deployed yet</span>
              ) : (
                context.contracts.map((c) => (
                  <span key={c.name} className="inline-flex min-w-0 shrink-0 items-center gap-2" title={c.network}>
                    <span className="text-[12px] text-zinc-600 dark:text-zinc-300">{c.name}</span>
                    <HashChip value={c.address} href={c.explorerUrl ?? undefined} len={4} />
                  </span>
                ))
              )}
            </span>
            <span className="flex-1 sm:hidden" />
            <span className="flex shrink-0 items-center">
              <Button
                variant="ghost"
                className="h-7 px-2"
                aria-label="Reload"
                disabled={!ready}
                onClick={() => setReloads((n) => n + 1)}
              >
                <RotateCw className="h-3 w-3" /> <span className="hidden sm:inline">Reload</span>
              </Button>
              <Button
                variant="ghost"
                className="h-7 px-2"
                disabled={!ready}
                onClick={() => setFull((f) => !f)}
                aria-label={full ? 'Exit full screen' : 'Full screen'}
                title={full ? 'Exit full screen (Esc)' : 'Full screen'}
              >
                {full ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{full ? 'Exit' : 'Full screen'}</span>
              </Button>
            </span>
          </div>
          <div className={cn(full ? 'relative min-h-0 flex-1' : FRAME_BOX)}>
            <FrameSkeleton painted={ready && painted} />
            {ready && (
              <iframe
                key={reloads}
                ref={frame}
                title="Frontend preview"
                srcDoc={doc}
                onLoad={() => {
                  frame.current?.contentWindow?.postMessage({ channel, type: 'theme', theme }, '*');
                  if (paintTimer.current) clearTimeout(paintTimer.current);
                  paintTimer.current = setTimeout(() => setPaintedFor({ doc, reloads }), 450);
                }}
                sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
                className="absolute inset-0 h-full w-full bg-white dark:bg-zinc-950"
              />
            )}
          </div>
          {errorsNotice && (
            <div className={cn('border-t border-zinc-200 p-3 dark:border-zinc-800', full && 'max-h-40 overflow-auto')}>
              {errorsNotice}
            </div>
          )}
        </div>
        <HowItWorks>
          <p>
            The page runs in a sandbox and can&apos;t reach Builder Hub. Its wallet requests go to your connected
            wallet, which asks before it signs. The app reads the deployed contracts from{' '}
            <code>window.studio.contracts</code>.
          </p>
          <p>
            Publishing gives visitors a snapshot of the frontend and of this project&apos;s testnet contracts. Visitors
            sign with their own wallet. Publish again to send them your latest changes. All your sites live under your
            builder name, and you can&apos;t change it after the first publish.
          </p>
        </HowItWorks>
      </section>
    </div>
  );
}
