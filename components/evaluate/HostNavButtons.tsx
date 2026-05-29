import Link from "next/link";
import { getAuthSession } from "@/lib/auth/authSession";
import {
  canEvaluateHackathon,
  canManageHackathonJudges,
  canManageHackathons,
} from "@/lib/auth/permissions";
import { Gavel, ClipboardCheck, Settings } from "lucide-react";

type Props = {
  hackathonId: string;
};

const BUTTON_CLASS =
  "flex items-center gap-2 px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer";

export async function HostNavButtons({ hackathonId }: Props) {
  const session = await getAuthSession();
  if (!session?.user) return null;

  const [canManage, canEvaluate, canEditEvent] = await Promise.all([
    Promise.resolve(canManageHackathonJudges(session)),
    canEvaluateHackathon(session, hackathonId),
    Promise.resolve(canManageHackathons(session)),
  ]);

  if (!canManage && !canEvaluate && !canEditEvent) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canEditEvent && (
        <Link
          href={`/events/edit?event=${hackathonId}`}
          className={BUTTON_CLASS}
        >
          <Settings size={16} />
          Edit Event
        </Link>
      )}
      {canManage && (
        <Link
          href={`/events/${hackathonId}/admin-panel/judges`}
          className={BUTTON_CLASS}
        >
          <Gavel size={16} />
          Judges
        </Link>
      )}
      {canEvaluate && (
        <Link
          href={`/events/${hackathonId}/evaluate`}
          className={BUTTON_CLASS}
        >
          <ClipboardCheck size={16} />
          Evaluate
        </Link>
      )}
    </div>
  );
}
