import { ChevronDown } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';

interface SelectProps {
  label: string;
  value: string | number;
  onChange: (value: string | number) => void;
  options: { value: string | number; label: string }[];
  notesUnderInput?: string;
  disabled?: boolean;
  className?: string;
}

export const Select = ({ label, value, onChange, options, notesUnderInput, disabled, className }: SelectProps) => {
  return (
    <div className="w-full">
      {label && (
        <label className="mb-2 block font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={twMerge(
            clsx(
              'flex h-10 w-full appearance-none rounded-none border border-zinc-200 bg-white px-3 pr-10 text-[13px] text-zinc-900 transition-colors',
              'hover:border-zinc-400 focus:border-zinc-900 focus:outline-none',
              'dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-600 dark:focus:border-zinc-300',
              'disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500 disabled:hover:border-zinc-200 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-400 dark:disabled:hover:border-zinc-800',
              className,
            ),
          )}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
      </div>
      {notesUnderInput && <p className="mt-1.5 text-[12px] text-zinc-500 dark:text-zinc-400">{notesUnderInput}</p>}
    </div>
  );
};
