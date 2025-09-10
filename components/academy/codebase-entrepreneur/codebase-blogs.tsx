import { ArrowRight, BookOpen, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface CodebaseBlog {
    id: string;
    title: string;
    description: string;
    date?: string;
    link: string;
}

interface CodebaseBlogsProps {
    title: string;
    blogs: CodebaseBlog[];
}

export function CodebaseBlogs({ title, blogs }: CodebaseBlogsProps) {
    return (
        <div className="mb-16">
            <div className="flex items-center gap-3 mb-8">
                <BookOpen className="h-6 w-6 text-red-600" />
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
                    {title}
                </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {blogs.map((blog) => (
                    <Link
                        key={blog.id}
                        href={blog.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 hover:shadow-lg transition-all duration-200 cursor-pointer"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <h3 className="font-semibold text-lg text-zinc-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-500 transition-colors pr-4">
                                {blog.title}
                            </h3>
                            <ExternalLink className="h-5 w-5 text-zinc-400 group-hover:text-red-600 transition-colors flex-shrink-0" />
                        </div>

                        {blog.date && (
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
                                {blog.date}
                            </p>
                        )}

                        <p className="text-sm text-zinc-600 dark:text-zinc-400 flex-grow">
                            {blog.description}
                        </p>

                        <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-red-600 group-hover:text-red-700 dark:text-red-500 dark:hover:text-red-400">
                            Read article
                            <ArrowRight className="h-4 w-4" />
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
