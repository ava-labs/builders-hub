import { useEffect, useMemo, useState } from "react";

export type DbNotification = {
  id: number;
  audience: string;
  type: string;
  title: string;
  content: string;
  content_type: string;
  short_description: string;
  template: string;
  status: string;
};

export type NotificationsResponse = {
  [user: string]: DbNotification[];
};

type UseNotificationsResult = {
  data: NotificationsResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function useGetNotifications(
  users: string[],
  jwt: string | null
): UseNotificationsResult {
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const usersKey: string = useMemo(() => JSON.stringify(users), [users]);

  const fetchNotifications = async (): Promise<void> => {
    if (users.length === 0) {
      setData({});
      return;
    }

    if (!jwt) {
      setError("Missing authorization token");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response: Response = await fetch(
        `/api/notifications/get`,
        {
          method: "POST",
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

      const json: NotificationsResponse =
        (await response.json()) as NotificationsResponse;

      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usersKey, jwt]);

  return { data, loading, error, refetch: fetchNotifications };
}