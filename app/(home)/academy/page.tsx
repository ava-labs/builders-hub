import Link from 'next/link';
import type { Metadata } from 'next';
import { createMetadata } from '@/utils/metadata';
import { ArrowRight, Clock, BookOpen, ChevronDown } from 'lucide-react';
import { HeroBackground } from '@/components/landing/hero';
import { blog } from '@/lib/source';
import { AcademyContent } from './academy-content';
import { cn } from '@/utils/cn';

export const metadata: Metadata = createMetadata({
  title: 'Academy',
  description: 'Learn blockchain development with courses designed for the Avalanche ecosystem',
  openGraph: {
    url: '/academy',
    images: {
      url: '/api/og/academy',
      width: 1200,
      height: 630,
      alt: 'Avalanche Academy',
    },
  },
  twitter: {
    images: {
      url: '/api/og/academy',
      width: 1200,
      height: 630,
      alt: 'Avalanche Academy',
    },
  },
});

export default function HomePage(): React.ReactElement {
  // Get all guides server-side
  const blogPages = [...blog.getPages()].sort(
    (a, b) =>
      new Date(b.data.date ?? b.file.name).getTime() -
      new Date(a.data.date ?? a.file.name).getTime(),
  ).slice(0, 9); // Limit to 9 guides

  // Serialize blog data to pass to client component
  const blogs = blogPages.map(page => ({
    url: page.url,
    data: {
      title: page.data.title,
      description: page.data.description || '',
      topics: page.data.topics,
      date: page.data.date instanceof Date ? page.data.date.toISOString() : page.data.date,
    },
    file: {
      name: page.file.name,
    },
  }));

  return (
    <>
      <HeroBackground />
      <main className="container relative">
        <Hero />
        <AcademyContent blogs={blogs} />
      </main>
    </>
  );
}

function Hero(): React.ReactElement {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-50/50 via-transparent to-transparent dark:from-zinc-950/20 dark:via-transparent" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8 py-16">
        <div className="mx-auto w-full lg:mx-0">
          <div className="flex flex-col items-center text-center">
            {/* Badge */}
            {/* <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-zinc-100 dark:bg-zinc-900/30 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <BookOpen className="h-4 w-4" />
              <span>Interactive Learning Paths</span>
            </div> */}

            {/* Main heading */}
            <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight">
              <span className="text-zinc-900 dark:text-white">
                Avalanche{" "}
              </span>
              <span className="text-red-600">
                Academy
              </span>
            </h1>

            {/* Description */}
            <p className="mt-6 text-lg lg:text-xl text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-3xl">
              Master blockchain development with hands-on courses designed specifically for the Avalanche ecosystem.
              From fundamentals to advanced L1 development, gain the skills to build the next generation of blockchain applications.
            </p>
            {/* Visual separator - positioned at bottom */}
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-4 text-zinc-400 dark:text-zinc-600">
              <div className="h-px w-12 bg-gradient-to-r from-transparent to-zinc-300 dark:to-zinc-700" />
              <ChevronDown className="h-5 w-5 animate-bounce" />
              <div className="h-px w-12 bg-gradient-to-l from-transparent to-zinc-300 dark:to-zinc-700" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}