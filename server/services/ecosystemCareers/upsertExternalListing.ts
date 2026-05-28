import { prisma } from '@/prisma/prisma';
import type { Prisma } from '@prisma/client';

export type ExternalSource = 'getro' | 'external';

type ManagedFields = 'source' | 'external_id' | 'last_seen_at' | 'is_active';
export type ExternalListingCreateData = Omit<Prisma.JobListingUncheckedCreateInput, ManagedFields>;

export async function upsertExternalListing(
  source: ExternalSource,
  externalId: string,
  now: Date,
  buildCreateData: () => ExternalListingCreateData,
): Promise<'inserted' | 'updated'> {
  const existing = await prisma.jobListing.findFirst({
    where: { source, external_id: externalId },
    select: { id: true },
  });

  if (existing) {
    await prisma.jobListing.update({
      where: { id: existing.id },
      data: { last_seen_at: now },
    });
    return 'updated';
  }

  await prisma.jobListing.create({
    data: {
      ...buildCreateData(),
      source,
      external_id: externalId,
      last_seen_at: now,
      is_active: false,
    },
  });
  return 'inserted';
}
