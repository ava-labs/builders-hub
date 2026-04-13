// schema: not applicable — partial profile update with dynamic fields
import type { NextRequest } from 'next/server';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { BadRequestError, ForbiddenError } from '@/lib/api/errors';
import { getProfile, updateProfile } from '@/server/services/profile';
import type { Profile } from '@/types/profile';

export const GET = withApi(
  async (_req: NextRequest, { session, params }) => {
    const id = params.id;
    if (!id) {
      throw new BadRequestError('Id parameter is required');
    }

    if (session.user.id !== id) {
      throw new ForbiddenError('You can only access your own profile');
    }

    const profile = await getProfile(id);
    return successResponse(profile);
  },
  { auth: true },
);

export const PUT = withApi(
  async (req: NextRequest, { session, params }) => {
    const id = params.id;
    if (!id) {
      throw new BadRequestError('Id parameter is required');
    }

    if (session.user.id !== id) {
      throw new ForbiddenError('You can only update your own profile');
    }

    const newProfileData = (await req.json()) as Partial<Profile>;
    const updatedProfile = await updateProfile(id, newProfileData);

    return successResponse(updatedProfile);
  },
  { auth: true },
);
