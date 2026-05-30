import { Notification } from "@/types/notifications";

export async function sendNotifications(
  notifications: Notification[],
): Promise<{
  success: boolean;
  error?: string
}> {
  try {
    const response: Response = await fetch(`/api/notifications/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        notifications: notifications,
      }),
    });
    if (!response.ok) {
      return { success: false };
    }
    return { success: true };
  } catch (err: unknown) {
    return { success: false };
  }
}
