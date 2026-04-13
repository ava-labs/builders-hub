import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useConsoleBadgeNotificationStore } from "@/components/toolbox/stores/consoleBadgeNotificationStore";
import { apiFetch } from "@/lib/api/client";

interface ConsoleBadgeCheckResult {
  awardedBadges: any[];
}

export function useRetroactiveConsoleBadges() {
  const { data: session, status } = useSession();
  const addBadges = useConsoleBadgeNotificationStore((s) => s.addBadges);

  useEffect(() => {
    if (status !== "authenticated") return;

    const userId = session?.user?.id;
    if (!userId) return;

    const key = `console_badges_checked_${userId}`;
    if (localStorage.getItem(key)) return;

    localStorage.setItem(key, "1");

    apiFetch<ConsoleBadgeCheckResult>("/api/badge/console-check", {
      method: "POST",
      body: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    })
      .then((data) => {
        if (data.awardedBadges?.length > 0) {
          addBadges(data.awardedBadges, true);
        }
      })
      .catch(() => {
        // Silently fail — badges will be evaluated on next relevant action
      });
  }, [status, session?.user?.id, addBadges]);
}
