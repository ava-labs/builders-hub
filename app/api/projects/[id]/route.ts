import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { HackathonHeader } from "@/types/hackathons";
import { updateProject } from "@/server/services/projects";
import { isUserProjectMember } from "@/server/services/fileValidation";
import { withAuth } from '@/lib/protectedRoute';
import { GetProjectByIdWithMembers } from "@/server/services/memberProject";
import { prisma } from "@/prisma/prisma";
import { MINI_GRANT_HACKATHON_ID } from "@/lib/grants/programs";

// A confirmed member may edit a project only while it's an unsubmitted draft:
// attached to no hackathon, with no evaluations and no grant applications. This
// is the single gate for the mini-grant wizard's edit affordance — it stops a
// teammate (or pending invitee) from rewriting a submitted, reviewed, or
// hackathon-attached project through this generic endpoint. Returns null when the
// mutation is allowed, otherwise the NextResponse error to return.
async function guardDraftMutation(id: string, session: any): Promise<NextResponse | null> {
  const orConds: Prisma.MemberWhereInput[] = [{ user_id: session.user.id }];
  if (session.user.email) orConds.push({ email: session.user.email });
  const member = await prisma.member.findFirst({
    where: { project_id: id, status: "Confirmed", OR: orConds },
    select: { id: true },
  });
  if (!member) {
    return NextResponse.json(
      { error: "Forbidden: only a confirmed member can modify this project" },
      { status: 403 },
    );
  }

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      hackaton_id: true,
      _count: { select: { evaluations: true, grant_applications: true } },
    },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const isEditableMiniGrantDraft =
    project.hackaton_id === MINI_GRANT_HACKATHON_ID &&
    project._count.evaluations === 0 &&
    project._count.grant_applications === 0;

  if (
    !isEditableMiniGrantDraft &&
    (project.hackaton_id || project._count.evaluations > 0 || project._count.grant_applications > 0)
  ) {
    return NextResponse.json(
      { error: "This project has already been submitted or reviewed and can no longer be modified." },
      { status: 409 },
    );
  }

  return null;
}

export const GET = withAuth(async (req: NextRequest, context: any, session: any) => {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    // Check if user is a member of the project
    const isMember = await isUserProjectMember(session.user.id, id);
    if (!isMember) {
      return NextResponse.json(
        { error: "Forbidden: You are not a member of this project" },
        { status: 403 }
      );
    }

    const project = await GetProjectByIdWithMembers(id);
    return NextResponse.json(project);
  } catch (error) {
    console.error("Error in GET /api/projects/[id]:");
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
});

export const PUT = withAuth(async (req: NextRequest, context: any, session: any) => {
  try {
    const { id } = await context.params;
    
    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    // Check if user is a member of the project
    const isMember = await isUserProjectMember(session.user.id, id);
    if (!isMember) {
      return NextResponse.json(
        { error: "Forbidden: You are not a member of this project" },
        { status: 403 }
      );
    }

    const partialEditedHackathon = (await req.json()) as Partial<HackathonHeader>;
    const updatedHackathon = await updateProject(id ?? partialEditedHackathon.id, partialEditedHackathon);

    return NextResponse.json(updatedHackathon);
  } catch (error) {
    console.error("Error in PUT /api/projects/[id]:", error);
    return NextResponse.json({ error: `Internal Server Error: ${error}` }, { status: 500 });
  }
});

// Targeted partial edit (does NOT clobber unspecified fields like the PUT path).
export const PATCH = withAuth(async (req: NextRequest, context: any, session: any) => {
  try {
    const { id } = await context.params;
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const guard = await guardDraftMutation(id, session);
    if (guard) return guard;

    const body = (await req.json()) as {
      project_name?: string;
      short_description?: string;
      url?: string | null;
      website?: Record<string, string> | null;
      socials?: Record<string, string> | null;
      categories?: string[];
      other_category?: string | null;
      is_preexisting_idea?: boolean;
    };

    const isNonEmptyObject = (v: unknown): v is Record<string, string> =>
      !!v && typeof v === "object" && Object.keys(v).length > 0;

    const data: Prisma.ProjectUpdateInput = { updated_at: new Date() };
    if (typeof body.project_name === "string") data.project_name = body.project_name;
    if (typeof body.short_description === "string") data.short_description = body.short_description;
    // `website` is the generic links map ({ url, "Pitch Deck": ... }); it takes
    // precedence over the legacy single `url` field when both are present.
    if ("website" in body) {
      data.website = isNonEmptyObject(body.website)
        ? (body.website as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    } else if ("url" in body) {
      const u = (body.url ?? "").toString().trim();
      data.website = u ? ({ url: u } as Prisma.InputJsonValue) : Prisma.JsonNull;
    }
    if ("socials" in body) {
      data.socials = isNonEmptyObject(body.socials)
        ? (body.socials as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    }
    if (Array.isArray(body.categories)) data.categories = body.categories;
    if ("other_category" in body) data.other_category = body.other_category ?? null;
    if (typeof body.is_preexisting_idea === "boolean") data.is_preexisting_idea = body.is_preexisting_idea;

    await prisma.project.update({ where: { id }, data });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error in PATCH /api/projects/[id]:", error);
    return NextResponse.json({ error: `Internal Server Error: ${error}` }, { status: 500 });
  }
});
