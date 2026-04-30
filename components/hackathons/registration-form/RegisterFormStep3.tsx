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
import { EventsLang, t } from "@/lib/events/i18n";

interface RegisterFormStep3Props {
  isOnlineHackathon: boolean;
  lang?: EventsLang;
}

export function RegisterFormStep3({ isOnlineHackathon, lang = "en" }: RegisterFormStep3Props) {
  const form = useFormContext<RegisterFormValues>();

  return (
    <>
      {/* Step 3: Terms & Agreements */}
   
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">{t(lang, "reg.step3.title")}</h3>
        <p className="text-zinc-400">
          {t(lang, "reg.step3.subtitle")}{" "}
          <a href="https://www.avax.network/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
            {t(lang, "reg.step3.privacyLink")}
          </a>
        </p>
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
                  {t(lang, "reg.step3.terms.label")}{" "}
                  <a href="https://assets.website-files.com/602e8e4411398ca20cfcafd3/63fe6be7e0d14da8cbdb9984_Avalanche%20Events%20Participation%20Terms%20and%20Conditions%20(Final_28Feb2023).docx.pdf" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
                    {t(lang, "reg.step3.terms.link")}
                  </a> *
                </FormLabel>
                <FormMessage className="text-zinc-400">
                  {t(lang, "reg.step3.terms.hint")}
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
                <FormLabel>{t(lang, "reg.step3.newsletter.label")}</FormLabel>
                <FormMessage className="text-zinc-400">
                  {t(lang, "reg.step3.newsletter.hint")}
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
                  <FormLabel>{t(lang, "reg.step3.prohibited.label")}</FormLabel>
                  <FormMessage className="text-zinc-400">
                    {t(lang, "reg.step3.prohibited.hint")}
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