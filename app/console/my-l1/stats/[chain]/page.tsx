import { redirect } from 'next/navigation';

// The dedicated stats page has been folded into the My L1 dashboard
// itself — live charts now render under the "Live activity" section on
// /console/my-l1. Any external bookmarks land here; bounce them to the
// dashboard with the chain selector pre-set so the destination L1 is
// the one the user expected.
export default async function StatsRedirect({
  params,
}: {
  params: Promise<{ chain: string }>;
}) {
  const { chain } = await params;
  redirect(`/console/my-l1?chain=${encodeURIComponent(chain)}`);
}
