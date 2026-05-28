import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/authSession";
import { hasHackathonAdminRole } from "@/lib/auth/roles";
import HackathonForm from "@/components/hackathons/admin-panel/HackathonForm";

export default async function NewHackathonPage() {
  const session = await getAuthSession();

  if (!session || !hasHackathonAdminRole(session.user?.custom_attributes)) {
    redirect("/");
  }

  return (
    <main className='container relative px-2 py-4 lg:py-16'>
      <div className='border border-border shadow-sm bg-background rounded-md'>
        <HackathonForm />
      </div>
    </main>
  );
}
