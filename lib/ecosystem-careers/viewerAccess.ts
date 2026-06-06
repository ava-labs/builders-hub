import { prisma } from '@/prisma/prisma';
import { getAuthSession } from '@/lib/auth/authSession';

// Public visitors (and signed-in users missing X/LinkedIn) see this many job
// cards in full before the "sign in to see all" CTA. Salary stays gated on
// every card until both socials are connected.
export const PUBLIC_JOB_PREVIEW_COUNT = 15;

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

export interface ConnectedSocials {
  hasX: boolean;
  hasLinkedIn: boolean;
}

export async function userHasConnectedSocials(userId: string): Promise<ConnectedSocials> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { x_account: true, linkedin_account: true },
  });
  return {
    hasX: !!user?.x_account?.trim(),
    hasLinkedIn: !!user?.linkedin_account?.trim(),
  };
}

export async function getViewerAccess(): Promise<ViewerAccess> {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return ANON;

  const { hasX, hasLinkedIn } = await userHasConnectedSocials(userId);
  return {
    authenticated: true,
    userId,
    canViewAll: hasX && hasLinkedIn,
    hasXAccount: hasX,
    hasLinkedInAccount: hasLinkedIn,
  };
}

export function missingSocialsFor(access: ViewerAccess): ('x' | 'linkedin')[] {
  const out: ('x' | 'linkedin')[] = [];
  if (!access.hasXAccount) out.push('x');
  if (!access.hasLinkedInAccount) out.push('linkedin');
  return out;
}
