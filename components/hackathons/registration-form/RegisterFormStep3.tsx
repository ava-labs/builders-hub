"use client";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { useFormContext } from "react-hook-form";
import { RegisterFormValues } from "./RegistrationForm"; 
import { Checkbox } from "@/components/ui/checkbox";

export function RegisterFormStep3() {
  const form = useFormContext<RegisterFormValues>();

  return (
    <>
      {/* Step 3: Terms & Agreements */}
   
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">Step 3: Terms & Agreements</h3>
        <p className="text-zinc-400">Review and agree to the terms to complete your registration.</p>
        <div className="w-full h-px bg-zinc-300 mt-2" /> 
      </div>
      <div className="space-y-6">


        <FormField
          control={form.control}
          name="terms_event_conditions"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className="border-zinc-400 bg-white data-[state=checked]:bg-white  data-[state=checked]:text-white rounded "
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>
                  I have read and agree to the Event Participation Terms and Conditions.
                </FormLabel>
                <FormMessage className="text-zinc-400">
                  You must agree to participate in any Builders Hub events. Event Terms and Conditions.
                </FormMessage>
              </div>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="newsletter_subscription"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className="border-zinc-400 bg-white data-[state=checked]:bg-white data-[state=checked]:text-white rounded"
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>I wish to stay informed about Avalanche news and events.</FormLabel>
                <FormMessage className="text-zinc-400">
                  Subscribe to newsletters and promotional materials. You can opt out anytime. Avalanche Privacy Policy.
                </FormMessage>
              </div>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="prohibited_items"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className="border-zinc-400 bg-white data-[state=checked]:bg-white data-[state=checked]:text-white rounded"
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>I agree not to bring any of the following prohibited items.</FormLabel>
                <FormMessage className="text-zinc-400">
                  Review the list of restricted items before attending in-person events.
                </FormMessage>
              </div>
            </FormItem>
          )}
        />
      </div>
    </>
  );
}