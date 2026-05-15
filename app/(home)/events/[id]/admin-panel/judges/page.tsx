import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/authSession";
import { prisma } from "@/prisma/prisma";
import { canManageHackathonJudges } from "@/lib/auth/permissions";
import { JudgesManager } from "@/components/evaluate/JudgesManager";

export default async function HackathonJudgesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAuthSession();
  if (!canManageHackathonJudges(session)) {
    redirect("/");
  }

  const { id: hackathonId } = await params;
  const hackathon = await prisma.hackathon.findUnique({
    where: { id: hackathonId },
    select: { id: true, title: true, start_date: true, end_date: true },
  });
  if (!hackathon) {
    redirect("/events");
  }

  const judges = await prisma.hackathonJudge.findMany({
    where: { hackathon_id: hackathonId },
    orderBy: { assigned_at: "asc" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          user_name: true,
          custom_attributes: true,
        },
      },
    },
  });

  return (
    <main className="container relative px-4 py-8 lg:py-16">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Judges
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Manage judges for{" "}
          <span className="text-zinc-800 dark:text-zinc-200">
            {hackathon.title}
          </span>
          . Judges can view this hackathon&apos;s projects in the evaluate
          dashboard and submit a score + comment per project.
        </p>
      </div>
      <JudgesManager
        hackathonId={hackathon.id}
        initialJudges={judges.map((j) => ({
          id: j.id,
          assigned_at: j.assigned_at.toISOString(),
          user: j.user,
        }))}
      />
    </main>
  );
}
