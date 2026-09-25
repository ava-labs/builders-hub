"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

/**
 * The existing Builder Hub OTP flow, reused unchanged: /api/send-otp then
 * signIn("credentials"). Codes expire after 3 minutes (sendOTP reality; the
 * board's 10:00 was sample copy).
 */
export function SignInCard({ initialEmail = "" }: { initialEmail?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const sendCode = async () => {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return;
    setBusy(true);
    try {
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });
      if (!res.ok) {
        toast.error("We couldn't send a code. Check the address and try again.");
        return;
      }
      setStep("code");
      setCooldown(60);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value: string) => {
    setBusy(true);
    try {
      const result = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        otp: value,
        redirect: false,
      });
      if (!result?.ok) {
        toast.error("Invalid or expired code.");
        setCode("");
        return;
      }
      router.push("/audits/portal");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  // The card lives on the page's always-dark panel, so its colors are fixed
  // dark values: theme-branched classes resolve against the ROOT theme and
  // rendered light-ink headings on the dark plate (board N-2).
  return (
    <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#1F1F1F] p-6 text-zinc-50">
      {step === "email" ? (
        <>
          <h2 className="text-lg font-semibold">Sign in with one-time code</h2>
          {/* Fixed-dark card: every color below the heading is hard dark-safe.
              Theme-branched classes here resolve against the ROOT theme and
              rendered gray-on-ink in light mode (round-4 L4-1). */}
          <p className="mt-1.5 text-sm text-[#A2AFB2]">
            Use the email your invite arrived on · your firm&apos;s quote email or your own approved
            address.
          </p>
          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void sendCode();
            }}
          >
            <Input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="quotes@yourfirm.com"
              inputMode="email"
              autoComplete="email"
              className="h-11"
            />
            <Button
              type="submit"
              disabled={busy || !email.trim()}
              className="h-11 w-full bg-white text-zinc-900 hover:bg-zinc-200"
            >
              {busy ? <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send code
            </Button>
          </form>
        </>
      ) : (
        <>
          <h2 className="text-lg font-semibold">Check your email</h2>
          <p className="mt-1.5 text-sm text-[#A2AFB2]">
            We sent a 6-digit code to <span className="font-mono">{email.trim().toLowerCase()}</span>.
          </p>
          <div className="mt-4 flex justify-center">
            <InputOTP
              maxLength={6}
              value={code}
              onChange={setCode}
              onComplete={(value) => void verify(value)}
              disabled={busy}
            >
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <InputOTPSlot key={index} index={index} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <Button
            disabled={busy || code.length !== 6}
            onClick={() => void verify(code)}
            className="mt-4 h-11 w-full bg-white text-zinc-900 hover:bg-zinc-200"
          >
            {busy ? <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" /> : null}
            Sign in
          </Button>
          <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
            <span>Codes expire after 3 minutes.</span>
            <button
              type="button"
              disabled={cooldown > 0 || busy}
              onClick={() => void sendCode()}
              className="cursor-pointer underline underline-offset-2 disabled:cursor-default disabled:no-underline disabled:opacity-60"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
          </div>
        </>
      )}
      <p className="mt-5 border-t border-white/10 pt-4 text-xs text-zinc-400">
        Access is invite-only. Firms are vetted and added by the Ava Labs security team · there is
        no self-serve signup.
      </p>
    </div>
  );
}
