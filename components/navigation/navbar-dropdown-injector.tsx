'use client';

import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { NavbarDropdown } from './navbar-dropdown';

/**
 * Injects custom navbar dropdown at ≤1023px breakpoint
 * Replaces fumadocs' dropdown which has CSS specificity issues with Tailwind v4
 */
export function NavbarDropdownInjector() {
  useEffect(() => {
    const checkAndInject = () => {
      const isMobile = window.innerWidth <= 1023;
      
      if (!isMobile) {
        // Remove if exists
        const existing = document.querySelector('[data-custom-navbar-dropdown]');
        if (existing) {
          existing.remove();
        }
        return;
      }

      const navbar = document.querySelector('nav[aria-label="Main"]') || document.querySelector('header[aria-label="Main"]');
      if (!navbar) return;

      // Check if already exists
      if (navbar.querySelector('[data-custom-navbar-dropdown]')) {
        return;
      }

      // Find the right side container (where search icon is)
      const rightContainer = navbar.querySelector('ul.flex.flex-row.items-center.ms-auto') ||
                            navbar.querySelector('ul.ms-auto');
      if (!rightContainer) return;

      // Create container
      const container = document.createElement('li');
      container.setAttribute('data-custom-navbar-dropdown', 'true');
      container.className = 'list-none';
      
      // Append at the end (after search icon)
      rightContainer.appendChild(container);

      // Render React component
      const root = createRoot(container);
      root.render(<NavbarDropdown />);
    };

    checkAndInject();
    const resizeHandler = () => checkAndInject();
    window.addEventListener('resize', resizeHandler);
    const timeout = setTimeout(checkAndInject, 100);

    return () => {
      window.removeEventListener('resize', resizeHandler);
      clearTimeout(timeout);
    };
  }, []);

  return null;
}

