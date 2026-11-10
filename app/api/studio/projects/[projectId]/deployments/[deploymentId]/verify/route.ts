import { after } from 'next/server';
import { z } from 'zod';
import { startVerification, verificationJob, verificationStates } from '@/server/services/studio/verify';
import { parseBody, studioRoute } from '../../../../../_lib/route';

export const runtime = 'nodejs';
export const maxDuration = 300;

type Params = { projectId: string; deploymentId: string };

/** Each deployed contract's verification state, or one submitted job's progress with ?jobId=. */
export const GET = studioRoute<Params>(async ({ request, params, userId }) => {
  const jobId = request.nextUrl.searchParams.get('jobId');
  if (jobId) return { job: await verificationJob(userId, params.projectId, params.deploymentId, jobId) };
  return { contracts: await verificationStates(userId, params.projectId, params.deploymentId) };
});

export const POST = studioRoute<Params>(async ({ request, params, userId }) => {
  const { stepId } = await parseBody(request, z.object({ stepId: z.string().min(1).max(64) }));
  const started = await startVerification(userId, params.projectId, params.deploymentId, stepId);
  if (started.status === 'verified') return { status: 'verified', match: started.match };
  after(started.run);
  return { status: 'submitted', jobId: started.jobId };
});
