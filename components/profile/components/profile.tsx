"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { countries } from "@/constants/countries";
import { hsEmploymentRoles } from "@/constants/hs_employment_role";
import { X, Link2, Wallet, User, FileText, Zap, Check } from "lucide-react";
import { WalletConnectButton } from "./WalletConnectButton";
import { SkillsAutocomplete } from "./SkillsAutocomplete";
import type { UseFormReturn } from "react-hook-form";
import type { ProfileFormValues } from "./hooks/useProfileForm";
import { LoadingButton } from "@/components/ui/loading-button";
import { Toaster } from "@/components/ui/toaster";
import { ProfileChecklist } from "./ProfileChecklist";
import { z } from "zod";

export interface ProfileProps {
  form: UseFormReturn<ProfileFormValues>;
  watchedValues: Partial<ProfileFormValues>;
  isSaving: boolean;
  isAutoSaving: boolean;
  githubConnected: boolean;
  onGithubDisconnect: () => Promise<void>;
  handleRemoveSkill: (skillToRemove: string) => void;
  handleAddSocial: () => void;
  handleRemoveSocial: (index: number) => void;
  handleAddWallet: (address: string) => void;
  handleRemoveWallet: (index: number) => void;
  onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
}

export default function Profile({
  form,
  watchedValues,
  isSaving,
  isAutoSaving,
  githubConnected,
  onGithubDisconnect,
  handleRemoveSkill,
  handleAddSocial,
  handleRemoveSocial,
  handleAddWallet,
  handleRemoveWallet,
  onSubmit,
}: ProfileProps) {
  const [newSkill, setNewSkill] = useState("");
  const [newSocial, setNewSocial] = useState("");

  return (
    <>
      {/* Form Content */}
      <div className=" rounded-lg   p-6">
        {/* Title Section */}
        <div className="mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Personal</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Complete your profile to unlock badges, grants and tailored opportunities
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              {isAutoSaving && (
                <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
                  <span>Saving...</span>
                </div>
              )}
            </div>
          </div>
        </div>

            <Form {...form}>
              <form onSubmit={onSubmit} className="space-y-6">

                {/* Basic Info Section */}
                <div>
            

                <div className="space-y-4">
                  {/* Full Name */}
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center gap-4">
                        <FormLabel className="w-32 shrink-0">Full Name</FormLabel>
                        <div className="flex-1">
                          <FormControl>
                            <Input
                              placeholder="Enter your full name"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />

                  {/* Short bio */}
                  <FormField
                    control={form.control}
                    name="bio"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start gap-4">
                        <FormLabel className="w-32 shrink-0 pt-2">Short bio</FormLabel>
                        <div className="flex-1">
                          <FormControl>
                            <Textarea
                              placeholder="Tell others about your background and what you're building. (max 250 characters)"
                              className="resize-none h-32"
                              maxLength={250}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />

                  {/* City of Residence */}
                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center gap-4">
                        <FormLabel className="w-32 shrink-0">Country</FormLabel>
                        <div className="flex-1">
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select your city" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="rounded-md shadow-md overflow-y-auto ">
                              {countries.map((countryOption) => (
                                <SelectItem key={countryOption.value} value={countryOption.label}>
                                  {countryOption.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />

                  {/* Roles */}
                  <div className="space-y-4">
                    <div className="flex flex-row items-center gap-4">
                      <FormLabel className="shrink-0">Select all roles that apply.</FormLabel>
                    </div>
                    
                    {/* Student */}
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
                      <FormLabel className="text-sm font-normal cursor-pointer shrink-0" onClick={() => {
                        const currentValue = watchedValues.is_student;
                        form.setValue("is_student", !currentValue, { shouldDirty: true });
                        if (currentValue) {
                          form.setValue("student_institution", "", { shouldDirty: true });
                        }
                      }}>
                        University Affiliate
                      </FormLabel>
                      {watchedValues.is_student && (
                        <FormField
                          control={form.control}
                          
                          name="student_institution"
                          render={({ field }) => (
                            <FormItem className="flex-1 pl-4">
                              <FormControl>
                                <Input
                                  placeholder="Enter your university or institution name"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

                    {/* Founder */}
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
                      <FormLabel className="text-sm font-normal cursor-pointer shrink-0" onClick={() => {
                        const currentValue = watchedValues.is_founder;
                        form.setValue("is_founder", !currentValue, { shouldDirty: true });
                        if (currentValue) {
                          form.setValue("founder_company_name", "", { shouldDirty: true });
                        }
                      }}>
                        Founder
                      </FormLabel>
                      {watchedValues.is_founder && (
                        <FormField
                          control={form.control}
                          name="founder_company_name"
                          render={({ field }) => (
                            <FormItem className="flex-1 pl-4">
                              <FormControl>
                                <Input
                                  placeholder="Company name"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

                    {/* Developer */}
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
                      <FormLabel className="text-sm font-normal cursor-pointer" onClick={() => {
                        form.setValue("is_developer", !watchedValues.is_developer, { shouldDirty: true });
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
                      <FormLabel className="text-sm font-normal cursor-pointer shrink-0" onClick={() => {
                        const currentValue = watchedValues.is_employee;
                        form.setValue("is_employee", !currentValue, { shouldDirty: true });
                        if (currentValue) {
                          form.setValue("employee_company_name", "", { shouldDirty: true });
                          form.setValue("employee_role", "", { shouldDirty: true });
                        }
                      }}>
                        Employee
                      </FormLabel>
                      {watchedValues.is_employee && (
                        <>
                          <FormField
                            control={form.control}
                            name="employee_company_name"
                            render={({ field }) => (
                              <FormItem className="flex-1 pl-2">
                                <FormControl>
                                  <Input
                                    placeholder="Company name"
                                    {...field}
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
                              <FormItem className="flex-1">
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
                        </>
                      )}
                    </div>

                    {/* Enthusiast */}
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
                      <FormLabel className="text-sm font-normal cursor-pointer" onClick={() => {
                        form.setValue("is_enthusiast", !watchedValues.is_enthusiast, { shouldDirty: true });
                      }}>
                        Enthusiast
                      </FormLabel>
                    </div>
                  </div>
                </div>
              </div>

              {/* Accounts & contact Section */}
              <div className="space-y-4">
                {/* GitHub */}
                <FormField
                  control={form.control}
                  name="github_account"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-4">
                      <FormLabel className="w-32 shrink-0">GitHub</FormLabel>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Input
                              placeholder="username"
                              {...field}
                              value={(field.value || "")
                                .replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, "")
                                .replace(/\/+$/, "")}
                              readOnly
                            />
                          </FormControl>
                          {githubConnected ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="shrink-0 border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700 dark:text-green-400 dark:border-green-500 dark:hover:bg-green-950 dark:hover:text-green-300"
                              onClick={onGithubDisconnect}
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Connected
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="shrink-0"
                              asChild
                            >
                              <a href="/api/auth/github-link">
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
                      </div>
                    </FormItem>
                  )}
                />

                {/* X handle */}
                <FormField
                  control={form.control}
                  name="x_account"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-4">
                      <FormLabel className="w-32 shrink-0">X</FormLabel>
                      <div className="flex-1 space-y-2">
                        <FormControl>
                          <Input
                            placeholder="https://x.com/yourhandle"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                {/* LinkedIn URL */}
                <FormField
                  control={form.control}
                  name="linkedin_account"
                  render={({ field }) => {
                    const hasLinkedin = typeof field.value === "string" && field.value.trim() !== "";
                    return (
                      <FormItem className="flex flex-row items-center gap-4">
                        <FormLabel className="w-32 shrink-0">LinkedIn</FormLabel>
                        <div className="flex-1">
                          <FormControl>
                            <Input
                              placeholder="username"
                              value={(field.value ?? "")
                                .replace(/^(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in|pub)\//i, "")
                                .replace(/\/+$/, "")}
                              readOnly={hasLinkedin}
                              onChange={(e) => {
                                if (hasLinkedin) return;
                                const v = e.target.value.trim();
                                if (!v) {
                                  field.onChange("");
                                  return;
                                }
                                if (/^https?:\/\//i.test(v)) {
                                  field.onChange(v);
                                } else {
                                  field.onChange(`https://www.linkedin.com/in/${v}`);
                                }
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </div>
                      </FormItem>
                    );
                  }}
                />

                {/* Telegram */}
                <FormField
                  control={form.control}
                  name="telegram_account"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-4">
                      <FormLabel className="w-32 shrink-0">Telegram</FormLabel>
                      <div className="flex-1">
                        <FormControl>
                          <Input
                            placeholder="username"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                {/* Other accounts */}
                <FormField
                  control={form.control}
                  name="additional_social_accounts"
                  render={({ field }) => {
                    const handleAddNewSocial = () => {
                      const socialLink = newSocial.trim();
                      if (!socialLink) return;

                      const isValidUrl = z.url("Must be a valid URL").safeParse(socialLink);
                      if (!isValidUrl.success) {
                        form.setError("additional_social_accounts", {
                          type: "manual",
                          message: "Must be a valid URL",
                        });
                        return;
                      }

                      const currentSocials = field.value || [];
                      if (!currentSocials.includes(socialLink)) {
                        field.onChange([...currentSocials, socialLink]);
                      }
                      form.clearErrors("additional_social_accounts");
                      setNewSocial("");
                    };

                    return (
                      <FormItem className="flex flex-row items-start gap-4">
                        <FormLabel className="w-32 shrink-0 pt-2">Other accounts</FormLabel>
                        <div className="flex-1">
                          <FormControl>
                            <div className="space-y-2">
                              {/* Display existing additional accounts as tags */}
                              {field.value && field.value.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-2">
                                  {field.value.map((social, index) => (
                                    <Badge
                                      key={index}
                                      variant="secondary"
                                      className="flex items-center gap-1 px-3 py-1 dark:bg-zinc-600"
                                    >
                                      {social}
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveSocial(index)}
                                        className="ml-1 hover:bg-secondary/80 rounded-full p-0.5"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              {/* Input for adding new social */}
                              <Input
                                value={newSocial}
                                onChange={(e) => {
                                  setNewSocial(e.target.value);
                                  if (form.formState.errors.additional_social_accounts) {
                                    form.clearErrors("additional_social_accounts");
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === "Tab") {
                                    e.preventDefault();
                                    handleAddNewSocial();
                                  }
                                }}
                                placeholder="Add other social links (Press Enter or Tab to add)"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </div>
                      </FormItem>
                    );
                  }}
                />

                {/* Wallets */}
                <FormField
                  control={form.control}
                  name="wallet"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start gap-4">
                      <FormLabel className="w-32 shrink-0 pt-2">EVM Wallet</FormLabel>
                      <div className="flex-1">
                        <FormControl>
                          <div className="space-y-2">
                            {field.value?.map((walletAddress, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <FormControl>
                                  <Input
                                    value={walletAddress}
                                    readOnly
                                    className="font-mono text-sm"
                                    placeholder="0x... (Wallet address)"
                                  />
                                </FormControl>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveWallet(index)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                            <div className="shrink-0">
                              <WalletConnectButton
                                onWalletConnected={(address) => {
                                  handleAddWallet(address);
                                }}
                                currentAddress={field.value?.[field.value.length - 1]}
                              />
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage />
                        <FormDescription className="text-sm text-zinc-500 dark:text-zinc-400">
                          Connect any wallets you'd like to receive rewards on.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

              </div>

              {/* Skills Section */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="skills"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start gap-4">
                      <FormLabel className="w-32 shrink-0 pt-2">Skills</FormLabel>
                      <div className="flex-1">
                        <div className="flex flex-wrap gap-2 mb-3">
                          {field.value?.map((skill) => (
                            <Badge
                              key={skill}
                              variant="secondary"
                              className="flex items-center gap-1 px-3 py-1 dark:bg-zinc-600"
                            >
                              {skill}
                              <button
                                type="button"
                                onClick={() => handleRemoveSkill(skill)}
                                className="ml-1 hover:bg-secondary/80 rounded-full p-0.5"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                        <FormControl>
                          <SkillsAutocomplete
                            value={newSkill}
                            onChange={setNewSkill}
                            onSelect={(skill) => {
                              const currentSkills = watchedValues.skills || [];
                              if (!currentSkills.includes(skill)) {
                                form.setValue("skills", [...currentSkills, skill], { shouldDirty: true });
                                setNewSkill("");
                              }
                            }}
                            existingSkills={watchedValues.skills || []}
                            placeholder="Start typing to search skills..."
                          />
                        </FormControl>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
              </div>

            {/* Submit Button */}
            <div className="flex justify-start ">
              <LoadingButton 
                type="submit" 
                variant="red" 
                isLoading={isSaving} 
                loadingText="Saving..."
                className="min-w-[80px]"
              >
                Save
              </LoadingButton>
            </div>
          </form>
        </Form>
      </div>

      <Toaster />
    </>
  );
}
