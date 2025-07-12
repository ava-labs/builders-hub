import Link from 'next/link';
import type { Metadata } from 'next';
import { createMetadata } from '@/utils/metadata';
import { ArrowRight, Clock, BookOpen, ChevronDown } from 'lucide-react';
import { HeroBackground } from '@/components/landing/hero';
import { guide } from '@/lib/source';
import LearningTree from '@/components/academy/learning-tree';
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
  return (
    <>
      <HeroBackground />
      <main className="container relative">
        <Hero />
        <CourseCatalog />
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

function CourseCatalog(): React.ReactElement {
  // Get all guides
  const guides = [...guide.getPages()].sort(
    (a, b) =>
      new Date(b.data.date ?? b.file.name).getTime() -
      new Date(a.data.date ?? a.file.name).getTime(),
  ).slice(0, 9); // Limit to 9 guides

  // Topic color mapping function
  const getTopicColor = (topic: string): string => {
    const topicLower = topic.toLowerCase();
    
    // Network/Infrastructure topics
    if (topicLower.includes('network') || topicLower.includes('upgrade') || topicLower.includes('etna')) {
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
    }
    
    // Blockchain/L1/Layer topics
    if (topicLower.includes('layer') || topicLower.includes('l1') || topicLower.includes('blockchain')) {
      return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300";
    }
    
    // Development/Programming topics
    if (topicLower.includes('solidity') || topicLower.includes('foundry') || topicLower.includes('smart contract')) {
      return "bg-zinc-100 text-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-300";
    }
    
    // Validator/Staking topics
    if (topicLower.includes('validator') || topicLower.includes('staking') || topicLower.includes('stake')) {
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
    }
    
    // DeFi/Token topics
    if (topicLower.includes('token') || topicLower.includes('defi') || topicLower.includes('economics')) {
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    }
    
    // Tools/Kits topics
    if (topicLower.includes('kit') || topicLower.includes('tool') || topicLower.includes('cli')) {
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
    }
    
    // Cross-chain/Interoperability topics
    if (topicLower.includes('cross') || topicLower.includes('bridge') || topicLower.includes('interop')) {
      return "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300";
    }
    
    // Default fallback
    return "bg-zinc-100 text-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-300";
  };

  return (
    <div className="pb-12 sm:pb-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Learning Tree Section */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <div className="flex justify-center mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-zinc-50 to-zinc-100 dark:from-zinc-950/20 dark:to-zinc-950/30 border border-zinc-200 dark:border-zinc-800/30">
                <div className="flex -space-x-1">
                  <div className="w-2 h-2 rounded-full bg-zinc-500 animate-pulse" />
                  <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse delay-75" />
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse delay-150" />
                </div>
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Interactive Learning Paths
                </span>
              </div>
            </div>
            
            <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mb-8">
              Choose Your Learning Path
            </h2>
            
            {/* Visual hint */}
            <div className="flex items-center justify-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-zinc-300 dark:to-zinc-700" />
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                Start with fundamentals, progress to advanced
              </span>
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-zinc-300 dark:to-zinc-700" />
            </div>
          </div>
          
          {/* Background decoration */}
          <div className="relative">
            <div className="absolute inset-0 -top-20 bg-gradient-to-b from-transparent via-zinc-50/20 to-transparent dark:via-zinc-950/10 pointer-events-none" />
            <LearningTree />
          </div>
        </div>

        {/* Quick Start Guides - QuickLinks Style */}
        <div className="mb-20">
          <div className="flex items-center gap-3 mb-8">
            <h2 className="text-xl font-bold tracking-wide text-zinc-700 dark:text-zinc-300 uppercase">
              Quick Start Guides
            </h2>
            <Link 
              href="/guides" 
              className="ml-auto text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 font-medium transition-colors flex items-center gap-1"
            >
              View all guides
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {guides.map((guide) => (
              <Link
                key={guide.url}
                href={guide.url}
                className={cn(
                  "group block p-6 rounded-2xl transition-all duration-200",
                  "bg-white dark:bg-zinc-900/50",
                  "border border-zinc-200/80 dark:border-zinc-800/80",
                  "shadow-[0_2px_10px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.3)]",
                  "hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)]",
                  "hover:border-zinc-300/80 dark:hover:border-zinc-700/80"
                )}
              >
                <div className="h-full flex flex-col">
                  {/* Category Pills */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {guide.data.topics && guide.data.topics.length > 0 ? (
                      guide.data.topics.slice(0, 3).map((topic: string) => {
                        const colorClass = getTopicColor(topic);
                        
                        return (
                          <span
                            key={topic}
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}
                          >
                            {topic}
                          </span>
                        );
                      })
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-300">
                        Guide
                      </span>
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2 text-zinc-900 dark:text-white line-clamp-2 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors">
                      {guide.data.title}
                    </h3>
                    
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-3">
                      {guide.data.description}
                    </p>
                  </div>
                  
                  {/* Footer */}
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                      <Clock className="w-3 h-3" />
                      <span>5-10 min read</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-400 transition-colors" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}