import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/authSession";
import { hasPermission } from "@/lib/auth/rolePermissions";
import { AuthLoading } from "@/components/ui/auth-loading";
import { UserRolesManager } from "@/components/admin/UserRolesManager";

export default async function AdminRolesPage() {
  const session = await getAuthSession();
  if (!session?.user) return <AuthLoading />;
  if (!hasPermission(session, { resource: "user", action: "manage" })) {
    redirect("/");
  }

  return (
    <main className="container relative max-w-[1400px] px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          User roles
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Grant and revoke platform roles. Roles take effect when the
          user&apos;s session token next refreshes - tell them to sign out and
          back in if they need it immediately.
        </p>
        <div className="mt-6">
          <UserRolesManager />
        </div>
      </div>
    </main>
  );
}
