"use client";
import Image from "next/image";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Loader2,
  Mail,
  User,
  Building2,
  FileText,
  ChevronDown,
  Check,
  AlertCircle,
  ArrowRight,
  BellRing,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
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

const formSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  company: z.string().min(1, "Company/Project name is required"),
  companyDescription: z.string().min(1, "Company description is required"),
  subnetType: z.string().min(1, "Subnet type is required"),
  privacyPolicyRead: z.boolean().refine((val) => val === true, {
    message: "You must agree to the privacy policy to submit the form",
  }),
  marketingConsent: z.boolean().optional(),
});

const HUBSPOT_FIELD_MAPPING = {
  firstName: "firstname",
  lastName: "lastname",
  email: "email",
  company: "company",
  companyDescription: "company_description_vertical",
  subnetType: "subnet_type",
  privacyPolicyRead: "gdpr",
  marketingConsent: "marketing_consent",
};

export default function ValidatorsForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<
    "success" | "error" | null
  >(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      company: "",
      companyDescription: "",
      subnetType: "",
      privacyPolicyRead: false,
      marketingConsent: false,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      const hubspotFormData: Record<string, string | number | boolean> = {};
      Object.entries(values).forEach(([key, value]) => {
        const hubspotFieldName =
          HUBSPOT_FIELD_MAPPING[key as keyof typeof HUBSPOT_FIELD_MAPPING] ||
          key;
        if (
          value === "" &&
          key !== "firstName" &&
          key !== "email" &&
          !key.includes("required")
        ) {
          return;
        }
        if (typeof value === "boolean") {
          if (key !== "privacyPolicyRead" && key !== "marketingConsent") {
            hubspotFormData[hubspotFieldName] = value ? "Yes" : "No";
          } else {
            hubspotFormData[hubspotFieldName] = value;
          }
        } else {
          hubspotFormData[hubspotFieldName] = value;
        }
      });

      const response = await fetch("/api/validator-notification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(hubspotFormData),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to submit to HubSpot");
      }

      setSubmissionStatus("success");
      form.reset();
    } catch (error) {
      setSubmissionStatus("error");
      alert(
        `Error submitting form: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br">
      <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <section className="text-center space-y-8 pt-8 pb-12">
          <div className="flex justify-center mb-8">
            <div className="relative">
              <Image
                src="/logo-black.png"
                alt="Avalanche Logo"
                width={240}
                height={60}
                className="dark:hidden"
              />
              <Image
                src="/logo-white.png"
                alt="Avalanche Logo"
                width={240}
                height={60}
                className="hidden dark:block"
              />
            </div>
          </div>

          <div className="space-y-6">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 dark:from-white dark:via-slate-200 dark:to-white bg-clip-text text-transparent">
              Validator
              <span className="block text-[#EB4C50] bg-gradient-to-r from-[#EB4C50] to-[#d63384] bg-clip-text flex items-center justify-center gap-4">
                Updates
                <BellRing className="w-10 h-10 md:w-14 md:h-14 text-[#EB4C50] animate-pulse stroke-3" />
              </span>
            </h1>

            <p className="text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed">
              Stay informed about the latest validator updates and
              opportunities. Join our community to receive important
              notifications and exclusive insights.
            </p>
          </div>
        </section>

        {submissionStatus === "success" ? (
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-12 text-center shadow-lg">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-3xl font-bold text-emerald-800 dark:text-emerald-200 mb-4">
              Successfully Subscribed!
            </h2>
            <p className="text-emerald-700 dark:text-emerald-300 mb-8 text-lg">
              Thank you for signing up for validator updates. You'll receive
              important notifications and updates via email.
            </p>
            <Button
              onClick={() => {
                setSubmissionStatus(null);
                form.reset();
              }}
              className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white px-8 py-3 text-lg font-medium rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
              Subscribe Another Email
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-0"
              >
                {/* Contact Information */}
                <div className="p-8 md:p-12 border-b border-slate-100 dark:border-slate-700">
                  <div className="space-y-2 mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center">
                        <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          Contact Information
                        </h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Tell us about yourself
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                            Email Address{" "}
                            <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                              <Input
                                className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                placeholder="email@example.com"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-500 dark:text-red-400" />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                              First Name <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                <Input
                                  className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                  placeholder="First name"
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormMessage className="text-red-500 dark:text-red-400" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                              Last Name
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                <Input
                                  className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                  placeholder="Last name"
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormMessage className="text-red-500 dark:text-red-400" />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>

                {/* Company Information */}
                <div className="p-8 md:p-12 border-b border-slate-100 dark:border-slate-700">
                  <div className="space-y-2 mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/50 rounded-lg flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          Company Information
                        </h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Tell us about your company or project
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <FormField
                      control={form.control}
                      name="company"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                            Company/Project{" "}
                            <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Building2 className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                              <Input
                                className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                placeholder="Your company or project name"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-500 dark:text-red-400" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="companyDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                            How would you describe yourself/Company?{" "}
                            <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <FileText className="absolute left-4 top-4 w-5 h-5 text-slate-400 dark:text-slate-500" />
                              <Textarea
                                placeholder="Describe your company, role, or project in detail..."
                                className="pl-12 pt-4 min-h-[120px] text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-500 dark:text-red-400" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="subnetType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                            Validator Type{" "}
                            <span className="text-red-500">*</span>
                          </FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200">
                                <SelectValue placeholder="Select Validator Type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl shadow-xl">
                              <SelectItem
                                value="primary-network"
                                className="text-slate-700 dark:text-slate-300 py-3"
                              >
                                Primary Network
                              </SelectItem>
                              <SelectItem
                                value="avalanche-l1"
                                className="text-slate-700 dark:text-slate-300 py-3"
                              >
                                Avalanche L1
                              </SelectItem>
                              <SelectItem
                                value="RPC Provider"
                                className="text-slate-700 dark:text-slate-300 py-3"
                              >
                                RPC Provider
                              </SelectItem>
                              <SelectItem
                                value="other"
                                className="text-slate-700 dark:text-slate-300 py-3"
                              >
                                Other
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-red-500 dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Consent */}
                <div className="p-8 md:p-12">
                  <div className="space-y-2 mb-8">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-green-100 dark:bg-green-900/50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <AlertCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="flex-1">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          Consent & Privacy
                        </h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                          The Avalanche Foundation needs the contact information
                          you provide to us to contact you about our products
                          and services. You may unsubscribe from these
                          communications at any time. For information on how to
                          unsubscribe, as well as our privacy practices and
                          commitment to protecting your privacy, please review
                          our{" "}
                          <a
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline font-medium transition-colors"
                            href="https://www.avax.network/privacy-policy"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Privacy Policy
                          </a>
                          .
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <FormField
                      control={form.control}
                      name="privacyPolicyRead"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-4 space-y-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/50 p-6">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="border-slate-300 dark:border-slate-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 mt-1"
                            />
                          </FormControl>
                          <div className="space-y-2 leading-none">
                            <FormLabel className="font-medium text-slate-700 dark:text-slate-300 text-base cursor-pointer">
                              I have read the Privacy Policy linked above{" "}
                              <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormDescription className="text-sm text-slate-500 dark:text-slate-400">
                              By checking this box, you confirm that you have
                              read and agree to our privacy policy.
                            </FormDescription>
                          </div>
                          <FormMessage className="text-red-500 dark:text-red-400" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="marketingConsent"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-4 space-y-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/50 p-6">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="border-slate-300 dark:border-slate-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 mt-1"
                            />
                          </FormControl>
                          <div className="space-y-2 leading-none">
                            <FormLabel className="font-medium text-slate-700 dark:text-slate-300 text-base cursor-pointer">
                              I would also like to sign up for the Avalanche
                              Foundation's email list and understand I may
                              unsubscribe at any time
                            </FormLabel>
                            <FormDescription className="text-sm text-slate-500 dark:text-slate-400">
                              Check this box if you wish to receive additional
                              marketing communications from us.
                            </FormDescription>
                          </div>
                          <FormMessage className="text-red-500 dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="pt-8 flex justify-center">
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-8 py-3 text-base font-medium bg-[#FF394A] hover:bg-[#e6333f] text-white rounded-lg transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                          Subscribing...
                        </>
                      ) : (
                        <>
                          Subscribe for Updates
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </div>
        )}
      </div>
    </div>
  );
}
