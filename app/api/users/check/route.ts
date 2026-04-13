import { z } from 'zod';
import { withApi, successResponse, validateQuery } from '@/lib/api';
import { getUserByEmail } from '@/server/services/getUser';

const CheckUserQuery = z.object({
  email: z.string().email('Valid email is required'),
});

export const GET = withApi(
  async (req) => {
    const { email } = validateQuery(req, CheckUserQuery);
    const user = await getUserByEmail(email);
    return successResponse({ exists: !!user });
  },
  { auth: true },
);
