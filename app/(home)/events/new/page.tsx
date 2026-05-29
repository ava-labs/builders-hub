import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/authSession";
import { hasHackathonAdminRole } from "@/lib/auth/roles";

export default async function NewHackathonPage() {
  const session = await getAuthSession();

  if (!session || !hasHackathonAdminRole(session.user?.custom_attributes)) {
    redirect("/");
  }

  // The standalone HackathonForm create path cannot satisfy the API: it sends a
  // minimal payload while POST /api/events and createHackathon require tags,
  // icon, banner, small_banner, total_prizes, participants, timezone, etc.
  // Route creation through the full-featured editor, which already supports the
  // create case (POST with the complete payload) and has its own role gate.
  redirect("/events/edit");
}
