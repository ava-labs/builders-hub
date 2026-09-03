import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/authSession";
import { resolveAuditorByEmail } from "@/server/services/audits/auditors";
import { BlocksArt } from "@/components/audits/shared/BlocksArt";
import { SignInCard } from "@/components/audits/portal/SignInCard";

/**
 * The email link lands here (board 1a): a dark split card in both themes ·
 * marketing panel left (the one red word, blocks anchored bottom-left), the
 * app-grade sign-in on the #1F1F1F panel right. ?email= prefills the address
 * from invite/fan-out links; prefill only, sending still takes the click.
 */
export default async function AuditorSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const session = await getAuthSession();
  const email = session?.user?.email?.trim().toLowerCase();
  if (email) {
    const auditor = await resolveAuditorByEmail(email);
    if (auditor?.active) redirect("/audits/portal");
  }
  const params = await searchParams;
  const prefill = params.email?.trim().toLowerCase() ?? "";

  return (
    <div className="py-10 lg:py-16">
      <div className="grid overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/10 lg:grid-cols-[1.3fr_1fr]">
        <div className="relative flex flex-col justify-end overflow-hidden bg-[#121212] px-8 py-10 sm:px-10 lg:min-h-[440px]">
          <BlocksArt
            cols={4}
            rows={4}
            size="lg"
            variant="stack"
            palette="plate"
            className="absolute bottom-0 left-0"
          />
          <div className="relative pb-16 lg:pb-24">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#A2AFB2]">
              Avalanche Builder Hub · whitelisted firms only
            </p>
            <h1 className="v2-display mt-4 text-4xl text-white sm:text-5xl">
              Every serious
              <br />
              request.
              <br />
              <span className="text-brand">One inbox.</span>
            </h1>
            <p className="mt-5 max-w-[46ch] text-base text-[#A2AFB2]">
              Audit requests from Avalanche ecosystem projects fan out to every vetted firm at
              once. Quote what you want to win.
            </p>
            <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.18em] text-[#7A8689]">
              Run by Ava Labs · free for builders and auditors
            </p>
          </div>
        </div>
        {/* .dark scopes the card's dark variants onto the always-dark panel. */}
        <div className="dark flex items-center justify-center border-t border-white/10 bg-[#1F1F1F] p-8 sm:p-10 lg:border-l lg:border-t-0">
          <SignInCard initialEmail={prefill} />
        </div>
      </div>
    </div>
  );
}
