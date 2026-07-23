import type { Prisma } from "@prisma/client";
import { prisma } from "@/prisma/prisma";
import { MemberStatus } from "@/types/project";

/**
 * Project membership predicates. One canonical home, because "is this user on
 * this project" was previously answered by six hand-written Prisma where-clauses
 * that disagreed about two things: whether to match on email as well as user_id,
 * and whether a pending invitee counts.
 */

/**
 * Matches the Member rows belonging to this user. Someone invited by email before
 * they had an account has a row keyed only by `email` — `user_id` is linked when
 * they accept the invitation — so both must be checked.
 */
export function memberIdentityWhere(user: {
  id: string;
  email?: string | null;
}): Prisma.MemberWhereInput {
  const or: Prisma.MemberWhereInput[] = [{ user_id: user.id }];
  if (user.email) or.push({ email: user.email });
  return { OR: or };
}

async function findMembership(
  userId: string,
  projectId: string,
  status: Prisma.MemberWhereInput["status"],
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });
  if (!user) return false;

  const member = await prisma.member.findFirst({
    where: { project_id: projectId, status, ...memberIdentityWhere(user) },
    select: { id: true },
  });
  return member !== null;
}

/**
 * True if the user is on the project in any capacity — including a pending
 * invitee who has not accepted yet.
 *
 * This is a **read** gate. Do not use it to authorize writes: it deliberately
 * admits `Pending Confirmation`, so a user who was merely invited would pass.
 * Use {@link isConfirmedProjectMember} for anything that mutates.
 */
export async function isProjectMemberOrInvitee(
  userId: string,
  projectId: string,
): Promise<boolean> {
  return findMembership(userId, projectId, { not: MemberStatus.REMOVED });
}

/** True only once the user has accepted their invitation. The write gate. */
export async function isConfirmedProjectMember(
  userId: string,
  projectId: string,
): Promise<boolean> {
  return findMembership(userId, projectId, MemberStatus.CONFIRMED);
}
