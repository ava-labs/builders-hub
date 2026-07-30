import type { Metadata } from "next";
import { getAuthSession } from "@/lib/auth/authSession";
import { resolveAuditorByEmail } from "@/server/services/audits/auditors";
import { PortalShell } from "@/components/audits/portal/PortalShell";

export const metadata: Metadata = {
  title: "Auditor portal · Avalanche Audit Marketplace",
  description: "Quote audit requests from Avalanche ecosystem projects.",
  robots: { index: false },
};

/**
 * Chrome-free route group: deliberately NOT LayoutWrapper (no Builder Hub
 * navbar, footer, or login/terms modals; auditors have no accounts). The
 * ROOT layout still provides theme, session and toasts. Resolving the
 * auditor here also stamps first_login_at on the firm's first visit.
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
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <PortalShell
        firmName={auditor?.active ? auditor.firm_name : null}
        signedIn={Boolean(email)}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16">{children}</main>
    </div>
  );
}
