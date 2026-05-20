import { NextRequest, NextResponse } from "next/server";
import { Session } from "next-auth";
import { withAuth } from "@/lib/protectedRoute";
import { prisma } from "@/prisma/prisma";
import { hasAnyAttribute } from "@/lib/auth/permissions";

/**
 * GET /api/admin/referral-funnel?hackathon_id=...&from=...&to=...
 *
 * Returns a per-source funnel for one hackathon:
 *   [{ source: {...}, registered, submitted, won }, ...]
 *
 * Source resolution priority:
 *   1. referral_link_id → ReferralLink.owner (user)
 *   2. user_id_referrer (manual "who referred you" pick)
 *   3. team_id_referrer / team_id_referrer_other (manual team pick)
 *
 * Stages:
 *   - registered : distinct user_ids with an attribution row (one per source)
 *   - submitted  : of those user_ids, how many are confirmed members on any Project
 *                  for this hackathon
 *   - won        : of those user_ids, how many are confirmed members on a Project
 *                  with is_winner=true for this hackathon
 *
 * UTM-source/medium analytics live in PostHog and are intentionally out of scope.
 */
export const GET = withAuth(async (
  req: NextRequest,
  _context: unknown,
  session: Session,
) => {
  const customAttributes: string[] | undefined = (session.user as { custom_attributes?: string[] })
    ?.custom_attributes;
  if (!hasAnyAttribute(customAttributes, ["devrel"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const searchParams = req.nextUrl.searchParams;
  const hackathonId = searchParams.get("hackathon_id");
  if (!hackathonId) {
    return NextResponse.json({ error: "hackathon_id required" }, { status: 400 });
  }

  const fromRaw = searchParams.get("from");
  const toRaw = searchParams.get("to");
  const from = fromRaw ? new Date(fromRaw) : null;
  const to = toRaw ? new Date(toRaw) : null;

  const attributionDateFilter: Record<string, Date> = {};
  if (from && Number.isFinite(from.getTime())) attributionDateFilter.gte = from;
  if (to && Number.isFinite(to.getTime())) attributionDateFilter.lte = to;

  const attributions = await prisma.referralAttribution.findMany({
    where: {
      target_type: "hackathon_registration",
      target_id: hackathonId,
      ...(Object.keys(attributionDateFilter).length > 0 && {
        created_at: attributionDateFilter,
      }),
    },
    select: {
      user_id: true,
      referral_link_id: true,
      user_id_referrer: true,
      team_id_referrer: true,
      team_id_referrer_other: true,
      referralLink: {
        select: {
          id: true,
          code: true,
          owner: { select: { id: true, name: true, user_name: true, email: true } },
        },
      },
      referrer: { select: { id: true, name: true, user_name: true, email: true } },
    },
  });

  type SourceKey = string;
  type SourceMeta = {
    kind: "user" | "team" | "team_other";
    id: string;
    label: string;
    handle: string | null;
    email: string | null;
  };
  const sources = new Map<SourceKey, { meta: SourceMeta; userIds: Set<string> }>();

  for (const a of attributions) {
    if (!a.user_id) continue;
    let key: SourceKey | null = null;
    let meta: SourceMeta | null = null;

    if (a.referralLink?.owner) {
      const owner = a.referralLink.owner;
      key = `user:${owner.id}`;
      meta = {
        kind: "user",
        id: owner.id,
        label: owner.user_name ?? owner.name ?? owner.email ?? owner.id,
        handle: owner.user_name ?? null,
        email: owner.email ?? null,
      };
    } else if (a.referrer) {
      key = `user:${a.referrer.id}`;
      meta = {
        kind: "user",
        id: a.referrer.id,
        label: a.referrer.user_name ?? a.referrer.name ?? a.referrer.email ?? a.referrer.id,
        handle: a.referrer.user_name ?? null,
        email: a.referrer.email ?? null,
      };
    } else if (a.team_id_referrer) {
      key = `team:${a.team_id_referrer}`;
      meta = {
        kind: "team",
        id: a.team_id_referrer,
        label: a.team_id_referrer,
        handle: null,
        email: null,
      };
    } else if (a.team_id_referrer_other) {
      key = `team_other:${a.team_id_referrer_other}`;
      meta = {
        kind: "team_other",
        id: a.team_id_referrer_other,
        label: a.team_id_referrer_other,
        handle: null,
        email: null,
      };
    }

    if (!key || !meta) continue;
    if (!sources.has(key)) sources.set(key, { meta, userIds: new Set() });
    sources.get(key)!.userIds.add(a.user_id);
  }

  const allReferredUserIds = Array.from(
    new Set(Array.from(sources.values()).flatMap((s) => Array.from(s.userIds))),
  );

  // For each referred user, find their confirmed-member projects on this hackathon.
  const projectsByUser = allReferredUserIds.length
    ? await prisma.member.findMany({
        where: {
          user_id: { in: allReferredUserIds },
          status: "Confirmed",
          project: { hackaton_id: hackathonId },
        },
        select: {
          user_id: true,
          project: { select: { id: true, is_winner: true } },
        },
      })
    : [];

  const submittedUserIds = new Set<string>();
  const wonUserIds = new Set<string>();
  for (const row of projectsByUser) {
    if (!row.user_id) continue;
    submittedUserIds.add(row.user_id);
    if (row.project?.is_winner) wonUserIds.add(row.user_id);
  }

  const rows = Array.from(sources.values())
    .map((s) => {
      const referredIds = Array.from(s.userIds);
      const registered = referredIds.length;
      const submitted = referredIds.filter((id) => submittedUserIds.has(id)).length;
      const won = referredIds.filter((id) => wonUserIds.has(id)).length;
      return { source: s.meta, registered, submitted, won };
    })
    .sort((a, b) => b.registered - a.registered);

  return NextResponse.json({
    hackathon_id: hackathonId,
    rows,
    total: rows.length,
  });
});
