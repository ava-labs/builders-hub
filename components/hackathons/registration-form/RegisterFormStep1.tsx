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
import React from "react";
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
  const watchedValues = form.watch();

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

      <div className="grid grid-cols-12 gap-6">
        {/* Row 1–2: name | country, email | telegram */}
        <div className="col-span-12 md:col-span-6 space-y-6">
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
                    readOnly
                    className="bg-transparent placeholder-zinc-600 cursor-default opacity-90"
                  />
                </FormControl>
                <FormMessage className="text-zinc-600">
                  {t(lang, "reg.step1.email.hint")}
                </FormMessage>
              </FormItem>
            )}
          />
        </div>

        <div className="col-span-12 md:col-span-6 space-y-6">
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

        {/* Full width below email & telegram: roles in 2 columns */}
        <div className="col-span-12 space-y-4">
          <FormLabel className="text-base font-medium">Select all roles that apply.</FormLabel>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-x-8">
            {/* Column A */}
            <div className="space-y-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <div className="flex items-center gap-3">
                  <FormField
                    control={form.control}
                    name="is_student"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            className="dark:border-white rounded-md"
                            checked={field.value}
                            onCheckedChange={(checked) => {
                              field.onChange(checked);
                              if (!checked) {
                                form.setValue("student_institution", "", { shouldDirty: true });
                              }
                            }}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormLabel
                    className="text-sm font-normal cursor-pointer"
                    onClick={() => {
                      const currentValue = watchedValues.is_student;
                      form.setValue("is_student", !currentValue, { shouldDirty: true });
                      if (currentValue) {
                        form.setValue("student_institution", "", { shouldDirty: true });
                      }
                    }}
                  >
                    University Affiliate
                  </FormLabel>
                </div>
                {watchedValues.is_student && (
                  <FormField
                    control={form.control}
                    name="student_institution"
                    render={({ field }) => (
                      <FormItem className="w-full sm:flex-1 sm:min-w-0">
                        <FormControl>
                          <Input
                            placeholder="Enter your university or institution name"
                            className="bg-transparent placeholder-zinc-600"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <div className="flex items-center gap-3">
                <FormField
                  control={form.control}
                  name="is_developer"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          className="dark:border-white rounded-md"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormLabel
                  className="text-sm font-normal cursor-pointer"
                  onClick={() => {
                    form.setValue("is_developer", !watchedValues.is_developer, { shouldDirty: true });
                  }}
                >
                  Developer
                </FormLabel>
              </div>

              <div className="flex items-center gap-3">
                <FormField
                  control={form.control}
                  name="is_enthusiast"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          className="dark:border-white rounded-md"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormLabel
                  className="text-sm font-normal cursor-pointer"
                  onClick={() => {
                    form.setValue("is_enthusiast", !watchedValues.is_enthusiast, { shouldDirty: true });
                  }}
                >
                  Enthusiast
                </FormLabel>
              </div>
            </div>

            {/* Column B */}
            <div className="space-y-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <div className="flex items-center gap-3">
                  <FormField
                    control={form.control}
                    name="is_founder"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            className="dark:border-white rounded-md"
                            checked={field.value}
                            onCheckedChange={(checked) => {
                              field.onChange(checked);
                              if (!checked) {
                                form.setValue("founder_company_name", "", { shouldDirty: true });
                              }
                            }}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormLabel
                    className="text-sm font-normal cursor-pointer"
                    onClick={() => {
                      const currentValue = watchedValues.is_founder;
                      form.setValue("is_founder", !currentValue, { shouldDirty: true });
                      if (currentValue) {
                        form.setValue("founder_company_name", "", { shouldDirty: true });
                      }
                    }}
                  >
                    Founder
                  </FormLabel>
                </div>
                {watchedValues.is_founder && (
                  <FormField
                    control={form.control}
                    name="founder_company_name"
                    render={({ field }) => (
                      <FormItem className="w-full sm:flex-1 sm:min-w-0">
                        <FormControl>
                          <Input placeholder="Company name" className="bg-transparent placeholder-zinc-600" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <div className="flex items-center gap-3">
                  <FormField
                    control={form.control}
                    name="is_employee"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            className="dark:border-white rounded-md"
                            checked={field.value}
                            onCheckedChange={(checked) => {
                              field.onChange(checked);
                              if (!checked) {
                                form.setValue("employee_company_name", "", { shouldDirty: true });
                                form.setValue("employee_role", "", { shouldDirty: true });
                              }
                            }}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormLabel
                    className="text-sm font-normal cursor-pointer"
                    onClick={() => {
                      const currentValue = watchedValues.is_employee;
                      form.setValue("is_employee", !currentValue, { shouldDirty: true });
                      if (currentValue) {
                        form.setValue("employee_company_name", "", { shouldDirty: true });
                        form.setValue("employee_role", "", { shouldDirty: true });
                      }
                    }}
                  >
                    Employee
                  </FormLabel>
                </div>
                {watchedValues.is_employee && (
                  <div className="flex w-full flex-col gap-3 sm:flex-1 sm:min-w-0 sm:flex-row sm:items-start">
                    <FormField
                      control={form.control}
                      name="employee_company_name"
                      render={({ field }) => (
                        <FormItem className="flex-1 w-full min-w-0">
                          <FormControl>
                            <Input placeholder="Company name" className="bg-transparent placeholder-zinc-600" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="employee_role"
                      render={({ field }) => (
                        <FormItem className="flex-1 w-full min-w-0">
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select your role" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {hsEmploymentRoles.map((roleOption) => (
                                <SelectItem key={roleOption.value} value={roleOption.label}>
                                  {roleOption.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
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
