'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/** The navbar section a page belongs to ('' when none). */
export function activeNavSection(pathname: string): string {
  // Developers (url '/docs/primary-network') covers both Docs and Academy
  if (pathname.startsWith('/docs') || pathname.startsWith('/academy')) return '/docs';
  if (pathname.startsWith('/console')) return '/console';
  if (pathname.startsWith('/blog') || pathname.startsWith('/guides')) return '/guides'; // Blog menu has url '/guides'
  if (pathname.startsWith('/integrations')) return '/integrations';
  if (pathname.startsWith('/explorer')) return '/explorer';
  if (pathname.startsWith('/stats')) return '/stats';
  if (pathname.startsWith('/hackathons') || pathname.startsWith('/events')) return '/events';
  if (pathname.startsWith('/grants')) return '/grants';
  if (pathname.startsWith('/audits')) return '/audits';
  if (pathname.startsWith('/chat')) return '/chat';
  return '';
}

export function ActiveNavHighlighter() {
  const pathname = usePathname();

  useEffect(() => {
    // Scoped to the site navbar (#nd-nav): in-page navs (explorer rail,
    // docs subnav) manage their own active state and must not be stamped.
    // Remove all active states first
    const allNavLinks = document.querySelectorAll('#nd-nav a, #nd-nav button');
    allNavLinks.forEach((link) => {
      link.removeAttribute('data-active');
      link.removeAttribute('aria-current');
    });

    // Determine which section is active and find matching nav items
    const activeSection = activeNavSection(pathname);

    if (activeSection) {
      // Find nav links that match the active section
      const navLinks = document.querySelectorAll('#nd-nav a, #nd-nav button');
      navLinks.forEach((link) => {
        const href = link.getAttribute('href');
        if (href) {
          // Check if this link's href matches or starts with the active section
          if (href === activeSection || href.startsWith(activeSection + '/')) {
            // Special handling for docs
            if (activeSection === '/docs' && href.startsWith('/docs/')) {
              link.setAttribute('data-active', 'true');
              link.setAttribute('aria-current', 'page');
            }
            // Handle stats which has url '/stats/overview'
            else if (activeSection === '/stats' && href.startsWith('/stats')) {
              link.setAttribute('data-active', 'true');
              link.setAttribute('aria-current', 'page');
            }
            // Handle explorer which has url '/explorer'
            else if (activeSection === '/explorer' && href.startsWith('/explorer')) {
              link.setAttribute('data-active', 'true');
              link.setAttribute('aria-current', 'page');
            }
            // All other sections
            else if (href === activeSection) {
              link.setAttribute('data-active', 'true');
              link.setAttribute('aria-current', 'page');
            }
          }
        }
      });
    }
  }, [pathname]);

  return null; // This component doesn't render anything
}
