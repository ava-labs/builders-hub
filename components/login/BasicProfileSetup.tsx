"use client";

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { LoadingButton } from '@/components/ui/loading-button';
import { countries } from '@/constants/countries';
import { hsEmploymentRoles } from '@/constants/hs_employment_role';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

// Must be an x.com or twitter.com profile URL pointing at a username
// that follows X's own rules (1-15 chars, letters/digits/underscore).
const X_URL_PATTERN = /^https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[A-Za-z0-9_]{1,15}\/?$/i;
// Must be a linkedin.com/in/<slug> or linkedin.com/pub/<slug> URL.
const LINKEDIN_URL_PATTERN = /^https?:\/\/(?:www\.)?linkedin\.com\/(?:in|pub)\/[\w\-\.%]+\/?$/i;
// Accept either a bare GitHub username (1-39 chars, no leading/trailing dash,
// no double dashes) or a github.com URL pointing at one.
const GITHUB_PATTERN = /^(?:[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}|https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}\/?)$/;
// Telegram's own rules: starts with a letter, 5-32 chars, letters/digits/underscore.
// Leading @ is allowed and stripped on display by the server side if needed.
const TELEGRAM_PATTERN = /^@?[A-Za-z][A-Za-z0-9_]{4,31}$/;

// Form schema
const basicProfileSchema = z.object({
  name: z.string().min(1, 'Full name is required'),
  country: z.string().optional(),
  x_handle: z
    .string()
    .min(1, 'X (Twitter) profile URL is required')
    .regex(X_URL_PATTERN, 'Enter a URL like https://x.com/yourhandle'),
  linkedin_url: z
    .string()
    .min(1, 'LinkedIn URL is required')
    .regex(LINKEDIN_URL_PATTERN, 'Enter a LinkedIn URL like https://www.linkedin.com/in/username'),
  github: z
    .string()
    .min(1, 'GitHub profile is required')
    .regex(GITHUB_PATTERN, 'Enter a valid GitHub username or github.com URL'),
  telegram_user: z
    .string()
    .min(1, 'Telegram username is required')
    .regex(TELEGRAM_PATTERN, 'Enter a valid Telegram username (5-32 chars, starts with a letter)'),
  is_student: z.boolean().default(false),
  student_institution: z.string().optional(),
  is_founder: z.boolean().default(false),
  founder_company_name: z.string().optional(),
  is_employee: z.boolean().default(false),
  employee_company_name: z.string().optional(),
  employee_role: z.string().optional(),
  is_developer: z.boolean().default(false),
  is_enthusiast: z.boolean().default(false),
});

type BasicProfileFormValues = z.infer<typeof basicProfileSchema>;

interface BasicProfileSetupProps {
  userId: string;
  onSuccess?: () => void;
}

export function BasicProfileSetup({ userId, onSuccess }: BasicProfileSetupProps) {
  const [isSaving, setIsSaving] = useState(false);
  const { update } = useSession();

  const form = useForm<BasicProfileFormValues>({
    resolver: zodResolver(basicProfileSchema),
    defaultValues: {
      name: '',
      country: '',
      x_handle: '',
      linkedin_url: '',
      github: '',
      telegram_user: '',
      is_student: false,
      student_institution: '',
      is_founder: false,
      founder_company_name: '',
      is_employee: false,
      employee_company_name: '',
      employee_role: '',
      is_developer: false,
      is_enthusiast: false,
    },
  });

  const watchedValues = form.watch();

  // Prefill from the current extended profile so existing users who open the
  // modal to backfill X / LinkedIn don't wipe their existing name, country,
  // or user_type flags. Brand-new users will get mostly-null values here,
  // which keeps the current blank-default behavior.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/profile/extended/${userId}`);
        if (!res.ok || cancelled) return;
        const profile = await res.json();
        if (cancelled || !profile) return;
        const userType = profile.user_type ?? {};
        form.reset({
          name: profile.name ?? '',
          country: profile.country ?? '',
          x_handle: profile.x_handle ?? '',
          linkedin_url: profile.linkedin_url ?? '',
          github: profile.github ?? '',
          telegram_user: profile.telegram_user ?? '',
          is_student: Boolean(userType.is_student),
          student_institution: userType.student_institution ?? '',
          is_founder: Boolean(userType.is_founder),
          founder_company_name: userType.founder_company_name ?? '',
          is_employee: Boolean(userType.is_employee),
          employee_company_name: userType.employee_company_name ?? '',
          employee_role: userType.employee_role ?? '',
          is_developer: Boolean(userType.is_developer),
          is_enthusiast: Boolean(userType.is_enthusiast),
        });
      } catch {
        // silent: blank defaults are fine if the fetch fails
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, form]);

  const handleSave = async (data: BasicProfileFormValues) => {
    setIsSaving(true);
    try {
      // Format data to match the API expected format
      const {
        is_student,
        student_institution,
        is_founder,
        founder_company_name,
        is_employee,
        employee_company_name,
        employee_role,
        is_developer,
        is_enthusiast,
        name,
        country,
        x_handle,
        linkedin_url,
        github,
        telegram_user,
      } = data;

      // Construct user_type object with all role fields
      const profileData = {
        name,
        country,
        x_handle,
        linkedin_url,
        github,
        telegram_user,
        user_type: {
          is_student,
          is_founder,
          is_employee,
          is_developer,
          is_enthusiast,
          ...(student_institution && { student_institution }),
          ...(founder_company_name && { founder_company_name }),
          ...(employee_company_name && { employee_company_name }),
          ...(employee_role && { employee_role }),
        }
      };

      // Save to API using extended profile endpoint
      await axios.put(`/api/profile/extended/${userId}`, profileData);

      // Update session
      await update();

      onSuccess?.();
    } catch (error) {
      console.error('Error saving basic profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const onSubmit = (data: BasicProfileFormValues) => {
    handleSave(data);
  };

  return (
    <Card className="w-full rounded-md text-black dark:bg-zinc-800 dark:text-white border">
      <CardHeader className="text-center pb-4 px-4 sm:px-6">
        <div className="flex items-center justify-center gap-3 mb-1">
          <Image
            src="/common-images/Avalanche_Logomark_Red.svg"
            alt="Avalanche"
            width={28}
            height={28}
            priority
          />
          <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-red-500">
            Help us know you better
          </h3>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground">
          A few details so we can send you personalized hackathon invites, rewards, and more as they roll out on Builder Hub.
        </p>
      </CardHeader>

      <CardContent className="px-4 sm:px-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-5">
            {/* Full Name and City of Residence - Same Row */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4">
              {/* Full Name - Takes 8 columns */}
              <div className="md:col-span-8">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm sm:text-base">Full Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter your full name"
                          {...field}
                          className="bg-zinc-50 dark:bg-zinc-950 text-sm sm:text-base"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* City of Residence - Takes 4 columns */}
              <div className="md:col-span-4 w-full min-w-0">
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel className="text-sm sm:text-base">country</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-zinc-50 dark:bg-zinc-950 text-sm sm:text-base w-full min-w-0">
                            <SelectValue placeholder="Select your country" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-md shadow-md max-h-[300px] overflow-y-auto z-20000">
                          {countries.map((countryOption) => (
                            <SelectItem key={countryOption.value} value={countryOption.label}>
                              {countryOption.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Required social handles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <FormField
                control={form.control}
                name="x_handle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm sm:text-base">X (Twitter) *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://x.com/yourhandle"
                        {...field}
                        className="bg-zinc-50 dark:bg-zinc-950 text-sm sm:text-base"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="linkedin_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm sm:text-base">LinkedIn *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://www.linkedin.com/in/username"
                        {...field}
                        className="bg-zinc-50 dark:bg-zinc-950 text-sm sm:text-base"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="github"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm sm:text-base">GitHub *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://github.com/username"
                        {...field}
                        className="bg-zinc-50 dark:bg-zinc-950 text-sm sm:text-base"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="telegram_user"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm sm:text-base">Telegram *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your Telegram username (without @)"
                        {...field}
                        className="bg-zinc-50 dark:bg-zinc-950 text-sm sm:text-base"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Roles */}
            <div className="space-y-3 sm:space-y-4">
              <FormLabel className="text-sm sm:text-base">Select all roles that apply.</FormLabel>

              {/* Student */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-2 sm:gap-3">
                  <FormField
                    control={form.control}
                    name="is_student"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-2 sm:space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            className="border-zinc-400 dark:border-zinc-200 rounded-md data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500 data-[state=checked]:text-white"
                            checked={field.value}
                            onCheckedChange={(checked) => {
                              field.onChange(checked);
                              if (!checked) {
                                form.setValue("student_institution", "");
                              }
                            }}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormLabel className="text-sm sm:text-base font-normal cursor-pointer shrink-0" onClick={() => {
                    const currentValue = watchedValues.is_student;
                    form.setValue("is_student", !currentValue);
                    if (currentValue) {
                      form.setValue("student_institution", "");
                    }
                  }}>
                    University Affiliate
                  </FormLabel>
                </div>
                {watchedValues.is_student && (
                  <FormField
                    control={form.control}
                    name="student_institution"
                    render={({ field }) => (
                      <FormItem className="flex-1 w-full sm:w-auto">
                        <FormControl>
                          <Input
                            placeholder="Enter your university or institution name"
                            {...field}
                            className="bg-zinc-50 dark:bg-zinc-950 text-sm sm:text-base"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* Founder */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-2 sm:gap-3">
                  <FormField
                    control={form.control}
                    name="is_founder"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-2 sm:space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            className="border-zinc-400 dark:border-zinc-200 rounded-md data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500 data-[state=checked]:text-white"
                            checked={field.value}
                            onCheckedChange={(checked) => {
                              field.onChange(checked);
                              if (!checked) {
                                form.setValue("founder_company_name", "");
                              }
                            }}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormLabel className="text-sm sm:text-base font-normal cursor-pointer shrink-0" onClick={() => {
                    const currentValue = watchedValues.is_founder;
                    form.setValue("is_founder", !currentValue);
                    if (currentValue) {
                      form.setValue("founder_company_name", "");
                    }
                  }}>
                    Founder
                  </FormLabel>
                </div>
                {watchedValues.is_founder && (
                  <FormField
                    control={form.control}
                    name="founder_company_name"
                    render={({ field }) => (
                      <FormItem className="flex-1 w-full sm:w-auto">
                        <FormControl>
                          <Input
                            placeholder="Company name"
                            {...field}
                            className="bg-zinc-50 dark:bg-zinc-950 text-sm sm:text-base"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* Developer */}
              <div className="flex items-center gap-2 sm:gap-3">
                <FormField
                  control={form.control}
                  name="is_developer"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 sm:space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          className="border-zinc-400 dark:border-zinc-200 rounded-md data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500 data-[state=checked]:text-white"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormLabel className="text-sm sm:text-base font-normal cursor-pointer" onClick={() => {
                  form.setValue("is_developer", !watchedValues.is_developer);
                }}>
                  Developer
                </FormLabel>
              </div>

              {/* Employee */}
              <div className="flex items-center gap-3">
                <FormField
                  control={form.control}
                  name="is_employee"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          className="border-zinc-400 dark:border-zinc-200 rounded-md data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500 data-[state=checked]:text-white"
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            field.onChange(checked);
                            if (!checked) {
                              form.setValue("employee_company_name", "");
                              form.setValue("employee_role", "");
                            }
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormLabel className="text-sm sm:text-base font-normal cursor-pointer shrink-0" onClick={() => {
                  const currentValue = watchedValues.is_employee;
                  form.setValue("is_employee", !currentValue);
                  if (currentValue) {
                    form.setValue("employee_company_name", "");
                    form.setValue("employee_role", "");
                  }
                }}>
                  Employee
                </FormLabel>
                {watchedValues.is_employee && (
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pl-6 sm:pl-8">
                    <FormField
                      control={form.control}
                      name="employee_company_name"
                      render={({ field }) => (
                        <FormItem className="flex-1 w-full sm:w-auto sm:min-w-[200px]">
                          <FormControl>
                            <Input
                              placeholder="Company name"
                              {...field}
                              className="bg-zinc-50 dark:bg-zinc-950 text-sm sm:text-base"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="employee_role"
                      render={({ field }) => (
                        <FormItem className="flex-1 w-full sm:w-auto">
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-zinc-50 dark:bg-zinc-950 text-sm sm:text-base">
                                <SelectValue placeholder="role" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="z-20000">
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

              {/* Enthusiast */}
              <div className="flex items-center gap-2 sm:gap-3">
                <FormField
                  control={form.control}
                  name="is_enthusiast"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 sm:space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          className="border-zinc-400 dark:border-zinc-200 rounded-md data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500 data-[state=checked]:text-white"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormLabel className="text-sm sm:text-base font-normal cursor-pointer" onClick={() => {
                  form.setValue("is_enthusiast", !watchedValues.is_enthusiast);
                }}>
                  Enthusiast
                </FormLabel>
              </div>
            </div>

            {/* Submit */}
            <div className="pt-4 sm:pt-5">
              <LoadingButton
                type="submit"
                variant="red"
                className="w-full text-sm sm:text-base"
                isLoading={isSaving}
                loadingText="Saving..."
              >
                Save
              </LoadingButton>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
