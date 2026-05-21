"use client";

import { useEffect } from "react";
import { usePostHog } from "posthog-js/react";

interface HackathonPageviewTagProps {
  hackathonId: string;
  hackathonName?: string;
}

/**
 * Registers hackathon context as sticky session properties so every PostHog
 * event fired while the visitor is on a hackathon-scoped page (pageviews,
 * autocaptures, form interactions) carries `hackathon_id` and, when known,
 * `hackathon_name`. Powers per-event traffic-source analytics without any
 * extra capture calls.
 */
export default function HackathonPageviewTag({
  hackathonId,
  hackathonName,
}: HackathonPageviewTagProps) {
  const posthog = usePostHog();

  useEffect(() => {
    if (!posthog || !hackathonId) return;

    const props: Record<string, string> = { hackathon_id: hackathonId };
    if (hackathonName) props.hackathon_name = hackathonName;

    posthog.register(props);

    return () => {
      posthog.unregister("hackathon_id");
      posthog.unregister("hackathon_name");
    };
  }, [posthog, hackathonId, hackathonName]);

  return null;
}
