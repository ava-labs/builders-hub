import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/prisma/prisma";
import { getAuthSession } from "@/lib/auth/authSession";
import { canViewEventRegistrations } from "@/lib/auth/permissions";
import { getRegistrationsByHackathon } from "@/server/services/registerForms";
import { formatTeamLabel } from "@/lib/referrals/team-labels";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

export default async function EventRegistrationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getAuthSession();
  if (!session || !(await canViewEventRegistrations(session, id))) {
    redirect("/");
  }

  const hackathon = await prisma.hackathon.findUnique({
    where: { id },
    select: { title: true },
  });
  if (!hackathon) redirect("/events");

  const registrations = await getRegistrationsByHackathon(id);

  return (
    <main className="container relative px-2 py-4 lg:py-16">
      <Link
        href={`/events/${id}`}
        className="mb-4 inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ArrowLeft size={16} />
        Back to the event
      </Link>
      <h1 className="text-2xl font-semibold">Registrations</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {hackathon.title} — {registrations.length} registered
      </p>

      {registrations.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500 dark:text-zinc-400">
          No registrations yet.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">City</th>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Telegram</th>
                <th className="px-4 py-3 font-medium">Referrer</th>
                <th className="px-4 py-3 font-medium">Referrer team</th>
                <th className="px-4 py-3 font-medium">Registered</th>
              </tr>
            </thead>
            <tbody>
              {registrations.map((registration) => (
                <tr
                  key={registration.id}
                  className="border-b border-zinc-200 last:border-0 dark:border-zinc-800"
                >
                  <td className="max-w-48 truncate px-4 py-3">
                    {registration.name}
                  </td>
                  <td className="max-w-64 truncate px-4 py-3">
                    {registration.email}
                  </td>
                  <td className="max-w-40 truncate px-4 py-3">
                    {registration.city}
                  </td>
                  <td className="max-w-40 truncate px-4 py-3">
                    {registration.company_name ?? "—"}
                  </td>
                  <td className="max-w-40 truncate px-4 py-3">
                    {registration.role}
                  </td>
                  <td className="max-w-40 truncate px-4 py-3">
                    {registration.telegram_account ?? "—"}
                  </td>
                  <td className="max-w-48 truncate px-4 py-3">
                    {registration.referrer_name ?? "—"}
                  </td>
                  <td className="max-w-40 truncate px-4 py-3">
                    {formatTeamLabel(
                      registration.referrer_team,
                      registration.referrer_team_other,
                    ) ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {dateFormat.format(registration.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
