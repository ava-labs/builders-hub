import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/authSession";
import { getHackathon } from "@/server/services/hackathons";
import ApiKeyManager from "@/components/hackathons/admin-panel/sections/ApiKeyManager";

export default async function ApiKeysAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAuthSession();
  const customAttributes: string[] = (session?.user as any)?.custom_attributes ?? [];
  if (!session || !customAttributes.includes("devrel")) {
    redirect("/");
  }

  const { id } = await params;
  const hackathon = await getHackathon(id);
  if (!hackathon) redirect("/events");

  return (
    <main className="container relative px-2 py-4 lg:py-16">
      <div className="border border-zinc-800 shadow-sm bg-zinc-950 rounded-md p-6">
        <h1 className="text-2xl font-semibold mb-1">API keys</h1>
        <p className="text-sm text-zinc-400 mb-6">
          {hackathon.title} — issue scoped read-only keys for partners and judges. They auth
          against <code>/api/events/{hackathon.id}/projects</code> with{" "}
          <code>Authorization: Bearer &lt;secret&gt;</code>.
        </p>
        <ApiKeyManager hackathonId={id} />
      </div>
    </main>
  );
}
