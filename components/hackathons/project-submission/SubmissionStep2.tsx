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

export default function SubmitStep2() {
  const form = useFormContext(); // Asume que el padre provee <FormProvider>
  return (
    <div className="space-y-8">
      {/* Sección: Technical Details */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Technical Details</h2>
        <p className="text-sm text-muted-foreground">
          Explain how your project works under the hood: tech stack, integrations, and architecture.
        </p>

        {/* Campo: How It's Made */}
        <FormField
          control={form.control}
          name="howItIsMade"
          render={({ field }) => (
            <FormItem>
              <FormLabel>How it's made</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe the core architecture, main components, or any 'hacky' parts worth highlighting."
                  className="bg-[#2c2c2c] text-white"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Campo: Tech Stack */}
        <FormField
          control={form.control}
          name="techStack"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tech Stack / APIs / Integrations</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="List out any frameworks, libraries, or services you used."
                  className="bg-[#2c2c2c] text-white"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Campo: Repo Link */}
        <FormField
          control={form.control}
          name="repoLink"
          render={({ field }) => (
            <FormItem>
              <FormLabel>GitHub Repository</FormLabel>
              <FormControl>
                <Input
                  placeholder="Paste GitHub link (e.g., https://github.com/user/repo)"
                  className="bg-[#2c2c2c] text-white"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Campo: Demo Link */}
        <FormField
          control={form.control}
          name="demoLink"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Demo Link</FormLabel>
              <FormControl>
                <Input
                  placeholder="Paste Demo link (e.g., https://yoursite.com)"
                  className="bg-[#2c2c2c] text-white"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </section>

      {/* Sección: Project Continuity & Development */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Project Continuity & Development</h2>
        <p className="text-sm text-muted-foreground">
          Indicate if your project builds upon a pre-existing idea and clarify your contributions
          during the hackathon.
        </p>

        {/* Toggle: isPreExisting */}
        <FormField
          control={form.control}
          name="isPreExisting"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between p-4 bg-[#2c2c2c] rounded">
              <div className="space-y-1">
                <FormLabel className="text-white">Is this project based on a pre-existing idea?</FormLabel>
                <p className="text-sm text-gray-400">
                  If yes, describe how you extended or changed it.
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

        {/* Toggle: isOpenSource (ejemplo) */}
        <FormField
          control={form.control}
          name="isOpenSource"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between p-4 bg-[#2c2c2c] rounded">
              <div className="space-y-1">
                <FormLabel className="text-white">Is this project open source?</FormLabel>
                <p className="text-sm text-gray-400">
                  Make code publicly available under an open source license.
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
          name="hackathonExplanation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Explain what was built during the hackathon</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Provide a detailed breakdown of new features, improvements, or modifications..."
                  className="bg-[#2c2c2c] text-white h-24"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </section>
    </div>
  );
}
