import { getAuthSession } from "@/lib/auth/authSession";
import { canAdministerAuditProgram } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/ui/access-denied";

/**
 * Page-level admin gate. The layout (layout.tsx:9-18) is the normal check,
 * but Next 16 can render a page segment WITHOUT its ancestor layout when the
 * client sends a crafted next-router-state-tree RSC header
 * (walk-tree-with-flight-router-state.js:53-56, 114-150), so every admin page
 * re-asserts the role before it reads anything.
 *
 * Returns AccessDenied to render-and-return when the caller is not an audit
 * admin, else null. Returning a node (rather than redirect/notFound) keeps the
 * fix out of the layout's children-discarding and boundary semantics: in a
 * normal non-admin render the layout already returns AccessDenied and drops
 * children, so this only ever renders alone on a bypass attempt.
 */
export async function denyIfNotAuditAdmin(): Promise<React.ReactNode | null> {
  const session = await getAuthSession();
  if (!session?.user || !canAdministerAuditProgram(session)) {
    return (
      <AccessDenied message="You need the audit program admin role to view this area." />
    );
  }
  return null;
}
