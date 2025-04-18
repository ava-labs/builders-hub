'use client';

import { FC } from 'react';

import { FormLabel } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

interface FormLabelWithCheckProps {
  label: string;
  checked?: boolean;
}

export const FormLabelWithCheck: FC<FormLabelWithCheckProps> = ({
  label,
  checked,
}) => {
  return (
    <div className='w-full flex  px-4 py-2 rounded-md text-sm bg-zinc-100 shadow-xs dark:bg-zinc-800 '>
      <Checkbox
        checked={checked}
        tabIndex={-1}
        className={cn(
          'pointer-events-none opacity-100 border dark:border-white mr-2 rounded-md',
          'dark:data-[state=checked]:bg-white data-[state=checked]:bg-white',
          "[&_[data-slot='checkbox-indicator']_svg]:stroke-black"
        )}
      />
      <FormLabel className='m-0 p-0 cursor-default '>{label}</FormLabel>
    </div>
  );
};
