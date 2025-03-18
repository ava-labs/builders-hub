import Link from 'next/link';
import { guide } from '@/lib/source';
import { buttonVariants } from '@/components/ui/button';
import { Twitter } from 'lucide-react';

export default function Page(): React.ReactElement {
    const guides = [...guide.getPages()].sort(
        (a, b) =>
            new Date(b.data.date ?? b.file.name).getTime() -
            new Date(a.data.date ?? a.file.name).getTime(),
    );

    return (
        <main className="py-12 sm:py-24">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
                <div className="mx-auto w-full lg:mx-0">
                    <h2 className="text-center text-5xl font-bold tracking-tight sm:text-10xl">Guides</h2>
                    <p className="m-12 text-center text-lg leading-8 text-muted-foreground">
                        Check out our end-to-end guides on how to build on Avalanche.
                    </p>
                    <p className="m-12 text-center ">
                        <Link
                            href="https://github.com/ava-labs/avalanche-academy/tree/dev/content/guides"
                            target='_blank'
                            className={buttonVariants({ size: 'lg', variant: 'default' })}
                        >
                            Add a Guide
                        </Link>
                    </p>
                </div>
                <div className="flex flex-col gap-5">
                    {guides.map((guide) => (
                        <Link
                            key={guide.url}
                            href={guide.url}
                            className="flex flex-col gap-2 bg-card p-4 rounded-lg transition-shadow shadow-sm hover:shadow-lg dark:bg-card-dark dark:border dark:border-slate-500"
                        >
                            <p className="text-xs text-muted-foreground">
                                {new Date(guide.data.date ?? guide.file.name).toDateString()}
                            </p>

                            <h3 className="text-xl">{guide.data.title}</h3>

                            <p className="text-sm text-muted-foreground">
                                {guide.data.description}
                            </p>

                            

                            <div className="flex flex-wrap items-center gap-4 text-xs">
                                {guide.data.topics.map(topic => (
                                    <span key={topic}
                                        className="relative z-10 rounded-full bg-fd-accent px-3 py-1.5 font-medium text-muted-foreground"
                                    >
                                        {topic}
                                    </span>
                                ))}
                            </div>

                            <div className="col-span-2 flex gap-2">
                                {guide.data.authors.map(author => (
                                    <div
                                        key={author}
                                        className="text-sm text-muted-foreground transition-colors flex flex-row items-center gap-2 group"
                                    >
                                        <Twitter size={12} />
                                        <span className="grow truncate">{author}</span>
                                    </div>
                                ))}
                            </div>

                        </Link>
                    ))}
                </div>
            </div>
        </main>
    );
}