import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/authSession";
import { resolveAuditorByEmail } from "@/server/services/audits/auditors";
import { SignInCard } from "@/components/audits/portal/SignInCard";

export default async function AuditorSignInPage() {
  const session = await getAuthSession();
  const email = session?.user?.email?.trim().toLowerCase();
  if (email) {
    const auditor = await resolveAuditorByEmail(email);
    if (auditor?.active) redirect("/audits/portal");
  }

  return (
    <div className="grid items-center gap-10 py-16 lg:grid-cols-2 lg:py-24">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
          Avalanche Builder Hub · whitelisted firms only
        </p>
        <h1 className="mt-4 text-5xl font-black uppercase leading-[0.95] tracking-tight text-zinc-950 dark:text-zinc-50">
          Every serious
          <br />
          <span className="text-brand dark:text-brand-soft">request.</span>
          <br />
          One inbox.
        </h1>
        <p className="mt-5 max-w-md text-base text-zinc-600 dark:text-[#A2AFB2]">
          Audit requests from Avalanche ecosystem projects fan out to every vetted firm at once.
          Quote what you want to win.
        </p>
        <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
          Run by Ava Labs · free for builders and auditors
        </p>
      </div>
      <div className="flex justify-center lg:justify-end">
        <SignInCard />
      </div>
    </div>
  );
}
