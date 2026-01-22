import { Notification } from "@/types/notifications";

export async function sendNotifications(notifications: Notification[]) {
  try {
    const response: Response = await fetch(`/api/notifications/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        notifications: notifications
      }),
    });

    if (!response.ok) {
      const text: string = await response.text();
      throw new Error(text || "Failed to create notifications");
    }
  } catch (err: unknown) {
    console.error(err);
  }
}
