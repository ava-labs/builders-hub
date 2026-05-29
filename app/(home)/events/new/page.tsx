import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/authSession";
import { hasHackathonAdminRole } from "@/lib/auth/roles";

export default async function NewHackathonPage() {
  const session = await getAuthSession();

  if (!session || !hasHackathonAdminRole(session.user?.custom_attributes)) {
    redirect("/");
  }

  redirect("/events/edit");
}
