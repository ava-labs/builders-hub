"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

/** Signed in with an email that is not an active whitelist row. */
export function NotWhitelisted({ email, reason }: { email: string; reason: "unknown" | "deactivated" }) {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h1 className="text-xl font-semibold">
        {reason === "deactivated"
          ? "This firm is deactivated."
          : "This email is not on the audit whitelist."}
      </h1>
      <p className="mt-3 text-sm text-zinc-600 dark:text-[#A2AFB2]">
        Signed in as <span className="font-mono">{email}</span>.{" "}
        {reason === "deactivated"
          ? "Past quotes stay on record. Contact the program team to reactivate."
          : "Access is invite-only. Firms are vetted and added by the Ava Labs security team · there is no self-serve signup."}
      </p>
      <Button
        variant="outline"
        className="mt-6"
        onClick={() => void signOut({ callbackUrl: "/audits/portal/sign-in" })}
      >
        Sign out
      </Button>
    </div>
  );
}
