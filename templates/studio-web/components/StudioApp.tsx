'use client';

import { ConnectButton, useConnectModal } from '@rainbow-me/rainbowkit';
import { useEffect, useRef } from 'react';
import { useConfig } from 'wagmi';
import { APP_BODY, APP_SCRIPTS } from '../lib/app-content';
import { createStudioRuntime } from '../lib/studio-runtime';
import { studioConfig } from '../lib/studio.config';

/** Runs the scripts of the page in order, waiting for each file to finish so later ones can rely on earlier ones. */
async function runScripts() {
  for (const script of APP_SCRIPTS) {
    const el = document.createElement('script');
    if (script.type) el.type = script.type;
    let src = script.src;
    if (!src && script.code !== undefined) {
      src = URL.createObjectURL(new Blob([script.code], { type: 'text/javascript' }));
    } else if (src?.startsWith('/app/')) {
      // A fresh URL makes module scripts run again if this page is mounted twice (for example, after navigating back).
      src = `${src}${src.includes('?') ? '&' : '?'}v=${Date.now()}`;
    }
    if (!src) continue;
    await new Promise<void>((resolve) => {
      el.onload = () => resolve();
      el.onerror = () => {
        console.error(`Could not load ${script.src ?? 'an inline script'}`);
        resolve();
      };
      el.src = src;
      document.body.appendChild(el);
    });
  }
}

/**
 * The Studio app, mounted in the page. It is plain HTML and JavaScript that talks to `window.studio`; wagmi and
 * RainbowKit provide the wallet behind it. To move a screen to React later, read the same contracts from
 * lib/studio.config.ts and use wagmi's hooks instead.
 */
export function StudioApp() {
  const config = useConfig();
  const { openConnectModal, connectModalOpen } = useConnectModal();
  const host = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const modal = useRef({ open: openConnectModal, isOpen: connectModalOpen });
  modal.current = { open: openConnectModal, isOpen: connectModalOpen };

  useEffect(() => {
    // Once per mount: the page's scripts attach listeners to the markup, so re-running them would double up.
    if (started.current || !host.current) return;
    started.current = true;
    window.studio = createStudioRuntime({
      config,
      openConnectModal: () => modal.current.open?.(),
      isModalOpen: () => Boolean(modal.current.isOpen),
    });
    host.current.innerHTML = APP_BODY;
    void runScripts();
  }, [config]);

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '8px 20px',
          borderBottom: '1px solid var(--bh-border, #e4e4e7)',
          background: 'var(--bh-bg, #fff)',
        }}
      >
        <span
          style={{
            font: '700 11px var(--bh-font-mono, ui-monospace, monospace)',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--bh-muted, #71717a)',
          }}
        >
          {studioConfig.title}
        </span>
        <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false} />
      </div>
      {/* Fills the body column, so the page's own footer can sit at the bottom of a short page. */}
      <div ref={host} suppressHydrationWarning style={{ display: 'flex', flexDirection: 'column', flex: '1 0 auto' }} />
    </>
  );
}
