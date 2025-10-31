'use client';

import React, { FC, useLayoutEffect } from 'react';
import { useFormContext } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

import { MultiSelectTrack, trackProp } from './MultiSelectTrack';
import { FormLabelWithCheck } from './FormLabelWithCheck';
import MembersComponent from './Members';
import { SubmissionForm } from '../hooks/useSubmissionForm';
import { Track as HackathonTrack } from '@/types/hackathons';
import { MultiSelect } from '@/components/ui/multi-select';

export interface projectProps {
  project_id: string;
  user_id?: string;
  hackaton_id?: string;
  onProjectCreated?: () => void;
  onHandleSave?: () => Promise<void>;
  availableTracks: HackathonTrack[];
  
  openjoinTeamDialog?: boolean;
  onOpenChange: (open: boolean) => void;
  teamName?: string;
  currentEmail?: string;
  openCurrentProject: boolean;
  setOpenCurrentProject: (open: boolean) => void;
}

const SubmitStep1: FC<projectProps> = (project) => {
  const form = useFormContext<SubmissionForm>();

  const transformedTracks: trackProp[] = project.availableTracks.map(
    (track) => ({
      value: track.name,
      label: track.name,
    })
  );

  const fullDescription = form.watch('full_description');
  const shortDescription = form.watch('short_description');
  const tracks = form.watch('tracks');

  useLayoutEffect(() => {
    const textareas = ['full_description', 'short_description'];
    
    textareas.forEach(name => {
      const el = document.querySelector(`textarea[name="${name}"]`);
      if (el) {
        (el as HTMLTextAreaElement).style.height = '0px';
        (el as HTMLTextAreaElement).style.height =
          (el as HTMLTextAreaElement).scrollHeight + 'px';
      }
    });
  }, [fullDescription, shortDescription]);

  return (
    <div className='flex flex-col w-full  mt-6 space-y-8'>
      <section className='space-y-4'>
        <h3 className='font-medium  text-lg md:text-xl'>General Section</h3>
        <p className='text-sm text-muted-foreground'>
          Provide key details about your project that will appear in listings.
        </p>
        <FormField
          control={form.control}
          name='project_name'
          render={({ field }) => (
            <FormItem>
              <FormLabelWithCheck
                label='Project Name*'
                checked={!!field.value}
              />
              <FormControl>
                <Input
                  placeholder='Enter your project name'
                  className='w-full dark:bg-zinc-950'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Short Description */}
        <FormField
          control={form.control}
          name='short_description'
          render={({ field }) => (
            <FormItem>
              <FormLabelWithCheck
                label='Short Description*'
                checked={!!field.value}
              />
              <FormControl>
                <div className='relative'>
                  <Textarea
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      if (target.value.length > 280) {
                        target.value = target.value.slice(0, 280);
                      }
                      target.style.height = '0px';
                      target.style.height = target.scrollHeight + 'px';
                      field.onChange(target.value);
                    }}
                    placeholder='Write a short and engaging overview...'
                    className='w-full h-9 dark:bg-zinc-950 pr-16'
                    {...field}
                  />
                  <span className={`absolute bottom-2 right-2 text-xs pointer-events-none ${
                    shortDescription.length < 30 
                      ? 'text-red-500' 
                      : shortDescription.length <= 280 
                      ? 'text-green-500' 
                      : 'text-red-500'
                  }`}>
                    {shortDescription.length}/280
                  </span>
                </div>
              </FormControl>
              <div>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        {/* Full Description */}
        <FormField
          control={form.control}
          name='full_description'
          render={({ field }) => (
            <FormItem>
              <FormLabelWithCheck
                label='Full Description*'
                checked={!!field.value}
              />
              <FormControl>
                <div className='relative'>
                  <Textarea
                    placeholder='Describe your project in detail...'
                    className='w-full h-9 dark:bg-zinc-950 pr-28'
                    {...field}
                  />
                  <span className={`absolute bottom-2 right-2 text-xs pointer-events-none ${
                    fullDescription.length < 30 
                      ? 'text-red-500' 
                      : 'text-green-500'
                  }`}>
                    {fullDescription.length}/30
                  </span>
                </div>
              </FormControl>
              <div>
                <FormMessage />
              </div>
              {fullDescription.length < 30 && fullDescription.length > 0 && (
                <p className='text-xs text-amber-600 dark:text-amber-400'>
                  Add {30 - fullDescription.length} more character{30 - fullDescription.length !== 1 ? 's' : ''} (minimum 30 required)
                </p>
              )}
            </FormItem>
          )}
        />

        {/* Track (MultiSelect) */}
        <FormField
          control={form.control}
          name='tracks'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tracks*</FormLabel>
              <FormControl>
                <div className='space-y-2'>
                  <MultiSelect
                    options={transformedTracks}
                    selected={field.value || []}
                    onChange={field.onChange}
                    placeholder='Select tracks'
                    searchPlaceholder='Search tracks'
                  />
                  <div className='flex justify-end'>
                    <span className={`text-xs ${
                      tracks && tracks.length > 0
                        ? 'text-green-500'
                        : 'text-red-500'
                    }`}>
                      {tracks && tracks.length > 0 ? `${tracks.length} track${tracks.length !== 1 ? 's' : ''} selected` : 'Select at least one'}
                    </span>
                  </div>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </section>

      {/* TEAM & COLLABORATION */}
      <section className='space-y-4'>
        <h3 className='font-medium  text-lg md:text-xl' id='team'>
          Team &amp; Collaboration
        </h3>
        <MembersComponent {...project} />
      </section>
    </div>
  );
};

export default SubmitStep1;
