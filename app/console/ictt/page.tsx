import { BridgeConsole } from './_components/bridge-console';
import type { PhaseId } from './_components/types';

const VALID_PHASES: PhaseId[] = ['token', 'home', 'remote', 'register', 'collateral', 'transfer'];

interface PageProps {
  searchParams?: Promise<{ phase?: string }>;
}

/**
 * Single-page entry for the ICTT Bridge Console. Replaces the legacy
 * `/console/ictt/setup/[step]` and `/console/ictt/token-transfer/[step]`
 * wizards. Old URLs 301-redirect here with `?phase=…` deep links.
 *
 * The negative margins reach back through the parent console layout's
 * padding so the console fills the full content area edge-to-edge,
 * matching the design's full-bleed top bar / phase strip.
 */
export default async function Page({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const initialPhase =
    params.phase && VALID_PHASES.includes(params.phase as PhaseId) ? (params.phase as PhaseId) : undefined;

  return (
    <div className="-mx-4 md:-mx-8 -mt-4 md:-mt-8 min-h-[calc(100vh-3rem)] flex">
      <div className="flex-1 flex">
        <BridgeConsole initialPhase={initialPhase} />
      </div>
    </div>
  );
}
