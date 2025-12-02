'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, CircleUserRound, Moon, Sun } from 'lucide-react';

/**
 * Custom navbar dropdown menu for tablet/mobile breakpoints (≤1023px)
 * Replaces fumadocs' default dropdown to ensure all menu items are visible
 */
export function NavbarDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const menuSections = [
    {
      title: 'Academy',
      href: '/academy',
      items: [
        { text: 'Avalanche L1 Academy', href: '/academy' },
        { text: 'Blockchain Academy', href: '/academy' },
        { text: 'Entrepreneur Academy', href: '/academy' },
      ],
    },
    {
      title: 'Documentation',
      href: '/docs/primary-network',
      items: [
        { text: 'Primary Network', href: '/docs/primary-network' },
        { text: 'Avalanche L1s', href: '/docs/avalanche-l1s' },
        { text: 'Nodes & Validators', href: '/docs/nodes' },
        { text: 'Interoperability', href: '/docs/cross-chain' },
      ],
    },
    {
      title: 'Console',
      href: '/console',
      items: [
        { text: 'Console', href: '/console' },
        { text: 'Interchain Messaging Tools', href: '/console/icm/setup' },
        { text: 'Interchain Token Transfer Tools', href: '/console/ictt/setup' },
        { text: 'Testnet Faucet', href: '/console/primary-network/faucet' },
      ],
    },
    {
      title: 'Events',
      href: '/hackathons',
      items: [
        { text: 'Hackathons', href: '/hackathons' },
        { text: 'Avalanche Calendar', href: 'https://lu.ma/calendar/cal-Igl2DB6quhzn7Z4', external: true },
        { text: 'Community Driven Events', href: 'https://lu.ma/Team1?utm_source=builder_hub', external: true },
      ],
    },
    {
      title: 'Grants',
      href: '/grants',
      items: [
        { text: 'Codebase', href: '/codebase' },
        { text: 'InfraBUIDL', href: '/grants/infrabuidl' },
        { text: 'InfraBUIDL (AI)', href: '/grants/infrabuidlai' },
        { text: 'Retro9000', href: 'https://retro9000.avax.network', external: true },
        { text: 'Blizzard Fund', href: 'https://www.blizzard.fund/', external: true },
      ],
    },
  ];

  const singleItems = [
    { text: 'University', href: '/university' },
    { text: 'Integrations', href: '/integrations' },
    { text: 'Blog', href: '/guides' },
    { text: 'Stats', href: '/stats/overview' },
  ];

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
          {/* Dropdown menu */}
          <div 
            className="absolute right-0 top-full mt-2 w-[90vw] max-w-md bg-background border border-border rounded-lg shadow-lg z-[100] max-h-[70vh] overflow-y-auto"
          >
            <div className="flex flex-col p-4 gap-4">
              {/* Controls row: theme + login */}
              <div className="flex items-center justify-between pb-2 border-b border-border">
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
                  className="inline-flex items-center rounded-full border p-1 hover:bg-accent"
                  aria-label="Toggle Theme"
                  type="button"
                >
                  <Sun fill="currentColor" className="size-6.5 rounded-full p-1.5 text-muted-foreground" />
                  <Moon fill="currentColor" className="size-6.5 rounded-full p-1.5 text-muted-foreground" />
                </button>
                <Link
                  href="/login"
                  aria-label="Login"
                  title="Login"
                  className="inline-flex items-center justify-center rounded-md p-1.5 hover:bg-accent"
                >
                  <CircleUserRound className="size-5" />
                </Link>
              </div>
              {/* Menu sections */}
              {menuSections.map((section) => (
                <div key={section.title} className="flex flex-col">
                  <Link 
                    href={section.href}
                    className="mb-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {section.title}
                  </Link>
                  {section.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="inline-flex items-center gap-2 py-1.5 text-sm transition-colors hover:text-accent-foreground"
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
                  className="inline-flex items-center gap-2 py-1.5 text-sm transition-colors hover:text-accent-foreground"
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


