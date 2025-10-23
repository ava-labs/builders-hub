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
import React, { useState } from "react";
import { RegisterFormValues } from "./RegistrationForm";
import { useFormContext } from "react-hook-form";
import { User } from "next-auth";
import { countries } from "@/constants/countries";
import { hsEmploymentRoles } from "@/constants/hs_employment_role";

interface Step1Props {
  user?: User; // Optional User prop
}
export default function RegisterFormStep1({ user }: Step1Props) {
  const form = useFormContext<RegisterFormValues>();
  const [open, setOpen] = useState<boolean>(false);

  return (
    <>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">
          Step 1: Personal Information
        </h3>
        <p className="text-zinc-600">
          Provide your personal details to create your Builder Hub profile.
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
                <FormLabel>Full Name or Nickname *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter your full name or preferred display name"
                    className="bg-transparent placeholder-zinc-600"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-zinc-600">
                  This name will be used for your profile and communications.
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
                <FormLabel>Email Address *</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    {...field}
                    className="bg-transparent placeholder-zinc-600"
                  />
                </FormControl>
                <FormMessage className="text-zinc-600">
                  This email will be used for login and communications.
                </FormMessage>
              </FormItem>
            )}
          />

          {/* NameCompany (opcional) */}
          <FormField
            control={form.control}
            name="company_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company/University (if applicable)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter your company/University name"
                    {...field}
                    className="bg-transparent placeholder-zinc-600"
                  />
                </FormControl>
                <FormMessage className="text-zinc-600">
                  If you are part of a company or affiliated with a university, mention it here. Otherwise,
                  leave blank.
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
                <FormLabel>Role at Company</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="text-zinc-600">
                      <SelectValue placeholder="Select your role" />
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
                  Select the option that best matches your role.
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
                <FormLabel>Country of Residence *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="text-zinc-600">
                      <SelectValue placeholder="Select your country" />
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
                  This will help us bring in-person events closer to you.
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
                <FormLabel>Telegram Username *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter your Telegram username (without @)"
                    className="bg-transparent placeholder-zinc-600"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-zinc-600">
                </FormMessage>
              </FormItem>
            )}
          />
        </div>
      </div>
    </>
  );
}
