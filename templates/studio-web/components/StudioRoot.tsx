'use client';

import { ConnectButton, useConnectModal } from '@rainbow-me/rainbowkit';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useConfig } from 'wagmi';
import { createStudioRuntime } from '../lib/studio-runtime';
import { studioConfig } from '../lib/studio.config';

const MARK_PATHS = [
  'M109.139252,23.041748 C111.741776,24.518684 114.786873,25.521351 116.039948,27.602837 C123.769547,40.442513 131.114777,53.514198 138.545532,66.532860 C141.523560,71.750351 141.392197,76.930382 138.378067,82.178566 C122.784348,109.330147 107.212326,136.494400 91.727638,163.708237 C88.432472,169.499405 83.770172,172.296158 77.077980,172.237946 C62.580860,172.111847 48.081749,172.237732 33.583733,172.183975 C25.895014,172.155457 23.042721,167.395203 26.880989,160.673264 C49.344860,121.332367 71.899803,82.043488 94.420807,42.735210 C97.235901,37.821735 99.810646,32.750118 102.939713,28.046438 C104.299789,26.001934 106.781303,24.703455 109.139252,23.041748 z',
  'M190.145935,151.838699 C192.156281,155.320618 194.133530,158.409164 195.809311,161.653442 C198.644424,167.142075 196.006195,172.076218 189.921402,172.129471 C171.131317,172.293900 152.337845,172.294647 133.547867,172.121841 C127.530586,172.066513 124.725456,166.870987 127.775551,161.592056 C136.920776,145.764069 146.170135,129.994598 155.552734,114.306282 C159.019684,108.509308 164.857819,108.843597 168.514145,114.968781 C175.755188,127.099236 182.832336,139.327515 190.145935,151.838699 z',
];

/**
 * Wraps the app: connects wagmi and RainbowKit to `window.studio` before the app renders, so the `@studio/react`
 * hooks (and any code that talks to window.studio) sign with whichever wallet the visitor connects. The app itself
 * is ordinary React under frontend/; to use wagmi's own hooks instead, import them there.
 */
export function StudioRoot({ children }: { children: ReactNode }) {
  const config = useConfig();
  const { openConnectModal, connectModalOpen } = useConnectModal();
  const [ready, setReady] = useState(false);
  const started = useRef(false);
  const modal = useRef({ open: openConnectModal, isOpen: connectModalOpen });
  modal.current = { open: openConnectModal, isOpen: connectModalOpen };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    window.studio = createStudioRuntime({
      config,
      openConnectModal: () => modal.current.open?.(),
      isModalOpen: () => Boolean(modal.current.isOpen),
    });
    setReady(true);
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
      {ready ? children : null}
      <footer className="bh-built">
        <svg viewBox="22 20 178 155" width="14" height="12" aria-hidden="true" focusable="false">
          {MARK_PATHS.map((d) => (
            <path key={d} fill="#E6212F" d={d} />
          ))}
        </svg>
        <span>
          Built on{' '}
          <a href="https://build.avax.network/console/studio" target="_blank" rel="noopener noreferrer">
            Builder Hub Studio
          </a>{' '}
          · Powered by Avalanche
        </span>
      </footer>
    </>
  );
}
