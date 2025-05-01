import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import React, { useState } from "react";
import { RegisterFormValues } from "./RegistrationForm";
import { useFormContext } from "react-hook-form";
import { User } from "next-auth";

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
                <FormLabel>Full Name or Nickname</FormLabel>
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
                <FormLabel>Email Address</FormLabel>
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
                <FormLabel>Company (if applicable)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter your company name"
                    {...field}
                    className="bg-transparent placeholder-zinc-600"
                  />
                </FormControl>
                <FormMessage className="text-zinc-600">
                  If you are part of a company, mention it here. Otherwise,
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
              <FormItem>
                <FormLabel>Role at Company</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Your role"
                    {...field}
                    className="bg-transparent placeholder-zinc-600"
                  />
                </FormControl>
                <FormMessage className="text-zinc-600">
                  This name will be used for your profile and communications.
                </FormMessage>
              </FormItem>
            )}
          />

          {/* City */}
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>City of Residence</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Your city"
                    {...field}
                    className="bg-transparent placeholder-zinc-600"
                  />
                </FormControl>
                <FormMessage className="text-zinc-600">
                  Enter your current city of residence.
                </FormMessage>
              </FormItem>
            )}
          />

          {/* Dietary Restrictions */}
          <FormField
            control={form.control}
            name="dietary"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dietary Restrictions</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter any dietary restrictions (if applicable)"
                    className="bg-transparent placeholder-zinc-600"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-zinc-600">
                  If you have allergies or dietary needs, please specify them
                  here.
                </FormMessage>
              </FormItem>
            )}
          />
        </div>
      </div>
    </>
  );
}
