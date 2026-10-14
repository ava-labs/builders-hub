'use client';

import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { CircleIcon } from 'lucide-react';
import { Label } from '@radix-ui/react-label';
import { cn } from '../lib/utils';
import { ReactNode } from 'react';

type RadioItem = {
  value: string;
  label: string;
  details?: string | ReactNode;
  isDisabled?: boolean;
};

type RadioGroupProps = {
  items: RadioItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  idPrefix?: string;
};

function RadioGroup({ items, value, onChange, className, idPrefix = '' }: RadioGroupProps) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn('grid gap-3', className)}
      value={value}
      onValueChange={onChange}
    >
      {items.map((item) => (
        <div key={item.value} className="flex items-start space-x-2">
          <RadioGroupPrimitive.Item
            value={item.value}
            id={`${idPrefix}${item.value}`}
            disabled={item.isDisabled}
            className={cn(
              'mt-0.5 aspect-square size-4 shrink-0 rounded-full border border-zinc-300 bg-white text-zinc-900 outline-none transition-colors hover:border-zinc-500 focus-visible:border-zinc-900 data-[state=checked]:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-500 dark:focus-visible:border-zinc-300 dark:data-[state=checked]:border-zinc-100',
              'aria-invalid:border-red-500 disabled:cursor-not-allowed disabled:border-dashed disabled:border-zinc-300 disabled:bg-zinc-50 disabled:opacity-60 dark:disabled:border-zinc-700 dark:disabled:bg-zinc-900',
            )}
          >
            <RadioGroupPrimitive.Indicator
              data-slot="radio-group-indicator"
              className="relative flex items-center justify-center"
            >
              <CircleIcon className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 fill-current" />
            </RadioGroupPrimitive.Indicator>
          </RadioGroupPrimitive.Item>
          <div className="flex-1">
            <Label
              htmlFor={`${idPrefix}${item.value}`}
              className={cn(
                'text-[13px] font-medium',
                item.isDisabled
                  ? 'text-zinc-400 dark:text-zinc-500'
                  : 'cursor-pointer text-zinc-900 dark:text-zinc-100',
              )}
            >
              {item.label}
            </Label>
            {item.details && <div className="mt-1 text-[12px] text-zinc-500 dark:text-zinc-400">{item.details}</div>}
          </div>
        </div>
      ))}
    </RadioGroupPrimitive.Root>
  );
}

export { RadioGroup };
