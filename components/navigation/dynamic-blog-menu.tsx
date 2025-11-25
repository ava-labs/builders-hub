"use client";

import { useEffect, useState } from 'react';
import { type LinkItemType } from 'fumadocs-ui/layouts/docs';
import { BookOpen, FileText, ArrowUpRight } from 'lucide-react';
import Image from 'next/image';

interface BlogPost {
  title: string;
  description: string;
  url: string;
  date: string;
}

export function useDynamicBlogMenu(): LinkItemType {
  const [latestBlogs, setLatestBlogs] = useState<BlogPost[]>([]);

  useEffect(() => {
    fetch('/api/latest-blogs')
      .then(res => res.json())
      .then(data => setLatestBlogs(data))
      .catch(err => console.error('Failed to fetch latest blogs:', err));
  }, []);

  const blogItems: any[] = [];

  // Add dynamic blog posts
  if (latestBlogs.length > 0) {
    latestBlogs.forEach((post, index) => {
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

