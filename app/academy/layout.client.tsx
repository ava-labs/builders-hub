'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

export function AcademyLayoutClient() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith('/academy')) {
      document.body.setAttribute('data-layout', 'academy');
    } else {
      document.body.removeAttribute('data-layout');
    }

    return () => {
      document.body.removeAttribute('data-layout');
    };
  }, [pathname]);

  useEffect(() => {
    if (!pathname.startsWith('/academy')) return;

    const prefix =
      pathname.startsWith('/academy/avalanche')
        ? '/academy/avalanche'
        : pathname.startsWith('/academy/blockchain')
        ? '/academy/blockchain'
        : pathname.startsWith('/academy/entrepreneur')
        ? '/academy/entrepreneur'
        : null;

    if (!prefix) return;

    // Scope sidebar tree to the active academy
    const sidebar = document.querySelector<HTMLElement>('[data-sidebar="sidebar"]');
    if (sidebar) {
      const links = sidebar.querySelectorAll<HTMLAnchorElement>('a[href^="/academy/"]');

      links.forEach((link) => {
        const href = link.getAttribute('href') || '';
        const item = link.closest<HTMLElement>('[data-sidebar="menu-item"]') || link.closest('li');
        if (!item) return;

        if (href.startsWith(prefix)) {
          item.style.display = '';
        } else {
          item.style.display = 'none';
        }
      });
    }

    // Scope any Fumadocs course dropdowns (selects) to the active academy
    const selects = document.querySelectorAll<HTMLSelectElement>('select');
    selects.forEach((select) => {
      let hasVisibleOption = false;

      Array.from(select.options).forEach((option) => {
        const value = option.value || option.getAttribute('value') || '';
        if (value && value.startsWith('/academy/')) {
          if (value.startsWith(prefix)) {
            option.hidden = false;
            option.disabled = false;
            hasVisibleOption = true;
          } else {
            option.hidden = true;
            option.disabled = true;
          }
        }
      });

      if (hasVisibleOption && !select.value.startsWith(prefix)) {
        const first = Array.from(select.options).find(
          (opt) =>
            !opt.disabled &&
            !opt.hidden &&
            (opt.value || opt.getAttribute('value') || '').startsWith(prefix),
        );
        if (first) {
          select.value = first.value;
        }
      }
    });
  }, [pathname]);

  return null;
}

