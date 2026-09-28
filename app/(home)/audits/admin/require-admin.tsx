import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/authSession";
import { canAdministerAuditProgram } from "@/lib/auth/permissions";

/**
 * Page-level admin gate. The Edge manifest and the layout (layout.tsx) are the
 * normal checks, but Next 16 can render a page segment WITHOUT its ancestor
 * layout when the client sends a crafted next-router-state-tree RSC header
 * (walk-tree-with-flight-router-state.js:53-56, 114-150), so every admin page
 * re-asserts the role before it reads anything.
 *
 * Redirects like the layout and the manifest do, so all three layers agree;
 * only a bypass attempt ever reaches this redirect.
 */
export async function denyIfNotAuditAdmin(): Promise<void> {
  const session = await getAuthSession();
  if (!session?.user || !canAdministerAuditProgram(session)) redirect("/audits");
}
