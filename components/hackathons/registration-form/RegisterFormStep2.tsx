"use client";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
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
import { useFormContext } from "react-hook-form";
import { RegisterFormValues } from "./RegistrationForm";
import { Check } from "lucide-react";
import { EventsLang, t } from "@/lib/events/i18n";

export function RegisterFormStep2({ lang = "en" }: { lang?: EventsLang }) {
  const form = useFormContext<RegisterFormValues>();

  const web3ProficiencyOptions = [
    { value: "1", label: "1" },
    { value: "2", label: "2" },
    { value: "3", label: "3" },
    { value: "4", label: "4" },
    { value: "5", label: "5" },
  ];

  const roleOptions = [
    { value: "developer", label: "Developer" },
    { value: "designer", label: "Designer" },
    { value: "productManager", label: "Product Manager" },
    { value: "marketing", label: "Marketing" },
    { value: "other", label: "Other" },
  ];

  const interestOptions = [
    { value: "defi", label: "DeFi" },
    { value: "nfts", label: "NFTs" },
    { value: "dao", label: "DAO" },
    { value: "blockchain", label: "Blockchain" },
    { value: "crypto", label: "Crypto" },
  ];

  const toolOptions = [
    { value: "metamask", label: "Metamask" },
    { value: "hardhat", label: "Hardhat" },
    { value: "truffle", label: "Truffle" },
    { value: "openzeppelin", label: "OpenZeppelin" },
    { value: "ethersjs", label: "Ethers.js" },
  ];

  const languageOptions = [
    { value: "javascript", label: "JavaScript" },
    { value: "python", label: "Python" },
    { value: "solidity", label: "Solidity" },
    { value: "rust", label: "Rust" },
    { value: "go", label: "Go" },
  ];

  const hackathonParticipationOptions = [
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" },
  ];

  const formatSelectedValues = (values: string[] | undefined) => {
    if (!values || values.length === 0) return t(lang, "reg.step2.multiSelect.placeholder");
    return t(lang, "reg.step2.multiSelect.selected", { count: values.length });
  };
  return (
    <>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">
          {t(lang, "reg.step2.title")}
        </h3>
        <p className="text-zinc-600">
          {t(lang, "reg.step2.subtitle")}
        </p>
        <div className="w-full h-px bg-zinc-300 mt-2" />
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Left Column */}
        <div className="space-y-6">
          <FormField
            control={form.control}
            name="web3_proficiency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t(lang, "reg.step2.web3.label")}
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="text-zinc-600">
                      <SelectValue placeholder={t(lang, "reg.step2.web3.placeholder")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-white dark:bg-black border-gray-300 dark:border-zinc-600 text-zinc-600 rounded-md shadow-md">
                    {web3ProficiencyOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage className="text-zinc-600">
                  {t(lang, "reg.step2.web3.hint")}
                </FormMessage>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="roles"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t(lang, "reg.step2.roles.label")}
                </FormLabel>
                <Select
                  onValueChange={(value: string) => {
                    const currentValues = Array.isArray(field.value)
                      ? field.value
                      : [];
                    const newValues = currentValues.includes(value)
                      ? currentValues.filter((v) => v !== value)
                      : [...currentValues, value];
                    field.onChange(newValues);
                  }}
                  value=""
                >
                  <FormControl>
                    <SelectTrigger className="text-zinc-600">
                      <SelectValue
                        placeholder={formatSelectedValues(field.value)}
                      >
                        {formatSelectedValues(field.value)}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-white dark:bg-black border-gray-300 dark:border-zinc-600 text-black dark:text-white rounded-md shadow-md">
                    {roleOptions.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                      >
                        <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
                          {Array.isArray(field.value) &&
                            field.value.includes(option.value) && (
                              <Check className="h-4 w-4 " />
                            )}
                        </span>
                        <span>{option.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage className="text-zinc-400">
                  {t(lang, "reg.step2.roles.hint")}
                </FormMessage>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="interests"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t(lang, "reg.step2.interests.label")}
                </FormLabel>
                <Select
                  onValueChange={(value: string) => {
                    const currentValues = Array.isArray(field.value)
                      ? field.value
                      : [];
                    const newValues = currentValues.includes(value)
                      ? currentValues.filter((v) => v !== value)
                      : [...currentValues, value];
                    field.onChange(newValues);
                  }}
                  value=""
                >
                  <FormControl>
                    <SelectTrigger className="text-zinc-600">
                      <SelectValue
                        placeholder={formatSelectedValues(field.value)}
                      >
                        {formatSelectedValues(field.value)}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-white dark:bg-black border-gray-300 dark:border-zinc-600 text-black dark:text-white rounded-md shadow-md">
                    {interestOptions.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                      >
                        <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
                          {Array.isArray(field.value) &&
                            field.value.includes(option.value) && (
                              <Check className="h-4 w-4 text-white" />
                            )}
                        </span>
                        <span>{option.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage className="text-zinc-400">
                  {t(lang, "reg.step2.interests.hint")}
                </FormMessage>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="tools"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t(lang, "reg.step2.tools.label")}</FormLabel>
                <Select
                  onValueChange={(value: string) => {
                    const currentValues = Array.isArray(field.value)
                      ? field.value
                      : [];
                    const newValues = currentValues.includes(value)
                      ? currentValues.filter((v) => v !== value)
                      : [...currentValues, value];
                    field.onChange(newValues);
                  }}
                  value=""
                >
                  <FormControl>
                    <SelectTrigger className="text-zinc-600">
                      <SelectValue
                        placeholder={formatSelectedValues(field.value)}
                      >
                        {formatSelectedValues(field.value)}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-white dark:bg-black border-gray-300 dark:border-zinc-600 text-black dark:text-white rounded-md shadow-md">
                    {toolOptions.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                      >
                        <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
                          {Array.isArray(field.value) &&
                            field.value.includes(option.value) && (
                              <Check className="h-4 w-4 text-white" />
                            )}
                        </span>
                        <span>{option.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage className="text-zinc-400">
                  {t(lang, "reg.step2.tools.hint")}
                </FormMessage>
              </FormItem>
            )}
          />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <FormField
            control={form.control}
            name="languages"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t(lang, "reg.step2.languages.label")}
                </FormLabel>
                <Select
                  onValueChange={(value: string) => {
                    const currentValues = Array.isArray(field.value)
                      ? field.value
                      : [];
                    const newValues = currentValues.includes(value)
                      ? currentValues.filter((v) => v !== value)
                      : [...currentValues, value];
                    field.onChange(newValues);
                  }}
                  value=""
                >
                  <FormControl>
                    <SelectTrigger className="text-zinc-600">
                      <SelectValue
                        placeholder={formatSelectedValues(field.value)}
                      >
                        {formatSelectedValues(field.value)}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-white dark:bg-black border-gray-300 dark:border-zinc-600 text-black dark:text-zinc-600 rounded-md shadow-md">
                    {languageOptions.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground"
                      >
                        <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
                          {Array.isArray(field.value) &&
                            field.value.includes(option.value) && (
                              <Check className="h-4 w-4 text-zinc-600" />
                            )}
                        </span>
                        <span>{option.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage className="text-zinc-600">
                  {t(lang, "reg.step2.languages.hint")}
                </FormMessage>
              </FormItem>
            )}
          />

          <div className="w-full h-px bg-zinc-300" />

          <FormField
            control={form.control}
            name="hackathon_participation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t(lang, "reg.step2.hackathon.label")}
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="text-zinc-600">
                      <SelectValue placeholder={t(lang, "reg.step2.hackathon.placeholder")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-white dark:bg-black border-gray-300 dark:border-zinc-600 text-black dark:text-zinc-600 rounded-md shadow-md">
                    {hackathonParticipationOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage className="text-zinc-600">
                  {t(lang, "reg.step2.hackathon.hint")}
                </FormMessage>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="github_portfolio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t(lang, "reg.step2.github.label")}</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      placeholder={t(lang, "reg.step2.github.placeholder")}
                      {...field}
                      className="bg-transparent placeholder-zinc-600 pr-10"
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-600">
                      🔗
                    </span>
                  </div>
                </FormControl>
                <FormMessage className="text-zinc-600">
                  {t(lang, "reg.step2.github.hint")}
                </FormMessage>
              </FormItem>
            )}
          />


        </div>
      </div>
    </>
  );
}
