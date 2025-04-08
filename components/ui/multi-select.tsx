'use client';

import * as React from 'react';
import { X, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

interface Option {
  label: string;
  value: string;
}

interface MultiSelectProps {
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
}

export function MultiSelect({
  options,
  selected = [],
  onChange,
  placeholder = 'Select options',
  searchPlaceholder = 'Search framework'
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const selectedItems = React.useMemo(() => 
    options.filter((option) => (selected || []).includes(option.value)),
    [selected, options]
  );

  const handleSelect = React.useCallback((value: string) => {
    const newSelected = selected || [];
    const isSelected = newSelected.includes(value);
    
    onChange(
      isSelected
        ? newSelected.filter((item) => item !== value)
        : [...newSelected, value]
    );
  }, [selected, onChange]);

  return (
    <div className="relative" ref={containerRef}>
      <div
        className={cn(
          "relative flex min-h-[44px] w-full flex-wrap items-center justify-between gap-1 rounded-md border border-input bg-background dark:bg-input/30 dark:hover:bg-input/50 px-3 py-2 text-sm ring-offset-background cursor-pointer",
          open && "border-ring"
        )}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <div className="flex flex-wrap items-center gap-1 flex-1">
          {selectedItems.length > 0 ? (
            selectedItems.map((option) => (
              <Badge
                key={option.value}
                variant="secondary"
                className="rounded-sm px-1 font-normal"
              >
                {option.label}
                <button
                  type="button"
                  className="ml-1 rounded-sm hover:bg-secondary"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSelect(option.value);
                    }
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSelect(option.value);
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 opacity-50 transition-transform", open && "rotate-180")} />
      </div>
      {open && (
        <div className="absolute top-full z-50 w-full mt-1">
          <Command className="rounded-lg border shadow-md">
            <CommandInput placeholder={searchPlaceholder} />
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup className="max-h-[200px] overflow-auto p-1">
              {options.map((option) => {
                const isSelected = (selected || []).includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => handleSelect(option.value)}
                    className="cursor-pointer dark:focus:!bg-red-500 focus:text-foreground"
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                        isSelected
                          ? "border-background bg-background text-foreground"
                          : "border-input"
                      )}
                    >
                      {isSelected && (
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 10 10"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M9 1L3.5 7.5L1 5"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                    <span>{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </Command>
        </div>
      )}
    </div>
  );
} 