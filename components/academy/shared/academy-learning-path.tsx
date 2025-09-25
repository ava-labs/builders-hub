import LearningTree from '@/components/academy/learning-tree';

interface AcademyLearningPathProps {
    defaultPathType: 'avalanche' | 'entrepreneur';
}

export function AcademyLearningPath({ defaultPathType }: AcademyLearningPathProps) {
    const pathType = defaultPathType;

    return (
        <div id="learning-path-section" className="mb-20 scroll-mt-20">
            <div className="text-center mb-12">
                <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mb-8">
                    Learning Path for{" "}
                    {pathType === 'avalanche' ? (
                        "Avalanche"
                    ) : (
                        <>
                            Codebase 
                            <span className="text-red-600"> Entrepreneur </span>
                            Academy
                        </>
                    )}
                </h2>

                {/* Visual hint */}
                <div className="flex items-center justify-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
                    <div className="h-px w-16 bg-gradient-to-r from-transparent to-zinc-300 dark:to-zinc-700" />
                    <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        {pathType === 'avalanche'
                            ? 'Start with fundamentals, progress to advanced'
                            : 'Build your foundation, scale your venture'
                        }
                    </span>
                    <div className="h-px w-16 bg-gradient-to-l from-transparent to-zinc-300 dark:to-zinc-700" />
                </div>
            </div>

            {/* Background decoration */}
            <div className="relative">
                <div className="absolute inset-0 -top-20 bg-gradient-to-b from-transparent via-zinc-50/20 to-transparent dark:via-zinc-950/10 pointer-events-none" />
                <LearningTree pathType={pathType} />
            </div>
        </div>
    );
}
