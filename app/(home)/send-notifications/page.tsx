import { redirect } from "next/navigation";

export default function SendNotificationsPage() {
  redirect("/profile?tab=notifications");
}
