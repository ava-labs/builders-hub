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
import { X, Link2, Wallet, User, FileText, Zap } from "lucide-react";
import { WalletConnectButton } from "./WalletConnectButton";
import { SkillsAutocomplete } from "./SkillsAutocomplete";
import { useProfileForm } from "./hooks/useProfileForm";
import { LoadingButton } from "@/components/ui/loading-button";
import { Toaster } from "@/components/ui/toaster";
import { ProfileChecklist } from "./ProfileChecklist";

export default function Profile() {
  const [newSkill, setNewSkill] = useState("");
  const [newSocial, setNewSocial] = useState("");

  // Use custom hook for all profile logic
  const {
    form,
    watchedValues,
    isLoading,
    isSaving,
    isAutoSaving,
    handleRemoveSkill,
    handleAddSocial,
    handleRemoveSocial,
    handleAddWallet,
    handleRemoveWallet,
    onSubmit,
  } = useProfileForm();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Form Content */}
      <div className=" rounded-lg   p-6">
        {/* Title Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Personal</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Complete your profile to unlock badges, grants and tailored opportunities
              </p>
            </div>
            {isAutoSaving && (
              <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
                <span>Saving...</span>
              </div>
            )}
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
                        <FormLabel className="w-32 shrink-0">City of Residence</FormLabel>
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
                      <FormLabel className="flex-shrink-0">Select all roles that apply.</FormLabel>
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
                  name="github"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-4">
                      <FormLabel className="w-32 shrink-0">GitHub</FormLabel>
                      <div className="flex-1">
                        <FormControl>
                          <Input 
                            placeholder="https://github.com/username" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                {/* Wallets */}
                <FormField
                  control={form.control}
                  name="wallet"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start gap-4">
                      <FormLabel className="w-32 shrink-0 pt-2">Wallets</FormLabel>
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
                          Connect multiple wallets to receive rewards. Each wallet address must be a valid Ethereum address (0x + 40 hex characters).
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                {/* Telegram */}
                <FormField
                  control={form.control}
                  name="telegram_user"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-4">
                      <FormLabel className="w-32 shrink-0">Telegram</FormLabel>
                      <div className="flex-1">
                        <FormControl>
                          <Input
                            placeholder="Enter your Telegram username (without @)"
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
                  name="socials"
                  render={({ field }) => {
                    const handleAddNewSocial = () => {
                      if (newSocial.trim()) {
                        const currentSocials = field.value || [];
                        if (!currentSocials.includes(newSocial.trim())) {
                          field.onChange([...currentSocials, newSocial.trim()]);
                          setNewSocial("");
                        }
                      }
                    };

                    return (
                      <FormItem className="flex flex-row items-start gap-4">
                        <FormLabel className="w-32 shrink-0 pt-2">Other accounts</FormLabel>
                        <div className="flex-1">
                          <FormControl>
                            <div className="space-y-2">
                              {/* Display existing socials as tags */}
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
                                onChange={(e) => setNewSocial(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === "Tab") {
                                    e.preventDefault();
                                    handleAddNewSocial();
                                  }
                                }}
                                placeholder="Add Twitter, LinkedIn or other links (Press Enter or Tab to add)"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </div>
                      </FormItem>
                    );
                  }}
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
