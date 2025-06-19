import { signIn } from "next-auth/react";
import React from "react";
import { Separator } from "@/components/ui/separator";
import SocialLoginButton from "./SocialLoginButton";
import { SocialLoginProps } from "@/types/socialLoginProps";

function SocialLogin({ callbackUrl = "/" }: SocialLoginProps) {
  async function SignInSocialMedia(provider: "google" | "github" | "twitter") {
    await signIn(provider, { callbackUrl: callbackUrl });
  }

  return (
    <div>
      <div className="flex items-center justify-center  w-full my-4">
        <Separator className="flex-1 bg-zinc-800" />
        <span className="px-4 text-zinc-400 text-sm font-medium whitespace-nowrap md:px-6">
          SIGN IN WITH
        </span>
        <Separator className="flex-1 bg-zinc-800" />
      </div>
      <div className="flex items-center justify-center gap-4">
        <SocialLoginButton
          name="Google"
          image="https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/hackaton-platform-images/googleLogo-OxWoKkbOlT1idr0dqcZcrsPhx2yDj5.svg"
          onClick={() => SignInSocialMedia("google")}
        />
        <SocialLoginButton
          name="Github"
          image="https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/hackaton-platform-images/githubLogo-0HXD6L0XWqDxRru8DDR7jHm619qtjH.svg"
          onClick={() => SignInSocialMedia("github")}
        />

        <SocialLoginButton
          name="X"
          image="https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/hackaton-platform-images/twitter_X_logo-xyp7skXcigJFOHpmC3ps7MRg0d14m2.svg"
          onClick={() => SignInSocialMedia("twitter")}
        />
      </div>
    </div>
  );
}

export default SocialLogin;
