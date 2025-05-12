"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { FormLabelWithCheck } from "./FormLabelWithCheck";
import { SubmissionForm } from "../hooks/useSubmissionForm";
import { MultiLinkInput } from './MultiLinkInput';



export default function SubmitStep2() {
  const form =  useFormContext<SubmissionForm>();
  return (
    <div className="space-y-8">
      {/* Sección: Technical Details */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">
          Technical Details
        </h2>
        <p className="text-sm text-muted-foreground">
          Explain how your project works under the hood: tech stack,
          integrations, and architecture.
        </p>

        {/* Campo: How It's Made */}
        <FormField
          control={form.control}
          name="tech_stack"
          render={({ field }) => (
            <FormItem>
              <FormLabelWithCheck
                label="How it's made"
                checked={!!field.value}
              />
              <FormControl>
                <Textarea
                  placeholder="Describe the tech stack, APIs, and integrations used."
                  className=" h-[180px] resize-none dark:bg-zinc-950"
                  {...field}
                />
              </FormControl>
              <p className="text-zinc-400 text-[14px] leading-[100%] tracking-[0%] font-aeonik">
                Mention any innovative solutions or "hacky" parts worth
                highlighting.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Campo: Repo Link */}
        <MultiLinkInput
          name="github_repository"
          label="GitHub Repository"
          placeholder="Paste GitHub link (e.g., https://github.com/user/repo)"
          validationMessage="Must be a public repository. If design-only, link a Figma file. Use space,enter or tab after each link"
        />

        {/* Campo: Demo Link */}
        <MultiLinkInput
          name="demo_link"
          label="Live Demo Link"
          placeholder="Paste Demo link (e.g., https://yoursite.com)"
          validationMessage="Provide a live demo or working prototype. Use space,enter or tab after each link"
        />
      </section>

      {/* Sección: Project Continuity & Development */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">
          Project Continuity & Development
        </h2>
        <p className="text-sm text-muted-foreground pt-0 mt-0">
          Indicate if your project builds upon a pre-existing idea and clarify
          your contributions during the hackathon.
        </p>

        {/* Toggle: isPreExisting */}
        <FormField
          control={form.control}
          name="is_preexisting_idea"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between p-4 border rounded">
              <div className="space-y-1">
                <FormLabel>
                  Is this project based on a pre-existing idea?
                </FormLabel>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-line italic">
                  If your project is built upon an existing idea, you must
                  disclose which components were developed specifically during
                  the      {"\n"}
                  hackathon.      {"\n"}
          
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-line ">
            
                   Judges may not have enough time to fully verify
                  the implementation during evaluation, but prize distribution
                  may be
                  {"\n"}
                   subject to further review.
                </p>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Campo: Explanation of what's built during hackathon */}
        <FormField
          control={form.control}
          name="explanation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Explain what was built during the hackathon</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Provide a detailed breakdown of the new features, functionalities, or improvements developed during this event."
                  className=" h-15 resize-none dark:bg-zinc-950"
                  {...field}
                />
              </FormControl>
              <p className="text-zinc-600 dark:text-zinc-400 text-sm  tracking-[0%] font-aeonik whitespace-pre-line">
                Clearly specify what was created during the hackathon.{"\n"}
                Differentiate between pre-existing work and new contributions.
                {"\n"}
                Mention any significant modifications or optimizations.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
      </section>
    </div>
  );
}
