'use client';

import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';

import { cn } from '../lib/utils';

interface CheckboxProps extends Omit<
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
  'onChange' | 'onCheckedChange'
> {
  label?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<React.ElementRef<typeof CheckboxPrimitive.Root>, CheckboxProps>(
  ({ className, label, onChange, id: providedId, ...props }, ref) => {
    const internalId = React.useId();
    const id = providedId || internalId;

    return (
      <div className={cn('flex items-center mb-4', className)}>
        <CheckboxPrimitive.Root
          ref={ref}
          id={id}
          className={cn(
            'peer h-4 w-4 shrink-0 rounded-none border border-zinc-300 bg-white transition-colors hover:border-zinc-500 focus-visible:border-zinc-900 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-zinc-900 data-[state=checked]:bg-zinc-900 data-[state=checked]:text-white dark:border-zinc-700 dark:bg-zinc-950 dark:hover:border-zinc-500 dark:focus-visible:border-zinc-300 dark:data-[state=checked]:border-zinc-100 dark:data-[state=checked]:bg-zinc-100 dark:data-[state=checked]:text-zinc-900',
          )}
          onCheckedChange={(checked) => {
            // Radix sends boolean | 'indeterminate'. We simplify to boolean.
            if (onChange) {
              onChange(checked === true);
            }
          }}
          {...props}
        >
          <CheckboxPrimitive.Indicator className={cn('flex items-center justify-center text-current')}>
            <Check className="h-3 w-3" strokeWidth={3} />
          </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
        {label && (
          <label
            htmlFor={id}
            className="ml-2 text-[13px] font-medium leading-none text-zinc-900 peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-zinc-100"
          >
            {label}
          </label>
        )}
      </div>
    );
  },
);
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
