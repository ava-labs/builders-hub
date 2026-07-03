'use client';

import React, { memo } from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { Accordion, AccordionContent, AccordionItem } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { ChevronDown } from 'lucide-react';
import RemoveButton from '@/components/hackathons/edit/stages/RemoveButton';
import type { IPartner } from '@/app/events/edit/initials';
import { t as editTranslations } from '@/app/events/edit/translations';

const MAX_FILE_SIZE = 2 * 1024 * 1024;

function SubformFieldError({
  fieldError,
  field,
}: {
  fieldError?: (field: string) => string | null;
  field: string;
}): React.ReactNode {
  const msg = fieldError?.(field);
  if (!msg) return null;
  return <p className="text-red-500 text-sm -mt-2 mb-2">{msg}</p>;
}

export type PartnerItemProps = {
  partner: IPartner;
  index: number;
  onChange: (index: number, field: 'name' | 'logo', value: string) => void;
  onRemove: (index: number) => void;
  t: typeof editTranslations;
  language: 'en' | 'es';
  onImageFileTooLarge: () => void;
  fieldError?: (field: string) => string | null;
};

const PartnerItem = memo(function PartnerItem({
  partner,
  index,
  onChange,
  onRemove,
  t,
  language,
  onImageFileTooLarge,
  fieldError,
}: PartnerItemProps) {
  return (
    <Accordion type="single" collapsible className="w-full rounded-md border px-4 py-0.5">
      <AccordionItem value={`item-${index}`}>
        <AccordionPrimitive.Header className="flex">
          <AccordionPrimitive.Trigger className="flex flex-1 items-center justify-between gap-2 py-1 text-sm font-medium outline-none [&[data-state=open]_svg.chevron]:rotate-180">
            <h3 className="text-lg font-semibold my-1">Partner {index + 1}</h3>
            <div className="flex items-center gap-2">
              <ChevronDown className="chevron text-muted-foreground size-4 shrink-0 transition-transform duration-200" />
                <RemoveButton
                  onRemove={() => onRemove(index)}
                  tooltipLabel={t[language].removePartner}
                  confirmPrompt={t[language].confirmDeletePrompt}
                  size={18}
                  language={language}
                />
            </div>
          </AccordionPrimitive.Trigger>
        </AccordionPrimitive.Header>
        <AccordionContent>
          <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].partnersHelp}</div>

          <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].partnerName}</div>
          <Input
            type="text"
            placeholder={t[language].partnerName}
            value={partner.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(index, 'name', e.target.value)}
            className="w-full mb-3"
            required
          />
          <SubformFieldError fieldError={fieldError} field="name" />

          <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].partnerLogo}</div>
          <div className="mb-2">
            <input
              type="file"
              accept="image/*"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const file: File | undefined = e.target.files?.[0];
                if (file) {
                  if (file.size > MAX_FILE_SIZE) {
                    onImageFileTooLarge();
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    onChange(index, 'logo', event.target?.result as string);
                  };
                  reader.readAsDataURL(file);
                }
              }}
              className="w-full p-2 border border-zinc-300 dark:border-zinc-600 rounded bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200 cursor-pointer"
            />
          </div>

          <div className="mb-2">
            <Input
              type="text"
              placeholder={t[language].partnerLogoUrlPlaceholder}
              value={partner.logo}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(index, 'logo', e.target.value)}
              className="w-full"
            />
          </div>
          <SubformFieldError fieldError={fieldError} field="logo" />

          {partner.logo && partner.logo.trim() !== '' && (
            // eslint-disable-next-line @next/next/no-img-element -- intentional: avoids next/image remotePatterns and invalid src crashes in live preview
            <div className="mb-2">
              <img
                src={partner.logo}
                alt={partner.name || t[language].partnerLogo}
                className="max-h-20 max-w-[200px] object-contain rounded border border-zinc-600"
              />
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
});

export default PartnerItem;
