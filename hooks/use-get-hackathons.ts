import { useEffect, useState } from "react";

export function useGetHackathons(): any {
  const [data, setData] = useState<{id: string, title: string}[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);


  const fetchNotifications = async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {

      const response: Response = await fetch(
        `/api/hackathons`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
        }
      );

      if (!response.ok) {
        const text: string = await response.text();
        throw new Error(text || "Failed to fetch notifications");
      }

      const json = (await response.json());

      setData(json?.hackathons ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  return { data, loading, error, refetch: fetchNotifications };
}