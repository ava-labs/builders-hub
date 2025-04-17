import { ChevronDown } from 'lucide-react';
import { twMerge } from "tailwind-merge";
import { clsx } from "clsx";

interface SelectProps {
    label: string;
    value: string | number;
    onChange: (value: string | number) => void;
    options: { value: string | number; label: string }[];
    notesUnderInput?: string;
    disabled?: boolean;
    className?: string;
}

export const Select = ({
    label,
    value,
    onChange,
    options,
    notesUnderInput,
    disabled,
    className,
}: SelectProps) => {
    return (
        <div className="w-full">
            {label && (
                <label className="text-sm font-medium leading-none mb-2 block">
                    {label}
                </label>
            )}
            <div className="relative">
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    className={twMerge(clsx(
                        "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 appearance-none pr-10",
                        className
                    ))}
                >
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" />
            </div>
            {notesUnderInput && (
                <p className="mt-1.5 text-xs text-muted-foreground">{notesUnderInput}</p>
            )}
        </div>
    );
};
