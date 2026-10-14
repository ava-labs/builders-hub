'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import type { PreviewContext } from './preview';
import { buildAppDocument } from './preview-react';
import { usePreviewBridge, type Eip1193 } from './usePreviewBridge';

/** The visitor's own injected wallet; a published site has no Builder Hub session to lean on. */
function useInjectedWallet(): Eip1193 | null {
  const [wallet, setWallet] = useState<Eip1193 | null>(null);
  useEffect(() => {
    const w = window as unknown as { ethereum?: Eip1193; avalanche?: Eip1193 };
    let announced: Eip1193 | null = null;
    const pick = () => setWallet((current) => current ?? w.avalanche ?? w.ethereum ?? announced);
    // EIP-6963: wallets that announce themselves instead of (or besides) setting window.ethereum.
    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<{ provider?: Eip1193; info?: { rdns?: string } }>).detail;
      if (!detail?.provider) return;
      if (!announced || detail.info?.rdns === 'app.core.extension') announced = detail.provider;
      pick();
    };
    window.addEventListener('eip6963:announceProvider', onAnnounce);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    pick();
    // Extensions can inject after load.
    window.addEventListener('ethereum#initialized', pick, { once: true });
    const late = setTimeout(pick, 1500);
    return () => {
      window.removeEventListener('eip6963:announceProvider', onAnnounce);
      window.removeEventListener('ethereum#initialized', pick);
      clearTimeout(late);
    };
  }, []);
  return wallet;
}

/** A published Studio frontend: the whole viewport is the app, sandboxed away from the Builder Hub origin. */
export function PublishedSite({
  owner,
  slug,
  title,
  context,
}: {
  owner: string;
  slug: string;
  title: string;
  context: PreviewContext;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const channel = useMemo(() => crypto.randomUUID(), []);
  const wallet = useInjectedWallet();
  const { resolvedTheme } = useTheme();
  const theme: 'light' | 'dark' = resolvedTheme === 'dark' ? 'dark' : 'light';
  const themeRef = useRef(theme);
  themeRef.current = theme;
  // Built after mount only: the channel is random per page load, and a server-rendered copy would carry a different
  // one than the bridge listens on, so the frame's wallet requests would go unanswered.
  const [doc, setDoc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void buildAppDocument(context, channel, themeRef.current).then((built) => alive && setDoc(built));
    return () => {
      alive = false;
    };
  }, [context, channel]);

  usePreviewBridge({
    frame,
    channel,
    wallet,
    tokensUrl: `/api/builder/${owner}/${slug}/tokens`,
    noWalletMessage: 'No wallet found. Install Core or another EVM wallet to continue.',
    onError: (message) => console.warn(`[${title}]`, message),
    theme,
    app: context,
  });

  if (!doc) return null;
  return (
    <iframe
      ref={frame}
      title={title}
      srcDoc={doc}
      onLoad={() => frame.current?.contentWindow?.postMessage({ channel, type: 'theme', theme }, '*')}
      sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
      className="fixed inset-0 h-full w-full border-0 bg-white dark:bg-zinc-950"
    />
  );
}
