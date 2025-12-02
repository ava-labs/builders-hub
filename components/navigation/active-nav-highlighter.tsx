'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

export function ActiveNavHighlighter() {
  const pathname = usePathname();

  useEffect(() => {
    // Remove all active states first
    const allNavLinks = document.querySelectorAll('nav a, nav button');
    allNavLinks.forEach((link) => {
      link.removeAttribute('data-active');
      link.removeAttribute('aria-current');
    });

    // Determine which section is active and find matching nav items
    let activeSection = '';
    
    if (pathname.startsWith('/docs')) {
      activeSection = '/docs';
    } else if (pathname.startsWith('/academy')) {
      activeSection = '/academy';
    } else if (pathname.startsWith('/console')) {
      activeSection = '/console';
    } else if (pathname.startsWith('/blog') || pathname.startsWith('/guides')) {
      activeSection = '/guides'; // Blog menu has url '/guides'
    } else if (pathname.startsWith('/integrations')) {
      activeSection = '/integrations';
    } else if (pathname.startsWith('/explorer')) {
      activeSection = '/explorer';
    } else if (pathname.startsWith('/stats')) {
      activeSection = '/stats';
    } else if (pathname.startsWith('/events') || pathname.startsWith('/hackathons')) {
      activeSection = '/events';
    } else if (pathname.startsWith('/grants') || pathname.startsWith('/codebase')) {
      activeSection = '/grants';
    } else if (pathname.startsWith('/university')) {
      activeSection = '/university';
    }

    if (activeSection) {
      // Find nav links that match the active section
      const navLinks = document.querySelectorAll('nav a, nav button');
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

