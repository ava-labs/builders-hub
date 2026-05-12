'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavbarDropdown } from './navbar-dropdown';

/**
 * Mounts the custom navbar dropdown at ≤1023px breakpoint.
 *
 * Renders via createPortal (not createRoot) so the portal stays inside the
 * parent React tree and inherits providers like SessionProvider. A previous
 * createRoot-based version broke when NavbarDropdown started calling
 * useSession() — the detached root had no provider and the component crashed,
 * leaving an empty <li> with no burger button.
 */
export function NavbarDropdownInjector() {
  const [container, setContainer] = useState<HTMLLIElement | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth <= 1023);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      document
        .querySelectorAll('[data-custom-navbar-dropdown]')
        .forEach((el) => el.remove());
      setContainer(null);
      return;
    }

    let injected: HTMLLIElement | null = null;
    let cancelled = false;

    const tryInject = (): boolean => {
      if (cancelled) return false;

      const navbar =
        document.querySelector('nav[aria-label="Main"]') ||
        document.querySelector('header[aria-label="Main"]');
      if (!navbar) return false;

      const existing = navbar.querySelector<HTMLLIElement>(
        '[data-custom-navbar-dropdown]',
      );
      if (existing) {
        injected = existing;
        setContainer(existing);
        return true;
      }

      const rightContainer =
        navbar.querySelector('ul.flex.flex-row.items-center.ms-auto') ||
        navbar.querySelector('ul.ms-auto');
      if (!rightContainer) return false;

      const li = document.createElement('li');
      li.setAttribute('data-custom-navbar-dropdown', 'true');
      li.className = 'list-none';
      rightContainer.appendChild(li);
      injected = li;
      setContainer(li);
      return true;
    };

    if (tryInject()) {
      return () => {
        cancelled = true;
        if (injected?.parentNode) injected.parentNode.removeChild(injected);
      };
    }

    // Navbar wasn't ready yet — watch for it to appear / re-render.
    const observer = new MutationObserver(() => {
      if (tryInject()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      observer.disconnect();
      if (injected?.parentNode) injected.parentNode.removeChild(injected);
    };
  }, [isMobile]);

  if (!container) return null;
  return createPortal(<NavbarDropdown />, container);
}
