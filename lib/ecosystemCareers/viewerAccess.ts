import { prisma } from '@/prisma/prisma';
import { getAuthSession } from '@/lib/auth/authSession';

// Number of jobs visible to viewers who haven't connected their X +
// LinkedIn accounts. Kept here so the list page and any future "blurred"
// detail-page logic stay in sync.
export const PUBLIC_JOB_PREVIEW_COUNT = 3;

export interface ViewerAccess {
  authenticated: boolean;
  userId: string | null;
  canViewAll: boolean;
  hasXAccount: boolean;
  hasLinkedInAccount: boolean;
}

const ANON: ViewerAccess = {
  authenticated: false,
  userId: null,
  canViewAll: false,
  hasXAccount: false,
  hasLinkedInAccount: false,
};

// Resolves the current viewer's access level for the Ecosystem Careers
// feature. Anonymous viewers see the first PUBLIC_JOB_PREVIEW_COUNT cards
// on the list page (per the gating spec); authenticated viewers who have
// both `x_account` and `linkedin_account` populated on their profile see
// everything.
export async function getViewerAccess(): Promise<ViewerAccess> {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return ANON;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { x_account: true, linkedin_account: true },
  });
  const hasXAccount = !!user?.x_account?.trim();
  const hasLinkedInAccount = !!user?.linkedin_account?.trim();
  return {
    authenticated: true,
    userId,
    canViewAll: hasXAccount && hasLinkedInAccount,
    hasXAccount,
    hasLinkedInAccount,
  };
}

// What a user must still connect to unlock the full board. Used by the
// "Connect to unlock" CTA.
export function missingSocialsFor(access: ViewerAccess): ('x' | 'linkedin')[] {
  const out: ('x' | 'linkedin')[] = [];
  if (!access.hasXAccount) out.push('x');
  if (!access.hasLinkedInAccount) out.push('linkedin');
  return out;
}
