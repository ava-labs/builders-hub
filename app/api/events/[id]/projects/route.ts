import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/prisma/prisma";
import { getAuthSession } from "@/lib/auth/authSession";
import {
  canEvaluateHackathon,
  verifyHackathonProjectsApiKey,
} from "@/lib/auth/permissions";
import { stripEvaluationsForViewer } from "@/lib/hackathons/evaluation-phase";
import { verifyApiKey } from "@/server/services/apiKeys";
import type { RouteParams } from "@/lib/protectedRoute";
import { PROJECT_VISIBILITY } from "@/types/showcase";

type Params = RouteParams<{ id: string }>;

const projectMetaSelect = {
  id: true,
  project_name: true,
  short_description: true,
  full_description: true,
  tech_stack: true,
  stack: true,
  github_repository: true,
  demo_link: true,
  demo_video_link: true,
  logo_url: true,
  cover_url: true,
  screenshots: true,
  tracks: true,
  categories: true,
  tags: true,
  website: true,
  socials: true,
  is_winner: true,
  visibility: true,
  created_at: true,
  updated_at: true,
} as const;

const VISIBILITY_FIELDS = ["country", "email", "telegram", "x", "github"] as const;
type VisibilityField = (typeof VISIBILITY_FIELDS)[number];

function readMemberVisibility(raw: unknown): Record<VisibilityField, boolean> {
  const out: Record<VisibilityField, boolean> = {
    country: false,
    email: false,
    telegram: false,
    x: false,
    github: false,
  };
  if (raw && typeof raw === "object") {
    for (const f of VISIBILITY_FIELDS) {
      out[f] = Boolean((raw as Record<string, unknown>)[f]);
    }
  }
  return out;
}

export async function GET(request: NextRequest, context: Params) {
  const { id: hackathonId } = await context.params;

  const apiKeyHeader =
    request.headers.get("authorization") ?? request.headers.get("Authorization");
  const { ok: hasApiKey } = await verifyApiKey(apiKeyHeader, hackathonId);

  let internalAuthorized = false;
  if (!hasApiKey) {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    internalAuthorized = await canEvaluateHackathon(session, hackathonId);
    if (!internalAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const hackathon = await prisma.hackathon.findUnique({
    where: { id: hackathonId },
    select: { id: true, title: true, evaluation_phase: true },
  });
  if (!hackathon) {
    return NextResponse.json({ error: "Hackathon not found" }, { status: 404 });
  }

  if (internalAuthorized) {
    const session = await getAuthSession();
    const viewerId = session?.user?.id ?? null;

    const projects = await prisma.project.findMany({
      where: { hackaton_id: hackathonId },
      orderBy: { created_at: "asc" },
      select: {
        ...projectMetaSelect,
        members: {
          select: {
            id: true,
            user_id: true,
            email: true,
            status: true,
            role: true,
          },
        },
        evaluations: {
          where: { project_id: { not: null } },
          orderBy: { updated_at: "desc" },
          select: {
            id: true,
            evaluator_id: true,
            score_overall: true,
            scores: true,
            verdict: true,
            comment: true,
            created_at: true,
            updated_at: true,
            evaluator: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
      },
    });

    const projectsForViewer = stripEvaluationsForViewer(
      projects,
      hackathon.evaluation_phase,
      viewerId,
    );

    return NextResponse.json({
      hackathon,
      projects: projectsForViewer,
      scope: "internal",
      evaluation_phase: hackathon.evaluation_phase,
    });
  }

  // External view (Bearer API key). Combines PR #4203's project-level visibility
  // tiers with the SPEEDRUN per-member visibility flags and gallery-shaped filters.
  const searchParams = request.nextUrl.searchParams;
  const country = searchParams.getAll("country");
  const stack = searchParams.getAll("stack");
  const track = searchParams.getAll("track");
  const teamTypeRaw = searchParams.get("team_type");
  const teamType = teamTypeRaw === "solo" || teamTypeRaw === "duo" ? teamTypeRaw : null;
  const search = (searchParams.get("search") ?? "").trim();
  const sortRaw = searchParams.get("sort");
  const sort: "newest" | "oldest" | "name" =
    sortRaw === "oldest" || sortRaw === "name" ? sortRaw : "newest";
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 20), 1), 100);

  const filters: Record<string, unknown> = {
    hackaton_id: hackathonId,
    visibility: { in: [PROJECT_VISIBILITY.SEMI_PUBLIC, PROJECT_VISIBILITY.PUBLIC] },
  };
  if (track.length > 0) (filters as any).tracks = { hasSome: track };
  if (stack.length > 0) (filters as any).stack = { hasSome: stack };
  if (country.length > 0) {
    (filters as any).members = {
      some: { status: "Confirmed", user: { country: { in: country } } },
    };
  }
  if (search) {
    (filters as any).OR = [
      { project_name: { contains: search, mode: "insensitive" } },
      { full_description: { contains: search, mode: "insensitive" } },
    ];
  }

  const orderBy =
    sort === "oldest"
      ? { created_at: "asc" as const }
      : sort === "name"
        ? { project_name: "asc" as const }
        : { created_at: "desc" as const };

  const rows = await prisma.project.findMany({
    where: filters,
    orderBy: [orderBy, { id: "desc" as const }],
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    select: {
      ...projectMetaSelect,
      members: {
        where: { status: "Confirmed" },
        select: {
          id: true,
          status: true,
          role: true,
          visibility: true,
          user: {
            select: {
              id: true,
              name: true,
              country: true,
              email: true,
              telegram_account: true,
              x_account: true,
              github_account: true,
            },
          },
        },
      },
    },
  });

  let hasNext = rows.length > limit;
  let pageRows = hasNext ? rows.slice(0, limit) : rows;

  if (teamType) {
    pageRows = pageRows.filter((p) =>
      teamType === "solo" ? p.members.length <= 1 : p.members.length >= 2,
    );
  }

  const projects = pageRows.map((p) => {
    const isPublic = p.visibility === PROJECT_VISIBILITY.PUBLIC;
    const teamSize: "solo" | "duo" = p.members.length >= 2 ? "duo" : "solo";

    const members = p.members.map((m) => {
      const v = readMemberVisibility(m.visibility as unknown);
      const u = m.user;
      return {
        id: m.id,
        role: m.role,
        status: m.status,
        name: u?.name ?? null,
        country: v.country ? u?.country ?? null : null,
        github: v.github ? u?.github_account ?? null : null,
        telegram: v.telegram ? u?.telegram_account ?? null : null,
        x: v.x ? u?.x_account ?? null : null,
        email: v.email ? u?.email ?? null : null,
      };
    });

    // Semi-public: hide project-level repo/demo/screenshots (PR #4203 contract),
    // but keep stack/tracks and the visibility-filtered member contact block.
    const base = {
      id: p.id,
      name: p.project_name,
      team_name: p.project_name,
      short_description: p.short_description,
      tracks: p.tracks,
      stack: (p as any).stack ?? [],
      visibility: p.visibility,
      submitted_at: p.created_at.toISOString(),
      team: { name: p.project_name, type: teamSize, members },
    };
    if (!isPublic) return base;

    return {
      ...base,
      full_description: p.full_description,
      tech_stack: p.tech_stack,
      repo_url: p.github_repository?.split(",")[0] ?? null,
      demo_url: p.demo_link?.split(",")[0] ?? null,
      demo_video_link: p.demo_video_link,
      logo_url: p.logo_url,
      cover_url: p.cover_url,
      screenshots: p.screenshots,
      website: p.website,
      socials: p.socials,
      is_winner: p.is_winner,
    };
  });

  const nextCursor =
    hasNext && pageRows.length > 0 ? pageRows[pageRows.length - 1].id : null;

  return NextResponse.json({
    hackathon,
    projects,
    next_cursor: nextCursor,
    scope: "external",
  });
}
