import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/authSession";
import { prisma } from "@/prisma/prisma";
import { formSchema } from "@/types/researchProposalForm";
import { recordReferralAttributionFromRequest } from "@/server/services/referrals";
import { rateLimited } from "@/app/api/managed-testnet-nodes/utils";

// Identifier for the rate limiter — uses the session email so each
// account gets its own bucket. Throws on missing email so the wrapper
// returns a 401 before consuming a slot in the limiter.
async function rateLimitIdentifier(): Promise<string> {
  if (process.env.NODE_ENV === "development") return "dev-user";
  const session = await getAuthSession();
  const email = session?.user?.email;
  if (!email) throw new Error("Authentication required");
  return `research-proposal:${email}`;
}

async function handlePost(request: NextRequest) {
  const session = await getAuthSession();
  const sessionUserId = session?.user?.id;
  const sessionEmail = session?.user?.email?.trim().toLowerCase();

  if (!sessionUserId || !sessionEmail) {
    return NextResponse.json(
      { success: false, message: "Please sign in to submit a proposal." },
      { status: 401 },
    );
  }

  if (sessionUserId.startsWith("pending_")) {
    return NextResponse.json(
      {
        success: false,
        message: "Please finish account setup before submitting a proposal.",
      },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request body" },
      { status: 400 },
    );
  }

  const parsed = formSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const data = parsed.data;

  try {
    const result = await prisma.researchProposalApplication.create({
      data: {
        submitted_by_user_id: sessionUserId,
        email: sessionEmail,
        lead_full_name: data.lead_full_name,
        affiliation: data.affiliation,
        proposal_title: data.proposal_title,
        primary_research_area: data.primary_research_area,
        primary_research_area_other:
          data.primary_research_area === "Other"
            ? data.primary_research_area_other || null
            : null,
        budget_usd: data.budget_usd,
        proposal_url: data.proposal_url,
        lead_cv_url: data.lead_cv_url,
        co_investigators: data.co_investigators || null,
        co_investigator_cvs_url: data.co_investigator_cvs_url || null,
        exclusivity_agreement: data.exclusivity_agreement,
      },
    });

    try {
      await recordReferralAttributionFromRequest(request, {
        conversionType: "grant_application",
        conversionResourceId: result.id,
        conversionTargetId: "avalanche-research-proposals",
        convertedUserId: sessionUserId,
        convertedEmail: sessionEmail,
      });
    } catch (error) {
      console.error("[Referral] Failed to record research proposal attribution:", error);
    }

    return NextResponse.json({ success: true, id: result.id }, { status: 201 });
  } catch (error) {
    console.error("[Research Proposal] DB save failed:", error);
    return NextResponse.json(
      {
        success: false,
        message: "We couldn't save your proposal right now. Please try again.",
      },
      { status: 500 },
    );
  }
}

// 5 submissions per day per account in prod is well above legitimate
// retries (typo fixes, last-minute edits) but stops a logged-in user
// from spamming the form into a stuck queue.
export const POST = rateLimited(handlePost, {
  dev: { windowMs: 24 * 60 * 60 * 1000, max: 1000 },
  prod: { windowMs: 24 * 60 * 60 * 1000, max: 5 },
  identifier: rateLimitIdentifier,
});
