import { ChevronDown } from 'lucide-react';

interface AcademyHeroProps {
    title: string;
    accent: string;
    description: string;
}

export function AcademyHero({ title, accent, description }: AcademyHeroProps) {
    return (
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-50/50 via-transparent to-transparent dark:from-zinc-950/20 dark:via-transparent" />

            <div className="relative mx-auto max-w-7xl px-6 lg:px-8 py-16">
                <div className="mx-auto w-full lg:mx-0">
                    <div className="flex flex-col items-center text-center">
                        {/* Main heading */}
                        <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight">
                            <span className="text-zinc-900 dark:text-white">
                                {title}{" "}
                            </span>
                            <span className="text-red-600">
                                {accent}
                            </span>
                            <span className="text-zinc-900 dark:text-white">
                                {" "}Academy
                            </span>
                        </h1>

                        {/* Description */}
                        <p className="mt-6 text-lg lg:text-xl text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-3xl">
                            {description}
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
