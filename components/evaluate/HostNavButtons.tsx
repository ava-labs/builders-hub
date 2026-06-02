import Link from "next/link";
import { getAuthSession } from "@/lib/auth/authSession";
import {
  canEvaluateHackathon,
  canManageHackathonJudges,
} from "@/lib/auth/permissions";
import { Gavel, ClipboardCheck } from "lucide-react";

type Props = {
  hackathonId: string;
};

const BUTTON_CLASS =
  "flex items-center gap-2 px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer";

export async function HostNavButtons({ hackathonId }: Props) {
  const session = await getAuthSession();
  if (!session?.user) return null;

  const [canManage, canEvaluate] = await Promise.all([
    Promise.resolve(canManageHackathonJudges(session)),
    canEvaluateHackathon(session, hackathonId),
  ]);

  if (!canManage && !canEvaluate) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
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
