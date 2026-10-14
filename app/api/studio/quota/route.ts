import { chatUsage } from '@/server/services/studio/quota';
import { studioRoute } from '../_lib/route';

export const runtime = 'nodejs';

/** The signed-in builder's chat usage against their hourly and daily limits. */
export const GET = studioRoute(async ({ userId }) => chatUsage(userId));
