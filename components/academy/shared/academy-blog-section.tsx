import Link from 'next/link';
import { ArrowRight, Clock } from 'lucide-react';
import { cn } from '@/utils/cn';

interface BlogPage {
    url: string;
    data: {
        title: string;
        description: string;
        topics?: string[];
        date?: string;
    };
    file: {
        name: string;
    };
}

interface AcademyBlogSectionProps {
    blogs: BlogPage[];
}

export function AcademyBlogSection({ blogs }: AcademyBlogSectionProps) {
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
        <div className="mb-20">
            <div className="flex items-center gap-3 mb-8">
                <h2 className="text-xl font-bold tracking-wide text-zinc-700 dark:text-zinc-300 uppercase">
                    Join The Discussion
                </h2>
                <Link
                    href="/blog"
                    className="ml-auto text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 font-medium transition-colors flex items-center gap-1"
                >
                    View all guides
                    <ArrowRight className="h-3 w-3" />
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {blogs.map((blog) => (
                    <Link
                        key={blog.url}
                        href={blog.url}
                        className="group relative flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
                    >
                        {/* Category badge */}
                        {blog.data.topics && blog.data.topics.length > 0 && (
                            <div className="mb-4 flex flex-wrap gap-2">
                                {blog.data.topics.slice(0, 2).map((topic, idx) => (
                                    <span
                                        key={idx}
                                        className={cn(
                                            "text-xs px-2 py-1 rounded-md font-medium",
                                            getTopicColor(topic)
                                        )}
                                    >
                                        {topic}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Title */}
                        <h3 className="font-semibold text-zinc-900 dark:text-white mb-2 group-hover:text-red-600 dark:group-hover:text-red-500 transition-colors line-clamp-2">
                            {blog.data.title}
                        </h3>

                        {/* Description */}
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4 line-clamp-3 flex-grow">
                            {blog.data.description}
                        </p>

                        {/* Date or metadata */}
                        <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-500">
                            <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {blog.data.date ? new Date(blog.data.date).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                }) : 'Recent'}
                            </span>
                            <span className="ml-auto group-hover:text-red-600 dark:group-hover:text-red-500 transition-colors flex items-center gap-1">
                                Read more
                                <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                            </span>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
