"use client";

import React, { useState, useEffect } from 'react';
import Image from "next/image";
import Link from "next/link";
import { useForm, Controller } from 'react-hook-form';
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { Dialog, DialogOverlay, DialogContent, DialogTitle } from '../toolbox/components/ui/dialog';
import { Input } from "../ui/input";
import { LoadingButton } from "../ui/loading-button";
import SocialLogin from "./social-login/SocialLogin";
import { VerifyEmail } from "./verify/VerifyEmail";
import { useLoginModalState } from '@/hooks/useLoginModal';

const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export function LoginModal() {
  const { isOpen, callbackUrl = "/", closeLoginModal, subscribeToChanges } = useLoginModalState();
  const [isVerifying, setIsVerifying] = useState(false);
  const [email, setEmail] = useState("");

  const { control, handleSubmit, setError, reset, formState: { errors, isSubmitting } } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "" },
  });

  // Subscribe to modal state changes
  useEffect(() => {
    return subscribeToChanges();
  }, [subscribeToChanges]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setIsVerifying(false);
      setEmail("");
      reset();
    }
  }, [isOpen, reset]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setEmail(values.email);

    try {
      await axios.post("/api/send-otp", {
        email: values.email.toLowerCase(),
      });
      setIsVerifying(true);
    } catch (error) {
      setError("email", { message: "Error sending OTP" });
    }
  }

  if (!isOpen) return null;

  return (
    <Dialog.Root open={true} onOpenChange={closeLoginModal}>
      <Dialog.Portal>
        <DialogOverlay />
        <DialogContent 
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl focus:outline-none w-[90vw] max-w-[400px] max-h-[90vh] overflow-hidden z-[10000] p-0"
          showCloseButton={true}
        >
          {/* Compact Header - Full Width */}
          <div className="relative overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-red-500/10 via-transparent to-transparent"></div>
            <div className="flex py-5 items-center justify-center relative">
              <Image
                src="https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/hackaton-platform-images/avalancheLoginLogo-LUyz1IYs0fZrQ3tE0CUjst07LPVAv8.svg"
                alt="Avalanche"
                width="120"
                height="147"
                className="max-w-full h-auto"
              />
            </div>
          </div>

          {/* Form Content - No Side Padding */}
          {isVerifying && email ? (
            <div className="px-5 py-5">
              <VerifyEmail
                email={email}
                onBack={() => setIsVerifying(false)}
                callbackUrl={callbackUrl}
              />
            </div>
          ) : (
            <div className="px-5 py-5">
              <div className="space-y-4">
                {/* Title */}
                <div className="text-center">
                  <DialogTitle className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-1">
                    Sign in to your account
                  </DialogTitle>
                  <p className="text-zinc-500 dark:text-zinc-400 text-xs">
                    Enter your email to receive a sign-in code
                  </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
                  <Controller
                    name="email"
                    control={control}
                    render={({ field }) => (
                      <div className="space-y-1">
                        <Input
                          className="h-10 bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 focus:border-red-500 dark:focus:border-red-500 rounded-lg transition-colors text-sm"
                          placeholder="name@example.com"
                          type="email"
                          {...field}
                        />
                        {errors.email && (
                          <p className="text-red-500 text-xs px-1">
                            {errors.email.message}
                          </p>
                        )}
                      </div>
                    )}
                  />
                  <LoadingButton
                    type="submit"
                    variant="red"
                    className="w-full h-10 rounded-lg font-medium text-sm"
                    isLoading={isSubmitting}
                    loadingText="Sending..."
                  >
                    Continue with Email
                  </LoadingButton>
                </form>

                {/* Social Login */}
                <SocialLogin callbackUrl={callbackUrl} />

                {/* Footer */}
                <footer className="pt-1">
                  <p className="text-zinc-500 dark:text-zinc-400 text-center text-[10px] leading-relaxed">
                    By signing in, you agree to our{" "}
                    <Link
                      href="https://www.avax.network/terms-of-use"
                      target="_blank"
                      className="text-zinc-700 dark:text-zinc-300 hover:text-red-500 dark:hover:text-red-400 transition-colors underline underline-offset-2"
                    >
                      Terms
                    </Link>{" "}
                    and{" "}
                    <Link
                      href="https://www.avax.network/privacy-policy"
                      target="_blank"
                      className="text-zinc-700 dark:text-zinc-300 hover:text-red-500 dark:hover:text-red-400 transition-colors underline underline-offset-2"
                    >
                      Privacy Policy
                    </Link>
                  </p>
                </footer>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

