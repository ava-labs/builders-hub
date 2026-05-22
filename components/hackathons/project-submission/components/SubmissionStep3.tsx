'use client';

import React from 'react';
import MediaUploader from './MediaUploader';
import { useFormContext } from 'react-hook-form';

import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { FormLabelWithCheck } from './FormLabelWithCheck';
import { SubmissionForm } from '../hooks/useSubmissionFormSecure';
import { EventsLang, t } from '@/lib/events/i18n';

export default function SubmitStep3({ lang = "en" }: { lang?: EventsLang }) {
  const form = useFormContext<SubmissionForm>();

  return (
    <div className='space-y-8'>
      <h2 className='text-xl font-semibold text-foreground'>
        {t(lang, "submission.step3.media.title")}
      </h2>
      <p className='text-sm text-zinc-400'>
        {t(lang, "submission.step3.media.subtitle")}
      </p>

      <MediaUploader
        name='logoFile'
        label={t(lang, "submission.step3.logo.label")}
        maxItems={1}
        maxSizeMB={1}
        recommendedSize='512 x 512'
        width='max-w-[128px]'
        height='max-h-[128px]'
        buttonText={t(lang, "submission.step3.logo.button")}
        lang={lang}
      />

      <MediaUploader
        name='coverFile'
        label={t(lang, "submission.step3.cover.label")}
        maxItems={1}
        maxSizeMB={2}
        width='max-w-[200px]'
        height='max-h-[120px]'
        recommendedSize='840 x 300'
        buttonText={t(lang, "submission.step3.cover.button")}
        lang={lang}
      />

      <MediaUploader
        name='screenshots'
        label={t(lang, "submission.step3.screenshots.label")}
        maxItems={5}
        maxSizeMB={1}
        width='max-w-[128px]'
        height='max-h-[128px]'
        recommendedSize='No specific size required, but ensure clarity and readability'
        extraText={t(lang, "submission.step3.screenshots.extraText")}
        buttonText={t(lang, "submission.step3.screenshots.button")}
        lang={lang}
      />

      {/* Demo Video */}
      <section className='space-y-2'>
        <FormField
          control={form.control}
          name='demo_video_link'
          render={({ field }) => (
            <FormItem className='space-y-2'>
              <FormLabelWithCheck
                label={t(lang, "submission.step3.demoVideo.label")}
                checked={!!field.value}
              />
              <FormControl>
                <Input
                  placeholder={t(lang, "submission.step3.demoVideo.placeholder")}
                  className='dark:bg-zinc-950'
                  {...field}
                />
              </FormControl>
              <p className='text-sm text-zinc-600 dark:text-zinc-400'>
                {t(lang, "submission.step3.demoVideo.hint")}
                <br />
                {t(lang, "submission.step3.demoVideo.requirements")}
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
      </section>
    </div>
  );
}
