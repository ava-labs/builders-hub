import COURSES from '@/content/courses';
import Link from 'next/link';
import type { Metadata } from 'next';
import { createMetadata } from '@/utils/metadata';
import { ArrowRight } from 'lucide-react';
import { HeroBackground } from '@/components/landing/hero';

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
  const categories = ["Foundations", "Smart Contract Development", "L1 Development", "Interoperability"];
  
  return (
    <div className="py-12 sm:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto w-full lg:mx-0">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tighter text-center">
            Explore our Courses
          </h2>
          <p className="mt-12 text-center text-lg leading-8 text-muted-foreground">
            We offer fundamental courses specifically designed for individuals who are new to the Avalanche ecosystem, and advanced courses for those who wish to master the art of configuring, modifying, or even creating entirely new Virtual Machines from scratch.
          </p>
        </div>
        
        {/* Course Categories */}
        <div className="mt-16 space-y-16">
          {categories.map((categoryName) => {
            const coursesInCategory = allCourses.filter(course => course.category === categoryName);
            if (coursesInCategory.length === 0) return null;
            
            return (
              <div key={categoryName}>
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-8 border-b border-gray-200 dark:border-gray-700 pb-4">
                  {categoryName === "Cross-Chain Communication" ? "Cross-Chain Communication (Interoperability)" : categoryName}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {coursesInCategory.map((course) => (
                    <Link
                      key={course.slug}
                      href={`/academy/${course.slug}`}
                      className="group"
                    >
                      <div className="bg-gray-100 rounded-lg overflow-hidden hover:bg-gray-200 transition-colors">
                        <img
                          src={`https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/course-banner/${pathImages[course.slug as keyof typeof pathImages]}` || `/course-banner/${course.slug}.jpg`}
                          alt=""
                          className="w-full aspect-3/2 object-cover"
                        />
                        <div className="p-6 flex flex-col justify-between min-h-32">
                          <div>
                            <h4 className="text-lg font-semibold text-gray-900 mb-2">
                              {course.name}
                            </h4>
                            <p className="text-sm text-gray-600 line-clamp-2">
                              {course.description}
                            </p>
                          </div>
                          <div className="flex justify-end mt-4">
                            <ArrowRight className="h-5 w-5 text-gray-600 group-hover:text-gray-800 transition-colors" />
                          </div>
                        </div>
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
  );
}