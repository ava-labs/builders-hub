import { BadgeCategory } from "@/server/services/badge";
import { Badge } from "@/types/badge";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { apiFetch } from "@/lib/api/client";

interface AssignBadgeResult {
  success: boolean;
  message: string;
  badge_id: string;
  user_id: string;
  badges: any[];
}

export const useBadgeAward = (courseId: string) => {
  let session = null;
  try {
    const { data } = useSession();
    session = data;
  } catch {
    // SessionProvider not available — badge award will be disabled
  }

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAwarded, setIsAwarded] = useState(false);

  const awardBadge = async () => {
    if (!session?.user?.id) {
      setError("User not authenticated");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await apiFetch<AssignBadgeResult>("/api/badge/assign", {
        method: "POST",
        body: {
          courseId,
          userId: session.user.id,
          category: BadgeCategory.academy,
        },
      });
      if (data.success) {
        setIsAwarded(true);
      }
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const getBadge = async (courseId: string): Promise<Badge> => {
    const data = await apiFetch<Badge>(`/api/badge?course_id=${courseId}`);
    return data;
  };

  return {
    session,
    awardBadge,
    getBadge,
    isLoading,
    error,
    isAwarded,
    isAuthenticated: !!session?.user?.id,
  };
};
