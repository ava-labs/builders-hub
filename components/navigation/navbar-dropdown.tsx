'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, Moon, Sun, UserRound } from 'lucide-react';
import { menuSections, singleItems } from './nav-config';
import { useSession } from 'next-auth/react';
import { useLoginModalTrigger } from '@/hooks/useLoginModal';
import { hasTeam1AcademyAccess } from '@/lib/auth/roles';

/**
 * Custom navbar dropdown menu for tablet/mobile breakpoints (≤1023px)
 * Replaces fumadocs' default dropdown to ensure all menu items are visible
 *
 * IMPORTANT: Navigation items are defined in nav-config.ts (Single Source of Truth)
 * Do NOT add navigation items here - update nav-config.ts instead.
 */
export function NavbarDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { data: session, status } = useSession();
  const { openLoginModal } = useLoginModalTrigger();
  const isAuthenticated = status === 'authenticated';
  const canSeeTeam1 = hasTeam1AcademyAccess(session?.user?.custom_attributes);
  const visibleMenuSections = menuSections.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) => item.href !== '/academy/team1' || canSeeTeam1,
    ),
  }));

  // Close on navigation
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Handle clicks outside the dropdown
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    // Use capture phase to catch events before they're stopped
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [isOpen]);

  return (
    <div className="relative" data-navbar-dropdown ref={dropdownRef}>
      {/* Dropdown trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors duration-100 hover:bg-accent hover:text-accent-foreground p-1.5 group"
        aria-label="Toggle Menu"
        aria-expanded={isOpen}
      >
        <ChevronDown className={`size-5.5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Dropdown menu — v2 sheet: squared, hairline-ruled ledger */}
          <div
            className="absolute right-0 top-full mt-2 w-[90vw] max-w-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-[0_12px_24px_-12px_rgb(0_0_0_/_0.15)] z-[100] max-h-[70vh] overflow-y-auto"
          >
            <div className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
              {/* Controls row: theme + login */}
              <div className="flex items-center justify-between px-4 py-3">
                {/* Theme toggle */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const html = document.documentElement;
                    const currentTheme = html.classList.contains('dark') ? 'dark' : 'light';
                    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                    html.classList.remove('light', 'dark');
                    html.classList.add(newTheme);
                    html.style.colorScheme = newTheme;
                    localStorage.setItem('theme', newTheme);
                  }}
                  className="inline-flex h-8 items-center border border-zinc-200 dark:border-zinc-800 px-1 hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors"
                  aria-label="Toggle Theme"
                  type="button"
                >
                  <Sun fill="currentColor" className="size-6.5 p-1.5 text-zinc-500 dark:text-zinc-400" />
                  <Moon fill="currentColor" className="size-6.5 p-1.5 text-zinc-500 dark:text-zinc-400" />
                </button>
                {isAuthenticated ? (
                  <Link
                    href="/profile"
                    aria-label="Profile"
                    title="Profile"
                    className="inline-flex h-8 w-8 items-center justify-center border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-400 hover:text-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-50 transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    <UserRound className="size-4.5" strokeWidth={1.25} />
                  </Link>
                ) : (
                  <button
                    type="button"
                    aria-label="Login"
                    title="Login"
                    className="inline-flex h-8 w-8 items-center justify-center border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-400 hover:text-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-50 transition-colors"
                    onClick={() => {
                      setIsOpen(false);
                      openLoginModal(window.location.href);
                    }}
                  >
                    <UserRound className="size-4.5" strokeWidth={1.25} />
                  </button>
                )}
              </div>
              {/* Menu sections */}
              {visibleMenuSections.map((section) => (
                <div key={section.title} className="flex flex-col px-4 py-3">
                  <Link
                    href={section.href}
                    className="mb-1.5 font-mono text-[10px] tracking-[0.18em] uppercase text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 transition-colors"
                  >
                    {section.title}
                  </Link>
                  {section.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="inline-flex items-center gap-2 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 transition-colors hover:text-zinc-950 dark:hover:text-zinc-50"
                      {...(item.external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
                    >
                      {item.text}
                    </Link>
                  ))}
                </div>
              ))}

              {/* Single items */}
              {singleItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex items-center gap-2 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300 transition-colors hover:text-zinc-950 dark:hover:text-zinc-50"
                >
                  {item.text}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

