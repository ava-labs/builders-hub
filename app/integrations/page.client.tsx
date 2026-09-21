'use client';

import Link from 'next/link';
import { useState, useMemo, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

interface IntegrationsClientProps {
    list: any[];
}

export default function IntegrationsClient({ list }: IntegrationsClientProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [mounted, setMounted] = useState(false);
    const isMobile = useIsMobile();
    
    useEffect(() => {
        setMounted(true);
    }, []);
    
    // Filter out integrations with undefined essential properties
    const validIntegrations = useMemo(() => list.filter((integration) => {
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
    }), [list]);
    
    // Distinct categories across the valid entries, for the header line
    const categoryCount = useMemo(
        () => new Set(validIntegrations.map((integration) => integration.data.category)).size,
        [validIntegrations]
    );
    
    // Filter integrations based on search query
    const filteredIntegrations = useMemo(() => {
        if (!searchQuery.trim()) {
            return validIntegrations;
        }
        
        const query = searchQuery.toLowerCase();
        return validIntegrations.filter((integration) => {
            const title = typeof integration.data.title === 'string' ? integration.data.title.toLowerCase() : '';
            const description = typeof integration.data.description === 'string' ? integration.data.description.toLowerCase() : '';
            const category = typeof integration.data.category === 'string' ? integration.data.category.toLowerCase() : '';
            const available = Array.isArray(integration.data.available) 
                ? integration.data.available.map((a: any) => typeof a === 'string' ? a.toLowerCase() : '').join(' ')
                : '';
            
            return title.includes(query) || 
                   description.includes(query) || 
                   category.includes(query) ||
                   available.includes(query);
        });
    }, [validIntegrations, searchQuery]);
    
    let integrations: { [category: string]: any[] } = {};
    
    // Build categories and integrations
    filteredIntegrations.forEach((integration) => {
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
    
    // Sort integrations within each category by title for consistency
    Object.keys(integrations).forEach(category => {
        integrations[category].sort((a, b) => {
            const titleA = a.data?.title?.toLowerCase() || '';
            const titleB = b.data?.title?.toLowerCase() || '';
            return titleA.localeCompare(titleB);
        });
    });
    
    // Sort categories consistently
    let categories = Object.keys(integrations).sort((a, b) => {
        if (a === "Featured") {
            return -1;
        } else if (b === "Featured") {
            return 1;
        } else {
            return a.localeCompare(b);
        }
    });

    return (
        <>
            {/* Premium Background */}
            <div className="fixed inset-0 -z-10">
                <div className="absolute inset-0 bg-white dark:bg-zinc-950">
                    {/* Subtle grid overlay */}
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] dark:bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)]"></div>
                </div>
            </div>

            <main className="py-12 relative z-10 integrations-page">
                <div className="mx-auto max-w-[1920px] px-6 lg:px-8">
                    <div className="space-y-8">
                        {/* Header */}
                        <div className="max-w-5xl mx-auto">
                            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                                Ecosystem · {validIntegrations.length} integrations · {categoryCount} categories
                            </p>
                            <h1 className="v2-display mt-4 text-5xl text-zinc-950 dark:text-zinc-50 sm:text-6xl">
                                Every tool, listed<span className="text-brand">.</span>
                            </h1>
                            <p className="mt-4 max-w-2xl text-lg text-zinc-600 dark:text-[#A2AFB2]">
                                Wallets, data, custody, audits and infrastructure that already run on Avalanche. Filter by what your chain needs.
                            </p>
                        </div>

                        {/* Search Bar and Add Integration Button */}
                        <div className="max-w-5xl mx-auto">
                            <div className="flex flex-col lg:flex-row gap-4 items-start">
                                {/* Search Bar */}
                                <div className="relative flex-1">
                                    <div className="relative">
                                        <svg 
                                            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 dark:text-zinc-500 pointer-events-none" 
                                            fill="none" 
                                            stroke="currentColor" 
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                        <input
                                            type="text"
                                            placeholder={isMobile ? "Search integrations" : "Search integrations by name, category, or description..."}
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-12 pr-12 py-4 text-base rounded-none bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100 focus:ring-0 transition-all duration-200"
                                        />
                                        {searchQuery && (
                                            <button
                                                onClick={() => setSearchQuery('')}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-none hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors duration-200 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                                                aria-label="Clear search"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                            {mounted && searchQuery && (
                                <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400 lg:text-left text-center" suppressHydrationWarning>
                                    Found {filteredIntegrations.length} integration{filteredIntegrations.length !== 1 ? 's' : ''}
                                </p>
                            )}
                                </div>
                                
                                {/* Add Integration Button */}
                                <Link 
                                    href="https://github.com/ava-labs/builders-hub/blob/master/content/integrations" 
                                    target='_blank'
                                    className="group relative overflow-hidden flex items-center justify-center gap-2 px-6 py-4 text-sm font-semibold rounded-none bg-brand text-white hover:bg-brand-deep transition-colors duration-200 lg:w-auto whitespace-nowrap"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add your integration
                                    <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </Link>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-6 lg:gap-10">
                            <aside className="w-full md:w-64 lg:w-72 shrink-0 order-first">
                                <div className="md:sticky md:top-24">
                                    <div className="border border-zinc-200 dark:border-white/10 bg-white/80 dark:bg-zinc-950/80 rounded-none p-5">
                                        <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400 mb-4">Categories</h3>
                                        <ul className="space-y-1.5 max-h-[70vh] overflow-y-auto pr-2 
                                            [&::-webkit-scrollbar]:w-2
                                            [&::-webkit-scrollbar-track]:bg-transparent
                                            [&::-webkit-scrollbar-track]:rounded-full
                                            [&::-webkit-scrollbar-thumb]:bg-gradient-to-b 
                                            [&::-webkit-scrollbar-thumb]:from-zinc-300/60 
                                            [&::-webkit-scrollbar-thumb]:to-zinc-400/60
                                            [&::-webkit-scrollbar-thumb]:rounded-full
                                            [&::-webkit-scrollbar-thumb]:border-2
                                            [&::-webkit-scrollbar-thumb]:border-transparent
                                            [&::-webkit-scrollbar-thumb]:bg-clip-padding
                                            [&::-webkit-scrollbar-thumb]:shadow-inner
                                            hover:[&::-webkit-scrollbar-thumb]:from-zinc-400/80
                                            hover:[&::-webkit-scrollbar-thumb]:to-zinc-500/80
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
                                                    className="group block w-full text-sm py-3 px-3 hover:bg-zinc-100 dark:hover:bg-white/5 transition-all duration-200 flex items-center justify-between cursor-pointer rounded-none"
                                                >
                                                    <span className="font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors duration-200 truncate">
                                                        {category}
                                                    </span>
                                                    <div className='flex font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400 px-0 py-1 ml-2 shrink-0' suppressHydrationWarning>
                                                        {integrations[category].length}
                                                    </div>
                                                </a>
                                            </li>
                                        ))}
                                        </ul>
                                    </div>
                                </div>
                            </aside>
                            <div className="flex-1 min-w-0 overflow-hidden">
                                {/* No results message */}
                                {categories.length === 0 && searchQuery && (
                                    <div className="flex flex-col items-center justify-center py-16 px-4">
                                        <svg className="w-16 h-16 text-zinc-300 dark:text-zinc-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <h3 className="text-xl font-semibold text-zinc-700 dark:text-zinc-300 mb-2">No integrations found</h3>
                                        <p className="text-zinc-500 dark:text-zinc-400 text-center max-w-md">
                                            We couldn't find any integrations matching "{searchQuery}". Try a different search term.
                                        </p>
                                        <button
                                            onClick={() => setSearchQuery('')}
                                            className="mt-6 px-6 py-2.5 bg-brand hover:bg-brand-deep text-white font-medium rounded-none transition-colors duration-200"
                                        >
                                            Clear search
                                        </button>
                                    </div>
                                )}
                                
                                {/* Render the integrations for each category */}
                                {categories.map(category => (
                                    <div key={category} className="mb-16">
                                        <section id={category}>
                                            <Link href={`#${category}`}>
                                                <h2 className="v2-display text-2xl text-zinc-900 dark:text-zinc-50 mb-8 md:pt-0 md:text-3xl">
                                                    {category}<span className="text-brand">.</span>
                                                </h2>
                                            </Link>
                                        </section>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full">
                                            {integrations[category].map((integration) => (
                                                <Link
                                                    key={integration.url}
                                                    href={integration.url}
                                                    className="group relative flex flex-col min-h-[240px] bg-white dark:bg-zinc-900/50 rounded-none transition-all duration-200 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-900 dark:hover:border-zinc-100"
                                                >
                                                    {/* Content Container */}
                                                    <div className="relative z-10 p-4 flex flex-col h-full gap-3">
                                                        {/* Header with Logo and Title */}
                                                        <div className="flex items-center gap-3">
                                                            <div className="shrink-0">
                                                                <img
                                                                    src={integration.data.logo}
                                                                    alt={integration.data.title}
                                                                    className="w-10 h-10 object-contain rounded-none"
                                                                />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 leading-tight">
                                                                    {integration.data.title}
                                                                </h3>
                                                            </div>
                                                        </div>

                                                        {/* Description */}
                                                        <p className="text-sm text-zinc-600 dark:text-zinc-300 flex-grow leading-relaxed">
                                                            {integration.data.description}
                                                        </p>

                                                        {/* Bottom Section with Tags */}
                                                        <div className="flex flex-col gap-4 mt-auto">
                                                            {/* Featured/Category Badge */}
                                                            <div className="flex flex-wrap gap-2">
                                                                {category !== "Featured" && integration.data.featured && (
                                                                    <span className="inline-flex items-center px-2 py-1 font-mono text-[10px] uppercase border border-zinc-300 dark:border-zinc-700 text-brand dark:text-brand-soft">
                                                                        Featured
                                                                    </span>
                                                                )}

                                                {mounted && category === "Featured" && integration.data.featured && (
                                                    <span className="inline-flex items-center px-2 py-1 font-mono text-[10px] uppercase border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300">
                                                        {integration.data.category}
                                                    </span>
                                                )}
                                                            </div>

                                                            {/* Available For Tags */}
                                                            {integration.data.available && integration.data.available.length > 0 && (
                                                                <div className="flex flex-col gap-2">
                                                                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Available For</p>
                                                                    <div className="flex flex-wrap gap-1.5">
                                                                        {integration.data.available.map((item: string, index: number) => (
                                                                            <span 
                                                                                key={index}
                                                                                className="inline-flex items-center px-2.5 py-1 rounded-none font-mono text-[10px] uppercase tracking-[0.08em] bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-300"
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
                </div>
            </main>
        </>
    );
}

