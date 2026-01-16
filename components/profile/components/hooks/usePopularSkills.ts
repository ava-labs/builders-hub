import { useState, useEffect, useMemo } from "react";

interface PopularSkill {
  name: string;
  usageCount: number;
}

/**
 * Hook to fetch popular skills sorted by usage
 * Fetches data from API that queries the users table
 */
export function usePopularSkills() {
  const [popularSkills, setPopularSkills] = useState<PopularSkill[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPopularSkills = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch('/api/profile/popular-skills');
        
        if (!response.ok) {
          throw new Error(`Error fetching popular skills: ${response.statusText}`);
        }
        
        const data = await response.json();
        setPopularSkills(data);
      } catch (err) {
        console.error('Error loading popular skills:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setPopularSkills([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPopularSkills();
  }, []);

  /**
   * Search skills matching the query and sort by popularity
   */
  const searchSkills = useMemo(() => {
    return (query: string, excludeSkills: string[] = []): PopularSkill[] => {
      if (!query.trim()) {
        return popularSkills
          .filter(skill => !excludeSkills.includes(skill.name))
          .slice(0, 10);
      }

      const lowerQuery = query.toLowerCase().trim();
      
      return popularSkills
        .filter(skill => {
          const skillLower = skill.name.toLowerCase();
          return (
            skillLower.includes(lowerQuery) &&
            !excludeSkills.includes(skill.name)
          );
        })
        .sort((a, b) => {
          const aStartsWith = a.name.toLowerCase().startsWith(lowerQuery);
          const bStartsWith = b.name.toLowerCase().startsWith(lowerQuery);
          
          if (aStartsWith && !bStartsWith) return -1;
          if (!aStartsWith && bStartsWith) return 1;
          
          return b.usageCount - a.usageCount;
        })
        .slice(0, 10);
    };
  }, [popularSkills]);

  return {
    popularSkills,
    isLoading,
    error,
    searchSkills,
  };
}

