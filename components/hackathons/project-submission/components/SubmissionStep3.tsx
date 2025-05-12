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
import { SubmissionForm } from '../hooks/useSubmissionForm';

export default function SubmitStep3() {
  const form = useFormContext<SubmissionForm>();

  return (
    <div className='space-y-8'>
      <h2 className='text-xl font-semibold text-foreground'>
        3) Visual Identity & Media
      </h2>
      <p className='text-sm text-zinc-400'>
        Upload images and media to visually represent your project.
      </p>

      <MediaUploader
        name='logoFile'
        label='Project Logo'
        maxItems={1}
        maxSizeMB={1}
        recommendedSize='512 x 512'
        width='max-w-[128px]'
        height='max-h-[128px]'
        buttonText='Upload Logo'
      />

      <MediaUploader
        name='coverFile'
        label='Cover Image'
        maxItems={1}
        maxSizeMB={2}
        width='max-w-[200px]'
        height='max-h-[120px]'
        recommendedSize='840 x 300'
        buttonText='Upload Cover Image'
      />

      <MediaUploader
        name='screenshots'
        label='Screenshots'
        maxItems={5}
        maxSizeMB={1}
        width='max-w-[128px]'
        height='max-h-[128px]'
        recommendedSize='No specific size required, but ensure clarity and readability'
        extraText='Upload up to 5 screenshots that showcase your project.'
        buttonText='Upload Screenshots'
      />

      {/* Demo Video */}
      <section className='space-y-2'>
        <FormField
          control={form.control}
          name='demo_video_link'
          render={({ field }) => (
            <FormItem className='space-y-2'>
              <FormLabelWithCheck label='Demo Video' checked={!!field.value} />
              <FormControl>
                <Input
                  placeholder='Paste your video link (e.g., YouTube, Vimeo, or other supported platform)'
                  className='dark:bg-zinc-950'
                  {...field}
                />
              </FormControl>
              <p className='text-sm text-zinc-600 dark:text-zinc-400 '>
                Showcase your project in action with a short demo video. Ensure
                the link is accessible and not set to private. <br />
                Video requirements: <br />
                - Minimum resolution: 720p <br />
                - Ensure audio is clear, no background music <br />- Platforms
                supported: YouTube, Vimeo, Google Drive (public link)
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
      </section>
    </div>
  );
}
