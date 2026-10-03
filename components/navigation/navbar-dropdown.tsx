'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronDown, Moon, Sun, UserRound } from 'lucide-react';
import { menuSections, singleItems, type NavItem, type NavSection } from './nav-config';
import { useSession } from 'next-auth/react';
import { hasTeam1AcademyAccess } from '@/lib/auth/roles';
import { useLoginModalTrigger } from '@/hooks/useLoginModal';

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
  const { openLoginModal } = useLoginModalTrigger();
  const handleLogin = (mode: 'signin' | 'signup') => {
    setIsOpen(false);
    openLoginModal(undefined, mode);
  };
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { data: session, status } = useSession();
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
          {/* The privacy banner covers the bottom of the viewport until the visitor answers it. While it
              shows, the sheet ends above it, so the last items can scroll into view and be tapped.
              4rem is the sheet top (under the 3.5rem navbar) plus a small gap. */}
          <div
            className="absolute right-0 top-full mt-2 w-[90vw] max-w-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-[0_12px_24px_-12px_rgb(0_0_0_/_0.15)] z-[100] max-h-[min(70vh,calc(100dvh-var(--fd-banner-height,0px)-var(--privacy-banner-inset,0px)-4rem))] overflow-y-auto"
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
                  <div className="flex items-center gap-3 text-sm">
                    <button type="button" onClick={() => handleLogin('signin')}>
                      Log in
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-8 items-center border border-zinc-900 bg-zinc-900 px-3 font-medium text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                      onClick={() => handleLogin('signup')}
                    >
                      Sign up
                    </button>
                  </div>
                )}
              </div>
              {/* Menu sections */}
              {visibleMenuSections.map((section) => (
                <NavSectionBlock key={section.title} section={section} />
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

/**
 * One section of the sheet: its title link, then a two-up row of picture
 * cards for items that carry an image, then text rows for the rest.
 */
export function NavSectionBlock({ section }: { section: NavSection }) {
  const cards = section.items.filter((item): item is NavItem & { image: string } => Boolean(item.image));
  const rows = section.items.filter((item) => !item.image);
  return (
    <div className="flex flex-col px-4 py-3">
      <Link
        href={section.href}
        className="mb-1.5 font-mono text-[10px] tracking-[0.18em] uppercase text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 transition-colors"
      >
        {section.title}
      </Link>
      {cards.length > 0 ? (
        <div className="grid grid-cols-2 gap-2.5 py-1">
          {cards.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col gap-1.5 text-sm text-zinc-700 dark:text-zinc-300 transition-colors hover:text-zinc-950 dark:hover:text-zinc-50"
            >
              <Image
                src={item.image}
                alt=""
                width={1536}
                height={864}
                sizes="208px"
                className="aspect-video w-full object-cover border border-zinc-200 dark:border-zinc-800"
              />
              <span>{item.text}</span>
            </Link>
          ))}
        </div>
      ) : null}
      {rows.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="inline-flex items-center gap-2 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 transition-colors hover:text-zinc-950 dark:hover:text-zinc-50"
          {...(item.external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
        >
          {item.text}
          {item.badge ? (
            <span className="rounded-full border border-brand/40 px-1.5 py-px font-mono text-[9px] uppercase tracking-[0.1em] text-brand dark:border-brand-soft/40 dark:text-brand-soft">
              {item.badge}
            </span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
