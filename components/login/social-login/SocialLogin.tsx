import { signIn } from "next-auth/react";
import React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { SocialLoginProps } from "@/types/socialLoginProps";

function SocialLogin({ callbackUrl = "/" }: SocialLoginProps) {
  async function SignInSocialMedia(provider: "google" | "github" | "X") {
    await signIn(provider, { callbackUrl: callbackUrl });
  }

  return (
    <div className="w-full space-y-3">
      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-zinc-200 dark:border-zinc-800"></div>
        </div>
        <div className="relative flex justify-center text-[10px]">
          <span className="bg-[inherit] px-2 text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider">
            Or
          </span>
        </div>
      </div>

      {/* Social Buttons */}
      <div className="grid grid-cols-3 gap-2.5">
        <Button
          variant="outline"
          className="h-10 flex items-center justify-center border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200 group"
          onClick={() => SignInSocialMedia("google")}
        >
          <Image
            src="/brands/google.svg"
            alt="Google"
            width={20}
            height={20}
            className="w-5 h-5"
          />
          <span className="sr-only">Google</span>
        </Button>
        <Button
          variant="outline"
          className="h-10 flex items-center justify-center border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200 group"
          onClick={() => SignInSocialMedia("github")}
        >
          <Image
            src="/brands/github.svg"
            alt="GitHub"
            width={20}
            height={20}
            className="w-5 h-5 dark:invert"
          />
          <span className="sr-only">Github</span>
        </Button>
        <Button
          variant="outline"
          className="h-10 flex items-center justify-center border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200 group"
          onClick={() => SignInSocialMedia("X")}
        >
          <Image
            src="/brands/x.svg"
            alt="X"
            width={20}
            height={20}
            className="w-5 h-5 dark:invert"
          />
          <span className="sr-only">X</span>
        </Button>
      </div>
    </div>
  );
}

export default SocialLogin;
