import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAuthSession } from "@/lib/auth/authSession";
import { prisma } from "@/prisma/prisma";
import { miniGrantFormSchema } from "@/types/miniGrantForm";
import { MINI_GRANT_KEY, MINI_GRANT_HACKATHON_ID } from "@/lib/grants/programs";
import { ensureGrantHackathon } from "@/lib/grants/ensureHackathon";
import { rateLimited } from "@/app/api/managed-testnet-nodes/utils";
import { extractAndRecordReferral } from "@/server/services/referrals";

async function rateLimitIdentifier(): Promise<string> {
  if (process.env.NODE_ENV === "development") return "dev-user";
  const s = await getAuthSession();
  if (!s?.user?.email) throw new Error("Authentication required");
  return `mini-grant:${s.user.email}`;
}

async function handlePost(request: NextRequest) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  const email = session?.user?.email?.trim().toLowerCase();
  if (!userId || !email) return NextResponse.json({ success: false, message: "Please sign in to apply." }, { status: 401 });
  if (userId.startsWith("pending_")) return NextResponse.json({ success: false, message: "Finish account setup first." }, { status: 403 });

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ success: false, message: "Invalid body" }, { status: 400 }); }

  const projectId = body?.projectId;
  if (typeof projectId !== "string") return NextResponse.json({ success: false, message: "projectId is required" }, { status: 400 });
  if (body?.consentTeam1 !== true) return NextResponse.json({ success: false, message: "Consent is required to apply." }, { status: 400 });

  const parsed = miniGrantFormSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  const data = parsed.data;

  // Caller must be a confirmed member of the project they're submitting
  // (role-agnostic, matching the build-games stage-submit precedent).
  const project = await prisma.project.findFirst({
    where: { id: projectId, members: { some: { user_id: userId, status: "Confirmed" } } },
    select: { id: true, hackaton_id: true },
  });
  if (!project) return NextResponse.json({ success: false, message: "You must be a confirmed member of this project to apply." }, { status: 403 });

  // Never hijack a project that already belongs to a different hackathon/program.
  // Submitting attaches the project to the grant's backing hackathon, which would
  // otherwise detach it from its original event.
  if (project.hackaton_id && project.hackaton_id !== MINI_GRANT_HACKATHON_ID) {
    return NextResponse.json(
      { success: false, message: "This project already belongs to another program or hackathon. Create a new project for this grant." },
      { status: 409 },
    );
  }

  // One application per project: you can apply again, but with a different project.
  const existingApp = await prisma.grantApplication.findUnique({
    where: { program_key_project_id: { program_key: MINI_GRANT_KEY, project_id: projectId } },
    select: { id: true },
  });
  if (existingApp) {
    return NextResponse.json(
      { success: false, message: "You've already applied with this project. Pick or create a different project to apply again." },
      { status: 409 },
    );
  }

  // Ensure the backing hidden hackathon exists so the project FK below resolves
  // even on environments where the seed was never run.
  await ensureGrantHackathon(MINI_GRANT_KEY);

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.project.update({ where: { id: projectId }, data: { hackaton_id: MINI_GRANT_HACKATHON_ID, origin: MINI_GRANT_KEY, consent_sharing: true } });

      const existingFd = await tx.formData.findFirst({ where: { project_id: projectId, origin: MINI_GRANT_KEY }, select: { id: true } });
      const grantPayload = { grant: {
        project_url: data.project_url, requested_amount_usd: data.requested_amount_usd,
        summary: data.summary, milestones: data.milestones, why_grant: data.why_grant, additional_url: data.additional_url ?? "",
        x_profile: data.x_profile, telegram: data.telegram ?? "",
      } } as Prisma.InputJsonValue;

      if (existingFd) await tx.formData.update({ where: { id: existingFd.id }, data: { form_data: grantPayload, timestamp: new Date() } });
      else await tx.formData.create({ data: { project_id: projectId, origin: MINI_GRANT_KEY, timestamp: new Date(), current_stage: 0, form_data: grantPayload } });

      return tx.grantApplication.create({
        data: { program_key: MINI_GRANT_KEY, user_id: userId, project_id: projectId },
        select: { id: true },
      });
    });
    const referralAttributed = await extractAndRecordReferral(
      request,
      body,
      { targetType: "grant_application", targetId: MINI_GRANT_KEY },
      { userId, userEmail: email },
    );

    return NextResponse.json({ success: true, id: result.id, referralAttributed }, { status: 201 });
  } catch (error) {
    console.error("[Mini Grants] save failed:", error);
    return NextResponse.json({ success: false, message: "We couldn't save your application right now." }, { status: 500 });
  }
}

export const POST = rateLimited(handlePost, {
  dev: { windowMs: 24 * 60 * 60 * 1000, max: 1000 },
  prod: { windowMs: 24 * 60 * 60 * 1000, max: 10 },
  identifier: rateLimitIdentifier,
});
