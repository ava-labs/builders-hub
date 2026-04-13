import type { NextRequest } from 'next/server';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { BadRequestError, ForbiddenError } from '@/lib/api/errors';
import { createRegisterForm, getRegisterForm } from '@/server/services/registerForms';

// schema: not applicable — dynamic registration form data validated by service layer
export const POST = withApi(
  async (req: NextRequest) => {
    const body = await req.json();
    const newForm = await createRegisterForm(body);

    return successResponse(newForm, 201);
  },
  { auth: true },
);

export const GET = withApi(
  async (req: NextRequest, { session }) => {
    const hackathonId = req.nextUrl.searchParams.get('hackathonId');
    const email = req.nextUrl.searchParams.get('email');

    if (!hackathonId) throw new BadRequestError('hackathonId is required');
    if (!email) throw new BadRequestError('email is required');

    if (email !== session.user.email) {
      throw new ForbiddenError('You can only access your own registration forms');
    }

    const registerForm = await getRegisterForm(email, hackathonId);
    return successResponse(registerForm);
  },
  { auth: true },
);
