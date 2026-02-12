import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useConsoleBadgeNotificationStore } from "@/components/toolbox/stores/consoleBadgeNotificationStore";

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

    fetch("/api/badge/console-check", { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        if (data.awardedBadges?.length > 0) {
          addBadges(data.awardedBadges);
        }
      })
      .catch(() => {
        // Silently fail — badges will be evaluated on next relevant action
      });
  }, [status, session?.user?.id, addBadges]);
}
