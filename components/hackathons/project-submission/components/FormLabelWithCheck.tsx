'use client';

import { FC } from 'react';

import { FormLabel } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { EventsLang, t } from '@/lib/events/i18n';

interface FormLabelWithCheckProps {
  label: string;
  checked?: boolean;
  /** When true shows a red asterisk. When false/undefined shows an "Optional" badge. */
  required?: boolean;
  lang?: EventsLang;
}

export const FormLabelWithCheck: FC<FormLabelWithCheckProps> = ({
  label,
  checked,
  required,
  lang = 'en',
}) => {
  return (
    <div className='w-full flex items-center px-4 py-2 rounded-md text-sm bg-zinc-100 shadow-xs dark:bg-zinc-800'>
      <Checkbox
        checked={checked}
        tabIndex={-1}
        className={cn(
          'pointer-events-none opacity-100 border dark:border-white mr-2 rounded-md shrink-0',
          'dark:data-[state=checked]:bg-white data-[state=checked]:bg-white',
          "[&_[data-slot='checkbox-indicator']_svg]:stroke-black"
        )}
      />
      <FormLabel className='m-0 p-0 cursor-default flex-1'>{label}</FormLabel>
      {required === true ? (
        <span className='ml-2 text-red-500 font-semibold leading-none' aria-label={t(lang, 'field.required')}>*</span>
      ) : (
        <span className='ml-2 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400'>
          {t(lang, 'field.optional')}
        </span>
      )}
    </div>
  );
};
