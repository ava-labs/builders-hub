import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/authSession";
import { canAccessEvaluationTools } from "@/lib/auth/permissions";
import { buildReferralUrl } from "@/server/services/referrals";
import {
  getBuilderInsightsData,
  getBuilderInsightsReferralLinks,
} from "@/server/services/builderInsights";
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

  if (!session?.user?.id || !canAccessEvaluationTools(session.user.custom_attributes)) {
    redirect("/");
  }

  const [data, referralLinks, origin] = await Promise.all([
    getBuilderInsightsData(session.user.id),
    getBuilderInsightsReferralLinks(session.user.id),
    getRequestOrigin(),
  ]);

  return (
    <BuilderInsightsDashboard
      data={data}
      referralLinks={referralLinks.map((link) => ({
        id: link.id,
        code: link.code,
        target_type: link.target_type,
        target_id: link.target_id,
        destination_url: link.destination_url,
        created_at: link.created_at.toISOString(),
        shareUrl: buildReferralUrl(origin, link.destination_url, link.code),
      }))}
    />
  );
}
