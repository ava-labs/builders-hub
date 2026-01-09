"use client";

import { useEffect, useState } from 'react';
import { type LinkItemType } from 'fumadocs-ui/layouts/docs';
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

  useEffect(() => {
    fetch('/api/latest-blogs')
      .then(res => res.json())
      .then(data => setLatestBlogs(data))
      .catch(err => console.error('Failed to fetch latest blogs:', err));
  }, []);

  // Use static items until data is loaded to prevent hydration mismatch
  if (latestBlogs === null) {
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

