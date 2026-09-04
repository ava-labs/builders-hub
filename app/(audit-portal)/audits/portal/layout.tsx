import type { Metadata } from "next";
import { Footer } from "@/components/navigation/footer";
import { baseOptions } from "@/app/layout.config";
import { LayoutWrapper } from "@/app/layout-wrapper.client";
import { NavbarDropdownInjector } from "@/components/navigation/navbar-dropdown-injector";
import { getAuthSession } from "@/lib/auth/authSession";
import { resolveAuditorByEmail } from "@/server/services/audits/auditors";
import { PortalShell } from "@/components/audits/portal/PortalShell";

export const metadata: Metadata = {
  title: "Auditor portal · Avalanche Audit Marketplace",
  description: "Quote audit requests from Avalanche ecosystem projects.",
  robots: { index: false },
};

/**
 * The portal lives in the standard Builder Hub shell (Federico, 2026-07-30,
 * superseding the standalone chrome of the original boards): same navbar and
 * footer as /audits, plus a slim portal identity bar. Access stays
 * whitelist-gated; sign-in remains the OTP flow. Deliberately NOT the (home)
 * group: no AutoLoginModalTrigger/TrackNewUser here, so pure-auditor
 * (pending_) sessions never get pushed through Builder Hub onboarding.
 * Resolving the auditor here also stamps first_login_at on first visit.
 */
export default async function AuditorPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();
  const email = session?.user?.email?.trim().toLowerCase();
  const auditor = email ? await resolveAuditorByEmail(email) : null;

  return (
    <>
      <NavbarDropdownInjector />
      <LayoutWrapper baseOptions={baseOptions}>
        <div className="flex min-h-[70dvh] flex-col">
          {/* Identity stays up for deactivated firms too: their read-only
              portal (N-4) is still THEIR portal. */}
          <PortalShell firmName={auditor?.firm_name ?? null} />
          <main className="mx-auto w-full max-w-[1040px] flex-1 px-4 pb-16">{children}</main>
        </div>
        <Footer />
      </LayoutWrapper>
    </>
  );
}
