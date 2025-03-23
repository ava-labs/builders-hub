import HackathonForm from "@/components/hackathons/admin-panel/HackathonForm";

export default function NewHackathonPage() {
  return (
    <main className='container  relative px-2 py-4 lg:py-16'>
      <div className='border border-zinc-800 shadow-sm bg-zinc-950 rounded-md'>
        <HackathonForm />
      </div>
    </main>
  );
}
