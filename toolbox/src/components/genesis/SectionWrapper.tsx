import { ChevronDown, ChevronUp } from "lucide-react";

type SectionWrapperProps = {
    title: string;
    description: string;
    isExpanded: boolean;
    toggleExpand: () => void;
    children: React.ReactNode;
    sectionId: string; // Added for key prop if needed
};

export const SectionWrapper = ({ title, description, isExpanded, toggleExpand, children, sectionId }: SectionWrapperProps) => {
    return (
        <div key={sectionId} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm overflow-hidden">
            <div 
                className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center cursor-pointer" 
                onClick={toggleExpand}
            >
                <div>
                    <h3 className="text-lg font-medium text-zinc-800 dark:text-white">{title}</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        {description}
                    </p>
                </div>
                <div>
                    {isExpanded ? 
                        <ChevronUp className="h-5 w-5 text-zinc-500 dark:text-zinc-400" /> : 
                        <ChevronDown className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
                    }
                </div>
            </div>
            {isExpanded && (
                <div className="p-5">
                    {children}
                </div>
            )}
        </div>
    );
}; 