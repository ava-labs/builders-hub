"use client"

import React from "react";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "next-auth/react";
import Link from "next/link";
import axios from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
  FormMessage,
} from "@/components/ui/form";

// Form schema with validation
const termsFormSchema = z.object({
  accepted_terms: z.boolean().refine((val) => val === true, {
    message: "You must accept the Terms and Conditions to continue.",
  }),
  notifications: z.boolean().default(false),
});

type TermsFormValues = z.infer<typeof termsFormSchema>;

interface TermsProps {
  userId: string;
  onSuccess?: () => void;
  onDecline?: () => void;
}

export const Terms = ({
  userId,
  onSuccess,
  onDecline
}: TermsProps) => {
  const router = useRouter();
  const { toast } = useToast();
  const { update } = useSession();

  const form = useForm<TermsFormValues>({
    resolver: zodResolver(termsFormSchema),
    defaultValues: {
      accepted_terms: false,
      notifications: false,
    },
  });

  const onSubmit = async (data: TermsFormValues) => {
    try {
      // Save to API
      await axios.put(`/api/profile/${userId}`, data);
      
      // Update session
      await update();
      
 
      // Execute success callback if provided
      onSuccess?.();

      // Navigate to home or redirect URL
      const redirectUrl = typeof window !== "undefined" 
        ? localStorage.getItem("redirectAfterProfile") 
        : null;
      
      if (redirectUrl) {
        localStorage.removeItem("redirectAfterProfile");
        router.push(redirectUrl);
      } else {
        router.push("/");
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({
        title: "Error",
        description: "An error occurred while saving the profile.",
        variant: "destructive",
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Card
          className="
            w-full max-w-2xl mx-auto
            rounded-md
            text-black dark:bg-zinc-800 dark:text-white
            border
          "
        >
          <CardHeader className="text-center">
            <p className="text-sm text-muted-foreground">
              Review and agree to the terms to complete your registration. Please review our{" "}
              <Link
                href="https://www.avax.network/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 dark:text-primary/90 dark:hover:text-primary/70 underline"
              >
                Avalanche Privacy Policy.
              </Link>
            </p>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Separator */}
            <div className="border-t border-border"></div>

            {/* Terms Content */}
            <div className="space-y-4">
              {/* First checkbox - Event Participation */}
              <FormField
                control={form.control}
                name="accepted_terms"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-start space-x-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="flex-1">
                        <FormLabel className="text-sm text-foreground cursor-pointer">
                          I have read and agree to the Avalanche Privacy Policy{" "}
                          <Link
                            href="https://www.avax.network/privacy-policy"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary/80 dark:text-primary/90 dark:hover:text-primary/70 underline"
                          >
                            Terms and Conditions,
                          </Link>
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </div>
                  </FormItem>
                )}
              />

              {/* Second checkbox - Email Notifications */}
              <FormField
                control={form.control}
                name="notifications"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-start space-x-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="flex-1">
                        <FormLabel className="text-sm text-foreground cursor-pointer">
                          I wish to stay informed about Avalanche news and events.
                        </FormLabel>
                        <p className="text-xs text-muted-foreground mt-1">
                          Subscribe to newsletters and promotional materials. You can opt out anytime.
                        </p>
                      </div>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            {/* Bottom Separator */}
            <div className="border-t border-border"></div>
          </CardContent>

          <CardFooter className="flex flex-col gap-2 pt-2">
            <div className="flex justify-between w-full gap-2">
              <Button 
                type="submit"
                variant="default" 
                className="flex-1" 
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    Accept
                  </>
                )}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
};