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

        <SocialLoginButton
          name="X"
          image="https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/hackaton-platform-images/X_X_logo-xyp7skXcigJFOHpmC3ps7MRg0d14m2.svg"
          onClick={() => SignInSocialMedia("X")}
        />
      </div>
    </div>
  );
}

export default SocialLogin;
