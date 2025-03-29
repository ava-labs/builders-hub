import { Check } from "lucide-react";

interface SuccessProps {
    label: string;
    value: string;
}

export const Success = ({ label, value }: SuccessProps) => {
    if (!value) return null;

    return (
        <div className="p-4 bg-white dark:bg-neutral-800 rounded-lg space-y-2 border border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center space-x-2">
                <p className="text-neutral-700 dark:text-neutral-200 font-semibold">{label}:</p>
                <Check className="h-5 w-5 text-green-500" />
            </div>
            <div className="bg-white dark:bg-neutral-800 p-3 rounded border border-neutral-200 dark:border-neutral-700">
                <p className="font-mono text-sm break-all dark:text-neutral-200">{value}</p>
            </div>
        </div>
    );
};
