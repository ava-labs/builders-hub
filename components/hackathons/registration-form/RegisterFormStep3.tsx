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

interface RegisterFormStep3Props {
  isOnlineHackathon: boolean;
}

export function RegisterFormStep3({ isOnlineHackathon }: RegisterFormStep3Props) {
  const form = useFormContext<RegisterFormValues>();

  return (
    <>
      {/* Step 3: Terms & Agreements */}
   
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">Step 3: Terms & Agreements</h3>
        <p className="text-zinc-400">Review and agree to the terms to complete your registration. For information about our privacy practices and commitment to protecting your privacy, please review our <a href="https://www.avax.network/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline"> Avalanche Privacy Policy. </a></p>
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
                  className="border-zinc-400 bg-white data-[state=checked]:bg-white  data-[state=checked]:text-black rounded "
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>
                  I have read and agree to the Event Participation <a href="https://assets.website-files.com/602e8e4411398ca20cfcafd3/63fe6be7e0d14da8cbdb9984_Avalanche%20Events%20Participation%20Terms%20and%20Conditions%20(Final_28Feb2023).docx.pdf" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">Terms and Conditions.</a>
                </FormLabel>
                <FormMessage className="text-zinc-400">
                  You must agree to participate in any Builder Hub events. Event Terms and Conditions.
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
                  className="border-zinc-400 bg-white data-[state=checked]:bg-white data-[state=checked]:text-black rounded"
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>I wish to stay informed about Avalanche news and events.</FormLabel>
                <FormMessage className="text-zinc-400">
                  Subscribe to newsletters and promotional materials. You can opt out anytime.
                </FormMessage>
              </div>
            </FormItem>
          )}
        />

        {/* Only show prohibited items for in-person hackathons */}
        {!isOnlineHackathon && (
          <FormField
            control={form.control}
            name="prohibited_items"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="border-zinc-400 bg-white data-[state=checked]:bg-white data-[state=checked]:text-black rounded"
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
        )}
      </div>
    </>
  );
}