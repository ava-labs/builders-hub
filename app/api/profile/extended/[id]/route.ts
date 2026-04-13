// schema: not applicable — partial extended profile update with dynamic fields
import type { NextRequest } from 'next/server';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/lib/api/errors';
import {
  getExtendedProfile,
  updateExtendedProfile,
  ProfileValidationError,
} from '@/server/services/profile/profile.service';
import type { UpdateExtendedProfileData } from '@/types/extended-profile';

export const GET = withApi(
  async (_req: NextRequest, { session, params }) => {
    const id = params.id;
    if (!id) {
      throw new BadRequestError('User ID is required');
    }

    if (session.user.id !== id) {
      throw new ForbiddenError('You can only access your own profile');
    }

    const profile = await getExtendedProfile(id);
    if (!profile) {
      throw new NotFoundError('Profile');
    }

    return successResponse(profile);
  },
  { auth: true },
);

export const PUT = withApi(
  async (req: NextRequest, { session, params }) => {
    const id = params.id;
    if (!id) {
      throw new BadRequestError('User ID is required');
    }

    if (session.user.id !== id) {
      throw new ForbiddenError('You can only update your own profile');
    }

    const newProfileData = (await req.json()) as UpdateExtendedProfileData;

    try {
      const updatedProfile = await updateExtendedProfile(id, newProfileData);
      return successResponse(updatedProfile);
    } catch (error) {
      if (error instanceof ProfileValidationError) {
        throw new BadRequestError(error.message);
      }
      throw error;
    }
  },
  { auth: true },
);
