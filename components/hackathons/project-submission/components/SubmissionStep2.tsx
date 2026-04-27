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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { FormLabelWithCheck } from "./FormLabelWithCheck";
import { SubmissionForm } from "../hooks/useSubmissionFormSecure";
import { MultiLinkInput } from './MultiLinkInput';
import { useProjectSubmission } from "../context/ProjectSubmissionContext";
import { EventsLang, t } from "@/lib/events/i18n";



export default function SubmitStep2({ lang = "en" }: { lang?: EventsLang }) {
  const form =  useFormContext<SubmissionForm>();
  const { state } = useProjectSubmission();
  const hasHackathon = !!state.hackathonId;
  return (
    <div className="space-y-8">
      {/* Sección: Technical Details */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">
          {t(lang, "submission.step2.technical.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t(lang, "submission.step2.technical.subtitle")}
        </p>

        {/* Campo: How It's Made */}
        <FormField
          control={form.control}
          name="tech_stack"
          render={({ field }) => (
            <FormItem>
              <FormLabelWithCheck
                label={t(lang, "submission.step2.techStack.label")}
                checked={!!field.value}
              />
              <FormControl>
                <Textarea
                  placeholder={t(lang, "submission.step2.techStack.placeholder")}
                  className=" h-[180px] resize-none dark:bg-zinc-950"
                  {...field}
                />
              </FormControl>
              <p className="text-zinc-400 text-[14px] leading-[100%] tracking-[0%] font-aeonik">
                {t(lang, "submission.step2.techStack.hint")}
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Campo: Repo Link */}
        <MultiLinkInput
          name="github_repository"
          label={t(lang, "submission.step2.github.label")}
          placeholder={t(lang, "submission.step2.github.placeholder")}
          validationMessage={t(lang, "submission.step2.github.validation")}
        />

        {/* Campo: Demo Link */}
        <MultiLinkInput
          name="demo_link"
          label={t(lang, "submission.step2.demo.label")}
          placeholder={t(lang, "submission.step2.demo.placeholder")}
          validationMessage={t(lang, "submission.step2.demo.validation")}
        />
      </section>

      {/* Sección: Project Continuity & Development - Solo visible con hackathon */}
      {hasHackathon && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">
            {t(lang, "submission.step2.continuity.title")}
          </h2>
          <p className="text-sm text-muted-foreground pt-0 mt-0">
            {t(lang, "submission.step2.continuity.subtitle")}
          </p>

          {/* Toggle: isPreExisting */}
          <FormField
            control={form.control}
            name="is_preexisting_idea"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between p-4 border rounded">
                <div className="space-y-1">
                  <FormLabel>
                    {t(lang, "submission.step2.preexisting.label")}
                  </FormLabel>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-line italic">
                    {t(lang, "submission.step2.preexisting.description1")}
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-line">
                    {t(lang, "submission.step2.preexisting.description2")}
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
                <FormLabel>{t(lang, "submission.step2.explanation.label")}</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={t(lang, "submission.step2.explanation.placeholder")}
                    className=" h-15 resize-none dark:bg-zinc-950"
                    {...field}
                  />
                </FormControl>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm tracking-[0%] font-aeonik whitespace-pre-line">
                  {t(lang, "submission.step2.explanation.hint1")}{"\n"}
                  {t(lang, "submission.step2.explanation.hint2")}{"\n"}
                  {t(lang, "submission.step2.explanation.hint3")}
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>
      )}
    </div>
  );
}
