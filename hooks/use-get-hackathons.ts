import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";

export function useGetHackathons(): any {
  const [data, setData] = useState<{id: string, title: string}[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHackathons = async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const json = await apiFetch<{ hackathons?: { id: string; title: string }[] }>(
        `/api/hackathons`
      );
      setData(json?.hackathons ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHackathons();
  }, []);

  return { data, loading, error, refetch: fetchHackathons };
}
