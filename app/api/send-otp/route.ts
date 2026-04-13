import { z } from 'zod';
import { withApi, successResponse } from '@/lib/api';
import { sendOTP } from '@/server/services/login';

const SendOtpSchema = z.object({
  email: z.string().email('Valid email is required'),
});

// withApi: auth intentionally omitted — pre-authentication endpoint
export const POST = withApi<z.infer<typeof SendOtpSchema>>(
  async (_req, { body }) => {
    await sendOTP(body.email.toLowerCase());
    return successResponse({ message: 'OTP sent correctly' });
  },
  {
    schema: SendOtpSchema,
    rateLimit: { windowMs: 3600000, maxRequests: 5, identifier: 'ip' },
  },
);
