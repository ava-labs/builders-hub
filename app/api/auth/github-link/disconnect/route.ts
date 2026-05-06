import { getAuthSession } from '@/lib/auth/authSession';
import { prisma } from '@/prisma/prisma';
import { NextResponse } from 'next/server';

export async function DELETE() {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      github_access_token: null,
      github: null,
    },
  });

  return NextResponse.json({ success: true });
}
