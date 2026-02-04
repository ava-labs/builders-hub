"use client";

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import axios from 'axios';
import { useRouter } from 'next/navigation';
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

// Form schema
const basicProfileSchema = z.object({
  name: z.string().min(1, 'Full name is required'),
  country: z.string().optional(),
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
  onCompleteProfile?: () => void;
}

export function BasicProfileSetup({ userId, onSuccess, onCompleteProfile }: BasicProfileSetupProps) {
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const { update } = useSession();

  const form = useForm<BasicProfileFormValues>({
    resolver: zodResolver(basicProfileSchema),
    defaultValues: {
      name: '',
      country: '',
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

  const handleSave = async (data: BasicProfileFormValues, redirectToProfile: boolean = false) => {
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
        country
      } = data;

      // Construct user_type object with all role fields
      const profileData = {
        name,
        country,
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

      if (redirectToProfile) {
        // Store data in localStorage to populate profile form
        if (typeof window !== "undefined") {
          localStorage.setItem('basicProfileData', JSON.stringify(data));
        }

        // Call onCompleteProfile callback
        onCompleteProfile?.();

        // Small delay to allow session to propagate before redirect
        await new Promise(resolve => setTimeout(resolve, 300));

        // Redirect to profile
        router.push('/profile');
      } else {
        // Just call onSuccess callback
        onSuccess?.();
      }
    } catch (error) {
      console.error('Error saving basic profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const onSubmit = (data: BasicProfileFormValues) => {
    handleSave(data, false);
  };

  const onCompleteProfileClick = () => {
    form.handleSubmit((data) => handleSave(data, true))();
  };

  return (
    <Card className="w-full rounded-md text-black dark:bg-zinc-800 dark:text-white border">
      <CardHeader className="text-center pb-4 px-4 sm:px-6">
        <h3 className="text-base sm:text-lg font-semibold">Complete Your Basic Info</h3>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Tell us a bit about yourself to get started
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
                <FormLabel className="text-sm font-normal cursor-pointer shrink-0 w-[70px]" onClick={() => {
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

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4 sm:pt-5">
              <LoadingButton
                type="submit"
                variant="outline"
                className="flex-1 w-full sm:w-auto text-sm sm:text-base"
                isLoading={isSaving}
                loadingText="Saving..."
              >
                Save and close
              </LoadingButton>
              <Button
                type="button"
                variant="red"
                className="flex-1 w-full sm:w-auto text-sm sm:text-base"
                onClick={onCompleteProfileClick}
                disabled={isSaving}
              >
                Complete Profile
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
