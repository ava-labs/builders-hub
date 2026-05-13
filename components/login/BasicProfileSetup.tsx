"use client";

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@/lib/zodResolver';
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
import { Button } from '@/components/ui/button';
import { countries } from '@/constants/countries';
import { hsEmploymentRoles } from '@/constants/hs_employment_role';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Check } from 'lucide-react';
import {
  GITHUB_ACCOUNT_PATTERN,
  LINKEDIN_ACCOUNT_PATTERN,
  TELEGRAM_ACCOUNT_PATTERN,
  X_ACCOUNT_PATTERN,
} from '@/lib/profile/socialAccountValidation';

// Form schema. Social fields are optional; only name + country + at least
// one role are required to complete the basic setup. When a social field is
// filled in, the value must match its platform pattern.
const basicProfileSchema = z
  .object({
    name: z.string().min(1, 'Full name is required'),
    country: z.string().min(1, 'Country is required'),
    x_account: z
      .union([z.string().regex(X_ACCOUNT_PATTERN, 'Enter a URL like https://x.com/yourhandle'), z.literal('')])
      .optional()
      .default(''),
    linkedin_account: z
      .union([z.string().regex(LINKEDIN_ACCOUNT_PATTERN, 'Enter valid LinkedIn URL'), z.literal('')])
      .optional()
      .default(''),
    github_account: z
      .union([z.string().regex(GITHUB_ACCOUNT_PATTERN, 'Enter a valid GitHub username or github.com URL'), z.literal('')])
      .optional()
      .default(''),
    telegram_account: z
      .union([z.string().regex(TELEGRAM_ACCOUNT_PATTERN, 'Enter valid username'), z.literal('')])
      .optional()
      .default(''),
    is_student: z.boolean().default(false),
    student_institution: z.string().optional(),
    is_founder: z.boolean().default(false),
    founder_company_name: z.string().optional(),
    is_employee: z.boolean().default(false),
    employee_company_name: z.string().optional(),
    employee_role: z.string().optional(),
    is_developer: z.boolean().default(false),
    is_enthusiast: z.boolean().default(false),
  })
  .refine(
    (data) =>
      data.is_student ||
      data.is_founder ||
      data.is_employee ||
      data.is_developer ||
      data.is_enthusiast,
    {
      message: 'Select at least one role',
      path: ['is_enthusiast'],
    }
  );

type BasicProfileFormValues = z.infer<typeof basicProfileSchema>;

// Normalize names: keep only letters (incl. accented), spaces, hyphens, and
// apostrophes; lowercase everything then capitalize the first letter of each
// word (handling O'Connor, Mary-Jane). Strips digits, all-caps shouting, etc.
function normalizeFullName(input: string): string {
  const cleaned = input.replace(/[^\p{L}\s'\-]/gu, '');
  return cleaned
    .toLocaleLowerCase()
    .replace(/(^|[\s'\-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase());
}

interface BasicProfileSetupProps {
  userId: string;
  onCompleteProfile?: () => void;
}

export function BasicProfileSetup({ userId, onCompleteProfile }: BasicProfileSetupProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [githubConnected, setGithubConnected] = useState(false);
  const pathname = usePathname();
  const { update } = useSession();

  const form = useForm<BasicProfileFormValues>({
    resolver: zodResolver(basicProfileSchema),
    mode: 'onSubmit',
    defaultValues: {
      name: '',
      country: '',
      x_account: '',
      linkedin_account: '',
      github_account: '',
      telegram_account: '',
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
          x_account: profile.x_account ?? '',
          linkedin_account: profile.linkedin_account ?? '',
          github_account: profile.github_account ?? '',
          telegram_account: profile.telegram_account ?? '',
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
        setGithubConnected(Boolean(profile.githubConnected));
      } catch {
        // silent: blank defaults are fine if the fetch fails
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, form]);

  const handleGithubDisconnect = async () => {
    try {
      await axios.delete('/api/auth/github-link/disconnect');
      setGithubConnected(false);
      form.setValue('github_account', '', { shouldDirty: false, shouldValidate: true });
    } catch (error) {
      console.error('Error disconnecting GitHub:', error);
    }
  };

  const githubConnectHref = `/api/auth/github-link?returnTo=${encodeURIComponent(pathname || '/')}`;

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
        x_account,
        linkedin_account,
        telegram_account,
      } = data;

      // Construct user_type object with all role fields
      const profileData = {
        name,
        country,
        x_account,
        linkedin_account,
        telegram_account,
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

      onCompleteProfile?.();
    } catch (error) {
      console.error('Error saving basic profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const onSubmit = (data: BasicProfileFormValues) => {
    void handleSave(data);
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
        <p className="text-xs text-muted-foreground mt-2">
          We collect your social handles to verify identity and send you hackathon invites, prizes, and event updates. Your information is handled per the{' '}
          <a
            href="https://www.avax.network/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Avalanche Privacy Policy
          </a>
          .
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
                          onChange={(e) => field.onChange(normalizeFullName(e.target.value))}
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
                      <FormLabel className="text-sm sm:text-base">Country *</FormLabel>
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

            {/* Optional social handles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <FormField
                control={form.control}
                name="x_account"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm sm:text-base">X</FormLabel>
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
                name="linkedin_account"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm sm:text-base">LinkedIn</FormLabel>
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
                name="github_account"
                render={() => (
                  <FormItem>
                    <FormLabel className="text-sm sm:text-base">GitHub</FormLabel>
                    <div>
                      {githubConnected ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="w-full border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700 dark:text-green-400 dark:border-green-500 dark:hover:bg-green-950 dark:hover:text-green-300"
                          onClick={handleGithubDisconnect}
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Connected
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full"
                          asChild
                        >
                          <a href={githubConnectHref}>
                            <svg
                              viewBox="0 0 24 24"
                              className="h-4 w-4 mr-2 fill-current"
                              aria-hidden="true"
                            >
                              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                            </svg>
                            Connect
                          </a>
                        </Button>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="telegram_account"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm sm:text-base">Telegram</FormLabel>
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
              <FormLabel className="text-sm sm:text-base">Select all roles that apply. *</FormLabel>
              {form.formState.errors.is_enthusiast?.message && (
                <p className="text-sm font-medium text-destructive">
                  {String(form.formState.errors.is_enthusiast.message)}
                </p>
              )}

              {/* Student */}
              <div className="space-y-2">
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
                      <FormItem className="pl-7 sm:pl-9">
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
              <div className="space-y-2">
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
                      <FormItem className="pl-7 sm:pl-9">
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
              <div className="space-y-2">
                <div className="flex items-center gap-2 sm:gap-3">
                  <FormField
                    control={form.control}
                    name="is_employee"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-2 sm:space-x-3 space-y-0">
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
                </div>
                {watchedValues.is_employee && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 pl-7 sm:pl-9">
                    <FormField
                      control={form.control}
                      name="employee_company_name"
                      render={({ field }) => (
                        <FormItem className="min-w-0">
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
                        <FormItem className="min-w-0">
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-zinc-50 dark:bg-zinc-950 text-sm sm:text-base w-full">
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
