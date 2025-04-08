"use client";

import React, { FC } from "react";
import { useFormContext } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { MultiSelectTrack, trackProp } from "./MultiSelectTrack";
import { FormLabelWithCheck } from "./FormLabelWithCheck";
import MembersComponent from './Members';
import { SubmissionForm } from "./hooks/useSubmissionForm";
import { Track as HackathonTrack } from "@/types/hackathons";
import { MultiSelect } from "@/components/ui/multi-select";



export interface projectProps {
  project_id: string;
  user_id?: string;
  hackaton_id?: string;
  onProjectCreated?: () => void;
  availableTracks: HackathonTrack[];
}

const SubmitStep1: FC<projectProps> = (project) => {
  const form = useFormContext<SubmissionForm>();

  const transformedTracks:trackProp[] = project.availableTracks.map(track => ({
    value: track.name,
    label: track.name
  }));

  return (
    <div className="flex flex-col w-full  mt-6 space-y-8">
      {/* SECCIÓN GENERAL */}
      <section className="space-y-4">
        <h3 className="font-medium  text-lg md:text-xl">
          General Section
        </h3>
        <p className="text-sm text-muted-foreground">
          Provide key details about your project that will appear in listings.
        </p>

        {/* Project Name */}
        <FormField
          control={form.control}
          name="project_name"
          render={({ field }) => (
            <FormItem>
               <FormLabelWithCheck label="Project Name" checked={!!field.value} />
              <FormControl>
                <Input
                  placeholder="Enter your project name"
                  className="text-zinc-400 w-full dark:bg-zinc-950"
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
          name="short_description"
          render={({ field }) => (
            <FormItem>
           
              <FormLabelWithCheck label="Short Description" checked={!!field.value} />
              <FormControl>
                <Textarea
                  placeholder="Write a short and engaging overview..."
                  className="text-zinc-400 w-full dark:bg-zinc-950"
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
          name="full_description"
          render={({ field }) => (
            <FormItem>
              <FormLabelWithCheck label="Full Description" checked={!!field.value} />
              <FormControl>
                <Textarea
                  placeholder="Describe your project in detail..."
                  className="text-zinc-400 h-24 w-full dark:bg-zinc-950"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Track (MultiSelect) */}
        <FormField
  control={form.control}
  name="tracks"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Tracks</FormLabel>
      <FormControl>
 
     <MultiSelect
                    options={transformedTracks}
                    selected={field.value || []}
                    onChange={field.onChange}
                    placeholder="Select tracks"
                    searchPlaceholder="Search tracks"
                  />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
      </section>

      {/* TEAM & COLLABORATION */}
      <section className="space-y-4">
        <h3 className="font-medium  text-lg md:text-xl" id="team">
          Team &amp; Collaboration
        </h3>
          <MembersComponent {...project}/>
      </section>
    </div>
  );
};

export default SubmitStep1;
