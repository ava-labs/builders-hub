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

export function RegisterFormStep2() {
  const form = useFormContext<RegisterFormValues>();


  const web3ProficiencyOptions = [
    { value: "1", label: "Amateur" },
    { value: "2", label: "2" },
    { value: "3", label: "3" },
    { value: "4", label: "4" },
    { value: "5", label: "Expert" },
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
    { value: "firstTime", label: "First Time" },
  ];

  const formatSelectedValues = (values: string[] | undefined) => {
    if (!values || values.length === 0) return "Select one or more options";

    return `${values.length} options selected`;
  };
  return (
    <>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">
          Step 2: Experience & Skills
        </h3>
        <p className="text-zinc-600">
          Share your skills and expertise to tailor your experience on Builders
          Hub.
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
                  What is your proficiency with Web3? (Amateur, 5 = Expert)
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="text-zinc-600">
                      <SelectValue placeholder="Select your Web3 knowledge level" />
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
                  Rate your experience from beginner to expert.
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
                  Which of the following best describes you?
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
                  Choose roles that best represent your expertise.
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
                  What are you most interested in within Web3?
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
                  Choose the topics you want to explore further.
                </FormMessage>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="tools"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Which tools are you familiar with?</FormLabel>
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
                  Select platforms or technologies you have experience with.
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
                  Which programming languages are you familiar with?
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
                      <SelectValue placeholder={formatSelectedValues(field.value)}> 
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
                  Choose all that apply.
                </FormMessage>
              </FormItem>
            )}
          />

          <div className="space-y-6">
            <div className="w-full h-px bg-zinc-300" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Hackathon Participation
              </h3>
              <FormMessage className="text-zinc-600">
                Tell us about your hackathon experience to help us customize
                your journey on Builders Hub.
              </FormMessage>
            </div>
            <div className="w-full h-px bg-zinc-300" />
          </div>

          <FormField
            control={form.control}
            name="hackathon_participation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Have you participated in any other hackathons before?
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="text-zinc-600">
                      <SelectValue placeholder="Select an option" />
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
                  Let us know if this is your first hackathon or if you have
                  prior experience.
                </FormMessage>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="github_portfolio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>What’s your GitHub or Portfolio account?</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      
                      placeholder="Enter your GitHub or Portfolio link"
                      {...field}
                      className="bg-transparent placeholder-zinc-600 pr-10"
                   
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-600">
                      🔗
                    </span>
                  </div>
                </FormControl>
                <FormMessage className="text-zinc-600">
                  Provide a link to showcase your past work.
                </FormMessage>
              </FormItem>
            )}
          />
        </div>
      </div>
    </>
  );
}