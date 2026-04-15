'use client';

import React, { FC, useLayoutEffect, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

import {  trackProp } from './MultiSelectTrack';
import { FormLabelWithCheck } from './FormLabelWithCheck';
import MembersComponent from './Members';
import { Track as HackathonTrack } from '@/types/hackathons';
import { MultiSelect } from '@/components/ui/multi-select';
import { SubmissionForm } from '../hooks/useSubmissionFormSecure';
import projectData from '../projectData.json';
import { EventsLang, t } from '@/lib/events/i18n';

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
  currentUserName?: string;
  openCurrentProject: boolean;
  setOpenCurrentProject: (open: boolean) => void;
  /** When set, the invite link will use this stage number (Build Games specific). */
  invite_stage?: number;
  lang?: EventsLang;
}

const SubmitStep1: FC<projectProps> = (project) => {
  const form = useFormContext<SubmissionForm>();
  const lang = project.lang ?? "en";

  const hasHackathon = !!project.hackaton_id;

  const transformedTracks: trackProp[] = project.availableTracks.map(
    (track) => ({
      value: track.name,
      label: track.name,
    })
  );

  // Transformar categorías del JSON a formato para MultiSelect
  const transformedCategories: trackProp[] = useMemo(() => {
    return projectData.categories.map((category) => ({
      value: category.name,
      label: category.name,
    }));
  }, []);

  const fullDescription = form.watch('full_description');
  const shortDescription = form.watch('short_description');
  const categories = form.watch('categories') || [];
  const hasOtherCategory = categories.includes('Other (Specify)');
  const deployedAddresses = form.watch('deployed_addresses') || [];

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
        <h3 className='font-medium  text-lg md:text-xl'>{t(lang, "submission.step1.general.title")}</h3>
        <p className='text-sm text-muted-foreground'>
          {t(lang, "submission.step1.general.subtitle")}
        </p>
        <FormField
          control={form.control}
          name='project_name'
          render={({ field }) => (
            <FormItem>
              <FormLabelWithCheck
                label={t(lang, "submission.step1.projectName.label")}
                checked={!!field.value}
              />
              <FormControl>
                <Input
                  placeholder={t(lang, "submission.step1.projectName.placeholder")}
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
                label={t(lang, "submission.step1.shortDesc.label")}
                checked={!!field.value}
              />
              <FormControl>
                <Textarea
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = '0px';
                    target.style.height = target.scrollHeight + 'px';
                  }}
                  placeholder={t(lang, "submission.step1.shortDesc.placeholder")}
                  className='w-full h-9 dark:bg-zinc-950'
                  {...field}
                />
              </FormControl>
              <FormMessage />
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
                label={t(lang, "submission.step1.fullDesc.label")}
                checked={!!field.value}
              />
              <FormControl>
                <Textarea
                  placeholder={t(lang, "submission.step1.fullDesc.placeholder")}
                  className='w-full h-9 dark:bg-zinc-950'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Tracks (solo cuando hay hackathon_id) */}
        {hasHackathon && (
          <FormField
            control={form.control}
            name='tracks'
            render={({ field }) => (
              <FormItem>
                <FormLabelWithCheck
                  label={t(lang, "submission.step1.tracks.label")}
                  checked={!!field.value && field.value.length > 0}
                />
                <FormControl>
                  <MultiSelect
                    options={transformedTracks}
                    selected={field.value || []}
                    onChange={field.onChange}
                    placeholder={t(lang, "submission.step1.tracks.placeholder")}
                    searchPlaceholder={t(lang, "submission.step1.tracks.searchPlaceholder")}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Categories (solo cuando NO hay hackathon_id) */}
        {!hasHackathon && (
          <FormField
            control={form.control}
            name='categories'
            render={({ field }) => (
              <FormItem>
                <FormLabelWithCheck
                  label={t(lang, "submission.step1.categories.label")}
                  checked={!!field.value && field.value.length > 0}
                />
                <FormControl>
                  <MultiSelect
                    options={transformedCategories}
                    selected={field.value || []}
                    onChange={(values) => {
                      field.onChange(values);
                      // Limpiar other_category si se deselecciona "Other (Specify)"
                      if (!values.includes('Other (Specify)')) {
                        form.setValue('other_category', '');
                      }
                    }}
                    placeholder={t(lang, "submission.step1.categories.placeholder")}
                    searchPlaceholder={t(lang, "submission.step1.categories.searchPlaceholder")}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Input para categoría personalizada (solo cuando se selecciona "Other (Specify)") */}
        {!hasHackathon && hasOtherCategory && (
          <FormField
            control={form.control}
            name='other_category'
            render={({ field }) => (
              <FormItem>
                <FormLabelWithCheck
                  label={t(lang, "submission.step1.otherCategory.label")}
                  checked={!!field.value}
                />
                <FormControl>
                  <Input
                    placeholder={t(lang, "submission.step1.otherCategory.placeholder")}
                    className='w-full dark:bg-zinc-950'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

          <FormField
            control={form.control}
            name='website'
            render={({ field }) => (
              <FormItem>
                <FormLabelWithCheck
                  label='Website'
                  checked={!!field.value && field.value.length > 0}
                />
                <div className='space-y-3'>
                  {(field.value && field.value.length > 0) ? (
                    <div className='space-y-3'>
                      {field.value.map((item: { key: string; value: string }, index: number) => (
                        <div key={index} className='flex gap-3 items-start'>
                          <div className='w-32'>
                            <Input
                              placeholder='Tag'
                              value={item.key || ''}
                              onChange={(e) => {
                                const newItems = [...(field.value || [])];
                                newItems[index] = { ...newItems[index], key: e.target.value };
                                field.onChange(newItems);
                              }}
                              className='w-full dark:bg-zinc-950'
                            />
                          </div>
                          <div className='flex-1'>
                            <Input
                              placeholder='https://example.com'
                              value={item.value || ''}
                              onChange={(e) => {
                                const newItems = [...(field.value || [])];
                                newItems[index] = { ...newItems[index], value: e.target.value };
                                field.onChange(newItems);
                              }}
                              className='w-full dark:bg-zinc-950'
                            />
                          </div>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon'
                            onClick={() => {
                              const newItems = field.value.filter(
                                (_: { key: string; value: string }, i: number) => i !== index
                              );
                              field.onChange(newItems);
                            }}
                            className='h-10 w-10 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950'
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <Button
                    type='button'
                    onClick={() => {
                      const newItems = [...(field.value || []), { key: '', value: '' }];
                      field.onChange(newItems);
                    }}
                    className="bg-white text-black border border-gray-300 hover:text-black hover:bg-gray-100 cursor-pointer"
                  >
                    + new website
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        
          <FormField
            control={form.control}
            name='socials'
            render={({ field }) => (
              <FormItem>
                <FormLabelWithCheck
                  label='Socials'
                  checked={!!field.value && field.value.length > 0}
                />
                <div className='space-y-3'>
                  {(field.value && field.value.length > 0) ? (
                    <div className='space-y-3'>
                      {field.value.map((item: { key: string; value: string }, index: number) => (
                        <div key={index} className='flex gap-3 items-start'>
                          <div className='w-32'>
                            <Input
                              placeholder='Tag'
                              value={item.key || ''}
                              onChange={(e) => {
                                const newItems = [...(field.value || [])];
                                newItems[index] = { ...newItems[index], key: e.target.value };
                                field.onChange(newItems);
                              }}
                              className='w-full dark:bg-zinc-950'
                            />
                          </div>
                          <div className='flex-1'>
                            <Input
                              placeholder='URL or value'
                              value={item.value || ''}
                              onChange={(e) => {
                                const newItems = [...(field.value || [])];
                                newItems[index] = { ...newItems[index], value: e.target.value };
                                field.onChange(newItems);
                              }}
                              className='w-full dark:bg-zinc-950'
                            />
                          </div>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon'
                            onClick={() => {
                              const newItems = field.value.filter(
                                (_: { key: string; value: string }, i: number) => i !== index
                              );
                              field.onChange(newItems);
                            }}
                            className='h-10 w-10 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950'
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <Button
                    type='button'
                    onClick={() => {
                      const newItems = [...(field.value || []), { key: '', value: '' }];
                      field.onChange(newItems);
                    }}
                    className="bg-white text-black border border-gray-300 hover:text-black hover:bg-gray-100 cursor-pointer"
                  >
                    + new social
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

        {/* Deployed Addresses (Only for projects without hackathon) */}
        {!hasHackathon && (
          <FormField
            control={form.control}
            name='deployed_addresses'
            render={({ field }) => (
              <FormItem>
                <FormLabelWithCheck
                  label={t(lang, "submission.step1.deployedAddresses.label")}
                  checked={!!field.value && field.value.length > 0}
                />
                <div className='space-y-3'>
                  {(field.value && field.value.length > 0) ? (
                    <div className='space-y-3'>
                      {field.value.map((addressItem: { address: string; tag?: string }, index: number) => (
                        <div key={index} className='flex gap-3 items-start'>
                          <div className='flex-1'>
                            <Input
                              placeholder='address'
                              value={addressItem.address || ''}
                              onChange={(e) => {
                                const newAddresses = [...(field.value || [])];
                                newAddresses[index] = {
                                  ...newAddresses[index],
                                  address: e.target.value,
                                };
                                field.onChange(newAddresses);
                              }}
                              className='w-full dark:bg-zinc-950'
                            />
                          </div>
                          <div className='w-32'>
                            <Input
                              placeholder='Tag'
                              value={addressItem.tag || ''}
                              onChange={(e) => {
                                const newAddresses = [...(field.value || [])];
                                newAddresses[index] = {
                                  ...newAddresses[index],
                                  tag: e.target.value,
                                };
                                field.onChange(newAddresses);
                              }}
                              className='w-full dark:bg-zinc-950'
                            />
                          </div>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon'
                            onClick={() => {
                              const newAddresses = field.value.filter(
                                (_: any, i: number) => i !== index
                              );
                              field.onChange(newAddresses);
                            }}
                            className='h-10 w-10 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950'
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <Button
                    type='button'
                    onClick={() => {
                      const newAddresses = [...(field.value || []), { address: '', tag: '' }];
                      field.onChange(newAddresses);
                    }}
               className="bg-white text-black border border-gray-300 hover:text-black hover:bg-gray-100 cursor-pointer"
                  >
                    {t(lang, "submission.step1.deployedAddresses.addButton")}
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </section>

      {/* TEAM & COLLABORATION */}
      <section className='space-y-4'>
        <h3 className='font-medium  text-lg md:text-xl' id='team'>
          {t(lang, "submission.step1.team.title")}
        </h3>
        <MembersComponent {...project} />
      </section>
    </div>
  );
};

export default SubmitStep1;
