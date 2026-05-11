import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/authSession";
import { canAccessBuilderInsights } from "@/lib/auth/permissions";
import { getBuilderInsightsData } from "@/server/services/builderInsights";
import { getUserReferralLinks } from "@/server/services/profile-summary";
import { BuilderInsightsDashboard } from "@/components/builder-insights/BuilderInsightsDashboard";

export const metadata: Metadata = {
  title: "Builder Insights",
  description: "Internal Builder Hub account, referral, and event participation analytics.",
};

async function getRequestOrigin(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("host");
  if (!host) return "https://build.avax.network";

  const protocol = headersList.get("x-forwarded-proto") ?? "https";
  return `${protocol}://${host}`;
}

export default async function BuilderInsightsPage() {
  const session = await getAuthSession();

  if (!session?.user?.id || !canAccessBuilderInsights(session.user.custom_attributes)) {
    redirect("/");
  }

  const origin = await getRequestOrigin();
  const [data, referralLinks] = await Promise.all([
    getBuilderInsightsData(session.user.id),
    getUserReferralLinks(session.user.id, origin),
  ]);

  return (
    <BuilderInsightsDashboard
      data={data}
      referralLinks={referralLinks}
    />
  );
}
