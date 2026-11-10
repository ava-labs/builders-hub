import { StudioError } from '@/server/services/studio/errors';
import { standardJsonFor } from '@/server/services/studio/verify';
import { studioRoute } from '../../../../../../_lib/route';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** The Standard JSON input a deployed contract was compiled from, for explorers the Builder Hub verifier doesn't cover. */
export const GET = studioRoute<{ projectId: string; deploymentId: string }>(async ({ request, params, userId }) => {
  const stepId = request.nextUrl.searchParams.get('stepId');
  if (!stepId) throw new StudioError(400, 'Pass ?stepId=');
  const { contract, input, compilerVersion, contractIdentifier } = await standardJsonFor(
    userId,
    params.projectId,
    params.deploymentId,
    stepId,
  );
  const body = JSON.stringify(
    { contractIdentifier, compilerVersion, address: contract.address, chainId: contract.chainId, input },
    null,
    2,
  );
  return new Response(body, {
    headers: {
      'content-type': 'application/json',
      'content-disposition': `attachment; filename="${contract.contract}-standard-json.json"`,
    },
  });
});
