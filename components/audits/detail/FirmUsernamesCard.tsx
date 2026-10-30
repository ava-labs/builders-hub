import { cn } from "@/lib/utils";
import { GITHUB_ACCESS_LIMITS, GITHUB_PROFILE_WARNING } from "@/lib/audits/constants";
import { githubProfileUrl } from "@/types/audits";
import type { FirmUsernames } from "@/server/services/audits/visibility";
import { CARD, MONO_LABEL_SM } from "@/components/audits/shared/classes";

// The Team emails list recipe (FirmDetails.tsx), one row per firm.
const LIST =
  "mt-3.5 divide-y divide-zinc-200 rounded-[10px] border border-zinc-200 dark:divide-white/[0.08] dark:border-white/10";
const ROW =
  "grid gap-x-4 gap-y-0.5 px-3.5 py-2.5 sm:grid-cols-[200px_minmax(0,1fr)] sm:items-baseline";
const SMALL = "text-xs leading-relaxed text-zinc-500 dark:text-zinc-400";

/** Each username links to the profile the project opens before it invites.
    A link stays whole on its line, so a username splits at its hyphen only
    when it is wider than the line itself (a valid 39-character one at 375). */
export function GithubUsernameLinks({
  usernames,
  className,
}: {
  usernames: string[];
  className?: string;
}) {
  return (
    <>
      {usernames.map((name, index) => (
        <span key={name}>
          {index > 0 ? " · " : null}
          <a href={githubProfileUrl(name)} target="_blank" rel="noopener noreferrer" className={cn("inline-block max-w-full [overflow-wrap:anywhere] underline underline-offset-2", className)}>
            {name}
          </a>
        </span>
      ))}
    </>
  );
}

/**
 * The firms a collecting request reached, each with its people's GitHub
 * usernames, so the project can add them to private repos before they quote
 * (FDE-249 step 2). Firms with usernames come first; the rest share one row,
 * so a long whitelist does not bury the rows a project can act on.
 */
export function FirmUsernamesCard({ firms }: { firms: FirmUsernames[] }) {
  const named = firms.filter((firm) => firm.github_usernames.length > 0);
  const unnamed = firms.filter((firm) => firm.github_usernames.length === 0);

  return (
    <div className={cn(CARD, "p-5")}>
      <p className={MONO_LABEL_SM}>GitHub usernames · firms this request reached</p>
      <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
        Private repo? Add the firms you want quotes from as collaborators, so they can read the
        code before they quote.
      </p>
      {named.length > 0 ? null : (
        <p className="mt-3.5 text-sm text-zinc-700 dark:text-zinc-300">
          None of these firms has added a GitHub username yet. Any they add while quotes are open
          appear here.
        </p>
      )}
      <ul className={LIST}>
        {named.map((firm) => (
          <li key={firm.id} className={ROW}>
            <p className="text-sm font-medium">{firm.firm_name}</p>
            <p className="font-mono text-[13px]">
              <GithubUsernameLinks usernames={firm.github_usernames} />
            </p>
          </li>
        ))}
        {unnamed.length > 0 ? (
          <li className={ROW}>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {named.length > 0 ? "No username yet" : "Firms"}
            </p>
            <p className="text-sm text-zinc-600 dark:text-[#A2AFB2]">
              {unnamed.map((firm) => firm.firm_name).join(" · ")}
            </p>
          </li>
        ) : null}
      </ul>
      {named.length > 0 ? <p className={cn(SMALL, "mt-2.5")}>{GITHUB_PROFILE_WARNING}</p> : null}
      <p className={cn(SMALL, named.length > 0 ? "mt-1" : "mt-2.5")}>{GITHUB_ACCESS_LIMITS}</p>
    </div>
  );
}
