import { NotFoundError } from '@/lib/api/errors';

/** Query a Prisma model for a record owned by the given user, or throw NotFoundError. */
export async function assertOwnership<T>(
  model: { findFirst: Function },
  id: string,
  userId: string,
  options?: {
    idField?: string;
    userField?: string;
    include?: any;
  }
): Promise<T> {
  const idField = options?.idField ?? 'id';
  const userField = options?.userField ?? 'user_id';

  const entity = await model.findFirst({
    where: {
      [idField]: id,
      [userField]: userId,
    },
    ...(options?.include ? { include: options.include } : {}),
  });

  if (!entity) {
    throw new NotFoundError();
  }

  return entity as T;
}
