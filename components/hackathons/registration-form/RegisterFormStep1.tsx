import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import React, { useState } from "react";
import { RegisterFormValues } from "./RegistrationForm";
import { useFormContext } from "react-hook-form";
import { User } from "next-auth";
import { countries } from "@/constants/countries";
import { hsEmploymentRoles } from "@/constants/hs_employment_role";
import { EventsLang, t } from "@/lib/events/i18n";

interface Step1Props {
  user?: User;
  lang?: EventsLang;
}
export default function RegisterFormStep1({ user, lang = "en" }: Step1Props) {
  const form = useFormContext<RegisterFormValues>();
  const [open, setOpen] = useState<boolean>(false);

  return (
    <>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">
          {t(lang, "reg.step1.title")}
        </h3>
        <p className="text-zinc-600">
          {t(lang, "reg.step1.subtitle")}
        </p>
        <div className="w-full h-px bg-zinc-300 mt-2" />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Columna izquierda */}
        <div className="space-y-6">
          {/* Full Name or Nickname */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t(lang, "reg.step1.name.label")}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t(lang, "reg.step1.name.placeholder")}
                    className="bg-transparent placeholder-zinc-600"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-zinc-600">
                  {t(lang, "reg.step1.name.hint")}
                </FormMessage>
              </FormItem>
            )}
          />

          {/* Email */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t(lang, "reg.step1.email.label")}</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    {...field}
                    className="bg-transparent placeholder-zinc-600"
                  />
                </FormControl>
                <FormMessage className="text-zinc-600">
                  {t(lang, "reg.step1.email.hint")}
                </FormMessage>
              </FormItem>
            )}
          />

          {/* Company (opcional) */}
          <FormField
            control={form.control}
            name="company_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t(lang, "reg.step1.company.label")}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t(lang, "reg.step1.company.placeholder")}
                    {...field}
                    className="bg-transparent placeholder-zinc-600"
                  />
                </FormControl>
                <FormMessage className="text-zinc-600">
                  {t(lang, "reg.step1.company.hint")}
                </FormMessage>
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-6">
          {/* Rol */}
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>{t(lang, "reg.step1.role.label")}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="text-zinc-600">
                      <SelectValue placeholder={t(lang, "reg.step1.role.placeholder")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-white dark:bg-black border-gray-300 dark:border-zinc-600 text-zinc-600 rounded-md shadow-md max-h-60 overflow-y-auto">
                    {hsEmploymentRoles.map((opt) => (
                      <SelectItem key={opt.value} value={opt.label}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage className="text-zinc-600">
                  {t(lang, "reg.step1.role.hint")}
                </FormMessage>
              </FormItem>
            )}
          />

          {/* Country */}
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>{t(lang, "reg.step1.country.label")}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="text-zinc-600">
                      <SelectValue placeholder={t(lang, "reg.step1.country.placeholder")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-white dark:bg-black border-gray-300 dark:border-zinc-600 text-zinc-600 rounded-md shadow-md max-h-60 overflow-y-auto">
                    {countries.map((country) => (
                      <SelectItem key={country.value} value={country.label}>
                        {country.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage className="text-zinc-600">
                  {t(lang, "reg.step1.country.hint")}
                </FormMessage>
              </FormItem>
            )}
          />

          {/* Telegram User */}
          <FormField
            control={form.control}
            name="telegram_user"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t(lang, "reg.step1.telegram.label")}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t(lang, "reg.step1.telegram.placeholder")}
                    className="bg-transparent placeholder-zinc-600"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-zinc-600" />
              </FormItem>
            )}
          />
        </div>
      </div>
      <div className="mt-8 mb-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          {t(lang, "reg.step1.additional.title")}
        </h3>
        <div className="w-full h-px bg-zinc-300 mb-6" />
      </div>

      <div className="space-y-4">
        {/* Founder Check */}
        <FormField
          control={form.control}
          name="founder_check"
          render={({ field }) => (
            <FormItem className="flex items-center space-x-3">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className="mt-1"
                />
              </FormControl>
              <div className="flex-1">
                <FormLabel className="text-base font-medium cursor-pointer">
                  {t(lang, "reg.step1.founder.label")}
                </FormLabel>
              </div>
            </FormItem>
          )}
        />

        {/* Avalanche Ecosystem Member */}
        <FormField
          control={form.control}
          name="avalanche_ecosystem_member"
          render={({ field }) => (
            <FormItem className="flex items-center space-x-3">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className="mt-1"
                />
              </FormControl>
              <div className="flex-1">
                <FormLabel className="text-base font-medium cursor-pointer">
                  {t(lang, "reg.step1.ecosystem.label")}
                </FormLabel>
              </div>
            </FormItem>
          )}
        />
      </div>
    </>
  );
}
