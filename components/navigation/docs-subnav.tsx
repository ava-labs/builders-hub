'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

const tabs = [
  {
    label: 'Documentation',
    href: '/docs/quick-start',
    pathMatch: (path: string) => 
      path === '/docs/quick-start' ||
      (path.startsWith('/docs/') && 
       !path.startsWith('/docs/api-reference') && 
       !path.startsWith('/docs/rpcs') && 
       !path.startsWith('/docs/tooling') && 
       !path.startsWith('/docs/acps'))
  },
  {
    label: 'APIs',
    href: '/docs/api-reference',
    pathMatch: (path: string) => path.startsWith('/docs/api-reference')
  },
  {
    label: 'RPCs',
    href: '/docs/rpcs',
    pathMatch: (path: string) => path.startsWith('/docs/rpcs')
  },
  {
    label: 'SDKs',
    href: '/docs/tooling',
    pathMatch: (path: string) => path.startsWith('/docs/tooling')
  },
  {
    label: 'ACPs',
    href: '/docs/acps',
    pathMatch: (path: string) => path.startsWith('/docs/acps')
  },
];

export function DocsSubNav() {
  const pathname = usePathname();

  return (
    <div className="sticky top-14 z-10 w-full border-b border-border bg-background" id="docs-subnav">
      <div className="flex h-12 items-center gap-6 pr-4 pl-0 overflow-x-auto relative">
        {tabs.map((tab) => {
          const isActive = tab.pathMatch(pathname);
          
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'text-sm font-medium transition-colors hover:text-foreground/80 whitespace-nowrap pb-2',
                isActive
                  ? 'text-foreground border-b-2 border-primary'
                  : 'text-muted-foreground'
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

