import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/authSession";
import HackathonForm from "@/components/hackathons/admin-panel/HackathonForm";

export default async function NewHackathonPage() {
  const session = await getAuthSession();

  const customAttributes: string[] = (session?.user as any)?.custom_attributes ?? [];
  if (!session || !customAttributes.includes("devrel")) {
    redirect("/");
  }

  return (
    <main className='container  relative px-2 py-4 lg:py-16'>
      <div className='border border-zinc-800 shadow-sm bg-zinc-950 rounded-md'>
        <HackathonForm />
      </div>
    </main>
  );
}
