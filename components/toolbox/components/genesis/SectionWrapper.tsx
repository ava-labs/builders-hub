import { Info, ExternalLink } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import Link from 'next/link';

type SectionWrapperProps = {
    title: string;
    description?: string;
    titleTooltip?: string;
    titleTooltipLink?: { href: string; text: string };
    children: React.ReactNode;
    sectionId: string;
    compact?: boolean;
    // Removed unused props: isExpanded, toggleExpand, variant
};

export const SectionWrapper = ({ 
    title, 
    description, 
    titleTooltip, 
    titleTooltipLink, 
    children, 
    sectionId, 
    compact 
}: SectionWrapperProps) => {
    return (
        <div key={sectionId} className="space-y-3">
            <div className="pb-2 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-baseline gap-1.5">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">{title}</h3>
                    {titleTooltip && (
                        <Tooltip>
                            <TooltipTrigger className="inline-flex">
                                <Info className="h-3.5 w-3.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                                <div className="space-y-2">
                                    <p className="text-xs">{titleTooltip}</p>
                                    {titleTooltipLink && (
                                        <Link 
                                            href={titleTooltipLink.href}
                                            className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                                        >
                                            {titleTooltipLink.text}
                                            <ExternalLink className="h-3 w-3" />
                                        </Link>
                                    )}
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    )}
                </div>
                {!compact && description && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{description}</p>
                )}
            </div>
            <div>{children}</div>
        </div>
    );
};