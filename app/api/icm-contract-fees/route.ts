import { withApi, successResponse } from '@/lib/api';
import { getICMContractFeesData } from '@/lib/icm-clickhouse';

export const GET = withApi(async (req) => {
  const timeRange = req.nextUrl.searchParams.get('timeRange') || 'all';
  const result = await getICMContractFeesData(timeRange);
  return successResponse(result);
});
