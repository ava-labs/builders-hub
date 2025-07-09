import COURSES from '@/content/courses';
import Link from 'next/link';
import type { Metadata } from 'next';
import { createMetadata } from '@/utils/metadata';
import { ArrowRight } from 'lucide-react';
import { HeroBackground } from '@/components/landing/hero';
import { guide } from '@/lib/source';

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

const pathImages = {
  "avacloudapis": "avacloudapis-ThOanH9UQJiAizv9gKtgFufXxRywkQ.jpg",
  "avalanche-fundamentals": "avalanche-fundamentals-skz9GZ84gSJ7MPvkSrbiNlnK5F7suB.jpg",
  "customizing-evm": "customizing-evm-DkMcINMgCwhkuHuumtAZtrPzROU74M.jpg",
  "gogopool-minipool": "gogopool-minipool-Zzrnw390H9o7by9aytCrk1dyatEbn7.jpg",
  "hypersdk": "hypersdk-R9aLjIlYYKmtWwdcbGoS744c2YkGHc.jpg",
  "icm-chainlink": "icm-chainlink-1W7GtDwLj25WkXIsFeJpWy8K3ovrVM.jpg",
  "interchain-messaging": "interchain-messaging-gbDR0Kv4SId7FTMGoAR3Rhn0d59FMY.jpg",
  "interchain-token-transfer": "interchain-token-transfer-kXAwFbQKGwIxoCbhQ9PcjIfc1O9Hze.jpg",
  "l1-tokenomics": "l1-tokenomics-bJdsEFhaaPWKmm2R3oWyce1TBEZyNc.jpg",
  "multichain-architecture": "multi-chain-architecture-lFotxOCNkXx0jUw9EGIaxnfdyuTb9G.jpg",
  "node-course": "node-course-ACBahXfMGQEzwyh17g3vM3I2Wo3PUO.jpg",
  "safe-on-an-avalanche-chain": "safe-on-an-avalanche-chain-0hKDjVlAQcefnjaJQHnaDcT6BM7xyR.jpg",
  "solidity-foundry": "solidity-foundry-eBSonwmeJqFy2VELXTqeUHqf7YclgL.jpg",
  "teleporter-chainlink-vrf": "teleporter-chainlink-vrf-y99jE9hXaWDnOLKuTPQ4r8ALZk5HkF.jpg",
  "teleporter-token-bridge": "teleporter-token-bridge-wMmPJftYyAOSKbvay0yZy5bScQMsZH.jpg",
  "blockchain-fundamentals": "blockchain-fundamentals-skz9GZ84gSJ7MPvkSrbiNlnK5F7suB.jpg",
  "l1-validator-management": "l1-validator-management-bJdsEFhaaPWKmm2R3oWyce1TBEZyNc.jpg",
}

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
  return <></>;
}

function CourseCatalog(): React.ReactElement {
  // Get all courses and group by category
  const allCourses = COURSES.official_featured;
  
  // Get all guides
  const guides = [...guide.getPages()].sort(
    (a, b) =>
      new Date(b.data.date ?? b.file.name).getTime() -
      new Date(a.data.date ?? a.file.name).getTime(),
  );

  // Featured items
  const featuredCourses = allCourses.slice(0, 3);

  // Group courses by category
  const coursesByCategory = {
    "Fundamentals": allCourses.filter(course => course.category === "Fundamentals"),
    "Interoperability": allCourses.filter(course => course.category === "Interoperability"), 
    "Smart Contract Development": allCourses.filter(course => course.category === "Smart Contract Development"),
    "L1 Development": allCourses.filter(course => course.category === "L1 Development"),
  };
  
  return (
    <div className="py-12 sm:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto w-full lg:mx-0 mb-20">
          <div className="flex flex-col items-center text-center">
            <h2 className="text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Avalanche <span className="text-red-600">Academy</span>
            </h2>
            
            <p className="mt-8 text-lg lg:text-xl text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-2xl">
              Start your journey into blockchain development with our comprehensive courses and practical guides
            </p>
          </div>
        </div>
        
        {/* Featured Section - Hero Style */}
        <div className="mb-20" id="featured">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Large Featured Course */}
            <Link
              href={`/academy/${featuredCourses[0].slug}`}
              className="lg:col-span-8 group relative overflow-hidden rounded-2xl bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 hover:shadow-2xl transition-all duration-300"
            >
              <div className="relative p-8 lg:p-12">
                <div className="inline-flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wide mb-4">
                  <span className="h-1 w-1 bg-zinc-400 rounded-full" />
                  {featuredCourses[0].category}
                </div>
                <h4 className="text-2xl lg:text-3xl font-bold text-zinc-900 dark:text-white mb-4 group-hover:text-blue-600 dark:group-hover:text-blue-500 transition-colors">
                  {featuredCourses[0].name}
                </h4>
                <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-6 line-clamp-3 leading-relaxed">
                  {featuredCourses[0].description}
                </p>
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-500 font-medium">
                  Start Learning
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-2 transition-transform" />
                </div>
              </div>
              {pathImages[featuredCourses[0].slug as keyof typeof pathImages] && (
                <img
                  src={`https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/course-banner/${pathImages[featuredCourses[0].slug as keyof typeof pathImages]}`}
                  alt=""
                  className="absolute right-0 top-0 h-full w-1/2 object-cover opacity-10 lg:opacity-20"
                />
              )}
            </Link>

            {/* Side Featured Items */}
            <div className="lg:col-span-4 grid grid-cols-1 gap-6">
              {featuredCourses.slice(1, 3).map((course) => (
                <Link
                  key={course.slug}
                  href={`/academy/${course.slug}`}
                  className="group relative overflow-hidden rounded-xl bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 hover:shadow-xl transition-all duration-300"
                >
                  <div className="relative p-6">
                    <div className="inline-flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wide mb-3">
                      <span className="h-1 w-1 bg-zinc-400 rounded-full" />
                      {course.category}
                    </div>
                    <h4 className="text-xl font-bold text-zinc-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-500 transition-colors">
                      {course.name}
                    </h4>
                    <ArrowRight className="h-4 w-4 text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-500 transition-colors" />
                  </div>
                  {pathImages[course.slug as keyof typeof pathImages] && (
                    <img
                      src={`https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/course-banner/${pathImages[course.slug as keyof typeof pathImages]}`}
                      alt=""
                      className="absolute right-0 top-0 h-full w-2/3 object-cover opacity-10 lg:opacity-15"
                    />
                  )}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Start Guides - Horizontal Scroll */}
        <div className="mb-20">
          <div className="flex items-center justify-between mb-8">
            <div className="hidden sm:flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400 ml-auto">
              <span>Scroll for guides</span>
              <ArrowRight className="h-4 w-4" />
              <Link 
                href="/guides" 
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
              >
                View all
              </Link>
            </div>
          </div>
          
          <div className="relative -mx-6 px-6 lg:-mx-8 lg:px-8">
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
              {guides.map((guide, index) => {
                // Different gradient colors for variety
                const gradients = [
                  'from-blue-500/10 to-cyan-500/10',
                  'from-purple-500/10 to-pink-500/10',
                  'from-green-500/10 to-emerald-500/10',
                  'from-orange-500/10 to-red-500/10',
                  'from-indigo-500/10 to-blue-500/10',
                ];
                const gradient = gradients[index % gradients.length];
                
                return (
                  <Link
                    key={guide.url}
                    href={guide.url}
                    className="group flex-none w-80 snap-start"
                  >
                    <div className="relative overflow-hidden rounded-xl bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-lg transition-all duration-300 h-full flex flex-col">
                      {/* Gradient background */}
                      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-50 group-hover:opacity-70 transition-opacity`} />
                      
                      <div className="relative p-6 flex flex-col h-full">
                        <div className="flex-1">
                          {/* Time indicator */}
                          <div className="inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>5-10 min read</span>
                          </div>
                          
                          <h4 className="font-bold text-xl leading-tight text-zinc-900 dark:text-white mb-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                            {guide.data.title}
                          </h4>
                          
                          <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed mb-4">
                            {guide.data.description}
                          </p>
                          
                          {guide.data.topics && guide.data.topics.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {guide.data.topics.slice(0, 2).map(topic => (
                                <span key={topic} className="inline-flex items-center px-2 py-1 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-md">
                                  {topic}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        {/* Start Guide - Always at bottom */}
                        <div className="flex items-center justify-between pt-4 mt-4 border-t border-zinc-200 dark:border-zinc-800">
                          <span className="text-xs font-medium text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                            Start Guide
                          </span>
                          <ArrowRight className="h-4 w-4 text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            
            {/* Scroll Indicators */}
            <div className="absolute right-0 top-0 bottom-4 w-20 bg-gradient-to-l from-white dark:from-zinc-950 to-transparent pointer-events-none lg:hidden" />
            <div className="absolute left-0 top-0 bottom-4 w-20 bg-gradient-to-r from-white dark:from-zinc-950 to-transparent pointer-events-none lg:hidden" />
          </div>
        </div>

        {/* Course Categories - Bento Grid Style */}
        <div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {Object.entries(coursesByCategory).map(([categoryName, courses]) => {
              if (courses.length === 0) return null;
              
              return (
                <div key={categoryName} className="space-y-4">
                  <h4 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300 border-l-4 border-zinc-400 pl-3">
                    {categoryName}
                  </h4>
                  <div className="space-y-3">
                    {courses.map((course) => (
                      <Link
                        key={course.slug}
                        href={`/academy/${course.slug}`}
                        className="group block"
                      >
                        <div className="relative overflow-hidden rounded-lg bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 p-4 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-md transition-all duration-300">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h5 className="font-medium text-zinc-900 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-500 transition-colors">
                                {course.name}
                              </h5>
                              <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-1">
                                {course.description}
                              </p>
                            </div>
                            <ArrowRight className="h-4 w-4 text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-500 group-hover:translate-x-1 transition-all flex-shrink-0 ml-4" />
                          </div>
                          {pathImages[course.slug as keyof typeof pathImages] && (
                            <img
                              src={`https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/course-banner/${pathImages[course.slug as keyof typeof pathImages]}`}
                              alt=""
                              className="absolute right-0 top-0 h-full w-1/2 object-cover opacity-5 lg:opacity-10"
                            />
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}