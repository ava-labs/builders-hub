"use client";

import { useEffect, useState } from 'react';
import { type LinkItemType } from 'fumadocs-ui/layouts/shared';
import { BookOpen, FileText, ArrowUpRight } from 'lucide-react';

interface BlogPost {
  title: string;
  description: string;
  url: string;
  date: string;
}

// Static fallback items that match the server-rendered blogMenu
// This ensures hydration consistency
const staticBlogItems = [
  {
    icon: <BookOpen />,
    text: 'Latest Articles',
    description:
      'Read the latest guides, tutorials, and insights from the Avalanche ecosystem.',
    url: '/guides',
  },
  {
    icon: <ArrowUpRight />,
    text: 'Browse All Posts',
    description:
      'Explore our complete collection of articles, guides, and community content.',
    url: '/guides',
    menu: {
      className: 'lg:col-start-2',
    },
  },
];

export function useDynamicBlogMenu(): LinkItemType {
  const [latestBlogs, setLatestBlogs] = useState<BlogPost[] | null>(null);
  const [mounted, setMounted] = useState(false);

  // Defer the fetch — and any state transition — until after hydration
  // has finished. Ensures SSR and the first client render both emit
  // exactly the static menu, so Radix's useId sequence upstream stays
  // deterministic between the two passes.
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/latest-blogs');
        if (!res.ok) return;
        // Dev-mode Turbopack can briefly return an HTML error page for
        // a route during HMR. Gate on content-type so we don't trip
        // JSON.parse on "<!DOCTYPE ..." and leak a SyntaxError to the
        // console.
        const contentType = res.headers.get('content-type') ?? '';
        if (!contentType.includes('application/json')) return;
        const data = (await res.json()) as BlogPost[];
        if (!cancelled) setLatestBlogs(data);
      } catch {
        // Silently ignore — users don't need to know the blog preview
        // failed, and the static fallback keeps the menu usable.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mounted]);

  // Static fallback — returned on SSR, during hydration, and until the
  // fetch resolves successfully. Guarantees identical markup on both
  // render passes.
  if (!mounted || latestBlogs === null) {
    return {
      type: 'menu',
      text: 'Blog',
      url: '/guides',
      items: staticBlogItems,
    };
  }

  const blogItems: any[] = [];

  // Add dynamic blog posts
  if (latestBlogs.length > 0) {
    latestBlogs.forEach((post) => {
      blogItems.push({
        icon: <FileText />,
        text: post.title,
        description: post.description.length > 100 
          ? post.description.substring(0, 100) + '...' 
          : post.description,
        url: post.url,
      } as any);
    });
  }

  // Add "Browse All" link
  blogItems.push({
    icon: <ArrowUpRight />,
    text: 'Browse All Posts',
    description:
      'Explore our complete collection of articles, guides, and community content.',
    url: '/guides',
  } as any);

  return {
    type: 'menu',
    text: 'Blog',
    url: '/guides',
    items: blogItems,
  };
}

