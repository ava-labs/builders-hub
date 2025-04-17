import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import React from "react";
import { RegisterFormValues } from "./RegistrationForm";
import { useFormContext } from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User } from "next-auth";


interface Step1Props {
  cities: string[];
  user?: User; // Optional User prop
}
export default function RegisterFormStep1({ cities,user }: Step1Props) {
  const form = useFormContext<RegisterFormValues>();
  return (
    <>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">
          Step 1: Personal Information
        </h3>
        <p className="text-zinc-600">
          Provide your personal details to create your Builders Hub profile.
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
              <FormItem>
                <FormLabel>City of Residence</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="text-zinc-600">
                      <SelectValue
                        placeholder="Select your city"
                        className="placeholder-zinc-600"
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-white dark:bg-black border-gray-300 dark:border-zinc-600 placeholder-zinc-600 text-zinc-600 rounded-md shadow-md">
                    {cities.map((city) => (
                      <SelectItem
                        className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                        key={city}
                        value={city}
                      >
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage className="text-zinc-600">
                  Choose your current city of residence.
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
