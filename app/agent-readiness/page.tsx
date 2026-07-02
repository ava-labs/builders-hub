import type { Metadata } from 'next';
import AgentReadinessClient from './client';

// Internal diagnostics page for the Agent Score work — kept out of search.
export const metadata: Metadata = {
  title: 'AI-Readiness Check',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <AgentReadinessClient />;
}
