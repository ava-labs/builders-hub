
import { getBadgeByCourseId } from "@/server/services/rewardBoard";
import { Badge } from "@/types/badge";
import { useSession } from "next-auth/react";
import { useState } from "react";

export const useBadgeAward = (courseId: string) => {
  // Usar try-catch para manejar el error de SessionProvider
  let session = null;
  try {
    const { data } = useSession();
 
    session = data;
  } catch (error) {
    console.log("Error obteniendo la sesión",error);
    // Si no hay SessionProvider, session será null
    console.warn('SessionProvider not available, badge award will be disabled');
  }

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAwarded, setIsAwarded] = useState(false);
  
  const awardBadge = async () => {
    // Si no hay sesión, no hacer nada
    if (!session?.user?.id) {
      setError('User not authenticated');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      return;
      const response = await fetch('/api/award-badge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ courseId, userId: session.user.id })
      });
      
      if (!response.ok) {
        throw new Error('Failed to award badge');
      }
      
      setIsAwarded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const getBadge = async (courseId: string):Promise<Badge> => {
    const response = await fetch(`/api/badge?course_id=${courseId}`);
    const data = await response.json();
    return data as Badge;
  };

  return { 
    session, 
    awardBadge,
    getBadge,
    isLoading, 
    error, 
    isAwarded,
    isAuthenticated: !!session?.user?.id 
  };
};