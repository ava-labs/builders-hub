import { integration } from '@/lib/source';
import Link from 'next/link';
import { cn } from '@/utils/cn';
import { buttonVariants } from '@/components/ui/button';
import { Pill, Pills } from '@/components/ui/pills';
import type { Metadata } from 'next';
import { createMetadata } from '@/utils/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Integrations',
  description: 'Discover best-in-class integrations for your Avalanche L1',
  openGraph: {
    url: '/integrations',
    images: {
      url: '/api/og/integrations',
      width: 1200,
      height: 630,
      alt: 'Integrations with Avalanche',
    },
  },
  twitter: {
    images: {
      url: '/api/og/integrations',
      width: 1200,
      height: 630,
      alt: 'Integrations with Avalanche',
    },
  },
});

export default function Page(): React.ReactElement {
    const list = [...integration.getPages()];
    return (
        <>
            {/* Premium Background */}
            <div className="fixed inset-0 -z-10">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-[#0A0A0A] dark:via-[#0A0A0A] dark:to-[#0A0A0A]">
                    {/* Subtle grid overlay */}
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] dark:bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)]"></div>
                    
                    {/* Constellation dots */}
                    <div className="absolute inset-0">
                        <div className="absolute top-1/5 left-1/5 w-1 h-1 bg-slate-400/40 rounded-full animate-pulse dark:bg-slate-500/60"></div>
                        <div className="absolute top-1/3 right-1/4 w-1 h-1 bg-slate-400/40 rounded-full animate-pulse dark:bg-slate-500/60" style={{animationDelay: '1s'}}></div>
                        <div className="absolute bottom-1/3 left-1/3 w-1 h-1 bg-slate-400/40 rounded-full animate-pulse dark:bg-slate-500/60" style={{animationDelay: '2s'}}></div>
                        <div className="absolute bottom-1/5 right-1/3 w-1 h-1 bg-slate-400/40 rounded-full animate-pulse dark:bg-slate-500/60" style={{animationDelay: '3s'}}></div>
                    </div>
                </div>
            </div>

            <main className="py-12 sm:py-24 relative z-10">
                <div className="mx-auto max-w-7xl px-6 lg:px-8">
                    <div className="mx-auto w-full flex flex-col items-center lg:mx-0 gap-8">
                        <h1 className="text-center text-4xl font-bold md:text-5xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent dark:from-white dark:via-slate-100 dark:to-white">
                            Find an Integration
                        </h1>
                        <p className="h-fit text-center p-2 text-slate-600 dark:text-slate-300 md:max-w-[80%] md:text-xl font-light leading-relaxed">
                            Discover best-in-class integrations for your Avalanche L1 and learn how to use them.
                        </p>
                        <div className="inline-flex items-center gap-4">
                            <Link 
                                className={cn(
                                    "group relative overflow-hidden inline-flex items-center justify-center px-8 py-4 text-base font-semibold rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-105 transition-all duration-300 dark:shadow-blue-500/40 dark:hover:shadow-blue-500/60",
                                    "before:content-[''] before:absolute before:top-0 before:left-[-100%] before:w-full before:h-full before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:transition-all before:duration-500 hover:before:left-[100%]"
                                )} 
                                href={`#Featured`}
                            >
                                Discover Integrations
                            </Link>
                            <Link 
                                className={cn(
                                    "group relative overflow-hidden inline-flex items-center justify-center px-8 py-4 text-base font-semibold rounded-xl backdrop-blur-sm bg-white/10 border border-slate-200/20 text-slate-900 dark:text-white hover:bg-white/20 hover:scale-105 transition-all duration-300 dark:border-slate-700/30",
                                    "before:content-[''] before:absolute before:top-0 before:left-[-100%] before:w-full before:h-full before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:transition-all before:duration-500 hover:before:left-[100%]"
                                )} 
                                href="https://github.com/ava-labs/builders-hub/blob/master/content/integrations" 
                                target='_blank'
                            >
                                Add your Integration
                                <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                </svg>
                            </Link>
                        </div>
                    </div>
                    <Integrations list={JSON.parse(JSON.stringify(list))}></Integrations>
                </div>
            </main>
        </>
    );
}

function Integrations({ list }: { list: any[] }) {
    let integrations: { [category: string]: any[] } = {};
    
    // Filter out integrations with undefined essential properties
    const validIntegrations = list.filter((integration) => {
        // Check if integration exists and has required data
        if (!integration || !integration.data) {
            return false;
        }
        
        const { title, category, logo, description } = integration.data;
        
        // Skip README entries
        if (title === 'README') {
            return false;
        }
        
        // Check if essential properties are defined
        return title !== undefined && 
               category !== undefined && 
               logo !== undefined && 
               description !== undefined &&
               integration.url !== undefined;
    });
    
    // Build categories and integrations
    validIntegrations.forEach((integration) => {
        const { title, category, featured } = integration.data;
        if (!integrations[category]) {
            integrations[category] = [];
        }
        if (featured === true) {
            if (!integrations["Featured"]) {
                integrations["Featured"] = [];
            }
            integrations["Featured"].push(integration);
        }
        integrations[category].push(integration);
    });
    
    // Sort categories
    let categories = Object.keys(integrations);
    categories.sort((a, b) => {
        if (a === "Featured") {
            return -1;
        } else if (b === "Featured") {
            return 1;
        } else {
            return a.localeCompare(b);
        }
    });

    return (
        <div className="mt-16">
            <div className="flex flex-col md:flex-row md:space-x-12">
                <div className="w-full mb-12 md:w-1/4">
                    <div className="md:sticky md:top-24 pt-8">
                        <div className="backdrop-blur-sm bg-white/10 dark:bg-white/5 border border-slate-200/20 dark:border-white/20 shadow-sm rounded-xl p-6">
                            <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">Categories</h3>
                            <ul className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 
                                [&::-webkit-scrollbar]:w-2
                                [&::-webkit-scrollbar-track]:bg-transparent
                                [&::-webkit-scrollbar-track]:rounded-full
                                [&::-webkit-scrollbar-thumb]:bg-gradient-to-b 
                                [&::-webkit-scrollbar-thumb]:from-slate-300/60 
                                [&::-webkit-scrollbar-thumb]:to-slate-400/60
                                [&::-webkit-scrollbar-thumb]:rounded-full
                                [&::-webkit-scrollbar-thumb]:border-2
                                [&::-webkit-scrollbar-thumb]:border-transparent
                                [&::-webkit-scrollbar-thumb]:bg-clip-padding
                                [&::-webkit-scrollbar-thumb]:shadow-inner
                                hover:[&::-webkit-scrollbar-thumb]:from-slate-400/80
                                hover:[&::-webkit-scrollbar-thumb]:to-slate-500/80
                                dark:[&::-webkit-scrollbar-thumb]:from-white/20
                                dark:[&::-webkit-scrollbar-thumb]:to-white/30
                                dark:hover:[&::-webkit-scrollbar-thumb]:from-white/30
                                dark:hover:[&::-webkit-scrollbar-thumb]:to-white/40
                                [&::-webkit-scrollbar-thumb]:transition-all
                                [&::-webkit-scrollbar-thumb]:duration-300">
                            {/* Render the categories on sidelist */}
                            {categories.map((category) => (
                                <li key={category} className='w-full'>
                                    <a 
                                        href={`#${category}`} 
                                        className="group block w-full text-sm leading-6 py-3 px-4 hover:bg-slate-100/50 dark:hover:bg-white/5 transition-all duration-300 flex items-center justify-between cursor-pointer rounded-lg"
                                    >
                                        <span className="font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors duration-300">
                                            {category}
                                        </span>
                                        <div className='flex text-xs bg-slate-100 dark:bg-white/10 px-2 py-1 rounded-full text-slate-600 dark:text-slate-300 group-hover:bg-slate-200 dark:group-hover:bg-white/20 transition-colors duration-300'>
                                            {integrations[category].length}
                                        </div>
                                    </a>
                                </li>
                            ))}
                            </ul>
                        </div>
                    </div>
                </div>
                <div className="w-full md:w-3/4">
                    {/* Render the integrations for each category */}
                    {categories.map(category => (
                        <div key={category} className="mb-16">
                            <section id={category}>
                                <Link href={`#${category}`} className="group cursor-pointer">
                                    <h2 className="text-3xl font-bold mb-8 pt-16 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent dark:from-white dark:to-slate-300 group-hover:from-blue-600 group-hover:to-blue-500 dark:group-hover:from-blue-400 dark:group-hover:to-blue-300 transition-all duration-300">
                                        {category}
                                    </h2>
                                </Link>
                            </section>
                                                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mx-auto w-full">
                                {integrations[category].map((integration) => (
                                    <Link
                                        key={integration.url}
                                        href={integration.url}
                                        className="group relative flex flex-col min-h-[280px] bg-white dark:bg-zinc-900/50 rounded-2xl transition-all duration-200 border border-zinc-200/80 dark:border-zinc-800/80 shadow-[0_2px_10px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.3)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)] hover:border-zinc-300/80 dark:hover:border-zinc-700/80"
                                    >
                                        {/* Content Container */}
                                        <div className="relative z-10 p-6 flex flex-col h-full gap-4">
                                            {/* Header with Logo and Title */}
                                            <div className="flex items-center gap-4">
                                                <div className="shrink-0">
                                                    <img
                                                        src={integration.data.logo}
                                                        alt={integration.data.title}
                                                        className="w-12 h-12 object-contain rounded-lg"
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300 leading-tight">
                                                        {integration.data.title}
                                                    </h3>
                                                </div>
                                            </div>

                                            {/* Description */}
                                            <p className="text-sm text-slate-600 dark:text-slate-300 flex-grow leading-relaxed">
                                                {integration.data.description}
                                            </p>

                                            {/* Bottom Section with Tags */}
                                            <div className="flex flex-col gap-4 mt-auto">
                                                {/* Featured/Category Badge */}
                                                <div className="flex flex-wrap gap-2">
                                                    {category !== "Featured" && integration.data.featured && (
                                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-red-100 to-orange-100 dark:bg-gradient-to-r dark:from-red-500/30 dark:to-orange-500/30 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-400/40 shadow-sm dark:shadow-red-500/20">
                                                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                            </svg>
                                                            Featured
                                                        </span>
                                                    )}

                                                    {category === "Featured" && integration.data.featured && (
                                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-blue-100 to-indigo-100 dark:bg-gradient-to-r dark:from-blue-500/30 dark:to-indigo-500/30 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-400/40 shadow-sm dark:shadow-blue-500/20">
                                                            {integration.data.category}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Available For Tags */}
                                                {integration.data.available && integration.data.available.length > 0 && (
                                                    <div className="flex flex-col gap-2">
                                                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Available For</p>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {integration.data.available.map((item: string, index: number) => (
                                                                <span 
                                                                    key={index}
                                                                    className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/20"
                                                                >
                                                                    {item}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>


                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}