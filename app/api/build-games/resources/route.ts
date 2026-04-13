import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { getHackathon } from '@/server/services/hackathons';

const HACKATHON_ID = '249d2911-7931-4aa0-a696-37d8370b79f9';

export const GET = withApi(async () => {
  const hackathon = await getHackathon(HACKATHON_ID);

  if (!hackathon?.content?.resources) {
    return successResponse({ resources: [] });
  }

  return successResponse({ resources: hackathon.content.resources });
});
