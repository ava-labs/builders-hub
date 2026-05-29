import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  MapPin,
  Pencil,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type EventsLang, t } from "@/lib/events/i18n";
import type { HackathonHeader, HackathonStatus } from "@/types/hackathons";
import {
  BUILD_GAMES_HACKATHON_ID,
  EVENTS_EDIT_PATH,
  EYEBROW,
  FALLBACK_SMALL_BANNER,
  deriveFormat,
  fmtDateRange,
  formatMoney,
  getEventHref,
  normalizeEventType,
  typeLabel,
} from "./utils";

function StatusChip({ status, lang }: { status: HackathonStatus; lang: EventsLang }) {
  const map: Record<HackathonStatus, { label: string; dot: string }> = {
    ONGOING: { label: t(lang, "events.chip.liveNow"), dot: "bg-green-500" },
    UPCOMING: { label: t(lang, "events.chip.upcoming"), dot: "bg-amber-500" },
    ENDED: { label: t(lang, "events.chip.ended"), dot: "bg-zinc-400" },
  };
  const s = map[status] ?? map.UPCOMING;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-zinc-700 ring-1 ring-black/5 backdrop-blur dark:bg-zinc-900/85 dark:text-zinc-200 dark:ring-white/10">
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

function Stat({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
      <span className="shrink-0 text-zinc-400 dark:text-zinc-500 [&_svg]:h-4 [&_svg]:w-4">
        {icon}
      </span>
      <span className="truncate">{children}</span>
    </div>
  );
}

type Props = {
  hackathon: HackathonHeader;
  lang: EventsLang;
  isCreator?: boolean;
  basePath?: string;
};

export default function EventCard({
  hackathon,
  lang,
  isCreator = false,
  basePath = "/events",
}: Props) {
  const isPast = hackathon.status === "ENDED";
  const eventType = normalizeEventType(hackathon.event);
  const isHackathon = eventType === "hackathon";
  const href = getEventHref(hackathon, basePath);
  // custom_link events open in a new tab (Build Games is handled by getEventHref).
  const isExternal =
    Boolean(hackathon.custom_link) && hackathon.id !== BUILD_GAMES_HACKATHON_ID;
  const target = isExternal ? "_blank" : "_self";
  const cover =
    hackathon.small_banner?.trim().length > 0
      ? hackathon.small_banner
      : FALLBACK_SMALL_BANNER;
  const format = deriveFormat(hackathon.location);
  const participants = hackathon.participants ?? 0;
  const tags = hackathon.tags ?? [];

  return (
    <div
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-all duration-200 hover:shadow-lg dark:bg-zinc-900",
        isPast
          ? "border-zinc-200 dark:border-zinc-800/80"
          : "border-zinc-200 dark:border-zinc-800",
      )}
    >
      {/* Cover */}
      <Link
        href={href}
        target={target}
        className="relative block aspect-[16/9] overflow-hidden"
      >
        <Image
          src={cover}
          alt={hackathon.title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          className={cn(
            "object-cover transition-transform duration-300 group-hover:scale-[1.04]",
            isPast && "opacity-90 grayscale-[0.2]",
          )}
        />
        <div className="absolute left-3 top-3">
          <StatusChip status={hackathon.status ?? "UPCOMING"} lang={lang} />
        </div>
        {hackathon.top_most && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-red-500 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-white">
            <Sparkles className="h-3 w-3" />
            {t(lang, "events.chip.featured")}
          </span>
        )}
      </Link>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className={EYEBROW}>
            {typeLabel(eventType)} · {format}
          </span>
          {hackathon.is_public === false && (
            <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              {t(lang, "events.chip.private")}
            </span>
          )}
        </div>

        <Link href={href} target={target}>
          <h3 className="line-clamp-1 text-[15px] font-medium text-zinc-900 transition-colors group-hover:text-red-500 dark:text-zinc-50">
            {hackathon.title}
          </h3>
        </Link>

        <p className="line-clamp-2 min-h-[2.5rem] text-sm font-light text-zinc-600 dark:text-zinc-400">
          {hackathon.description}
        </p>

        {/* Stats panel */}
        <div className="mt-1 grid grid-cols-1 gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40 sm:grid-cols-2">
          <Stat icon={<Calendar />}>
            {fmtDateRange(hackathon.start_date, hackathon.end_date, lang)}
          </Stat>
          <Stat icon={<MapPin />}>{hackathon.location || "—"}</Stat>
          {isHackathon && (hackathon.total_prizes ?? 0) > 0 && (
            <Stat icon={<Trophy />}>
              <b className="font-semibold text-zinc-900 dark:text-zinc-100">
                {formatMoney(hackathon.total_prizes)}
              </b>{" "}
              {t(lang, "events.totalPrizes")}
            </Stat>
          )}
          {participants > 0 && (
            <Stat icon={<Users />}>
              <b className="font-semibold text-zinc-900 dark:text-zinc-100">
                {participants.toLocaleString()}
              </b>{" "}
              {isPast ? t(lang, "events.attended") : t(lang, "events.registered")}
            </Stat>
          )}
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-end justify-between gap-3 pt-2">
          <div className="min-w-0">
            <div className={EYEBROW}>{t(lang, "events.organizedBy")}</div>
            <div className="mt-0.5 truncate text-sm text-zinc-700 dark:text-zinc-300">
              {hackathon.organizers || "Avalanche"}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isCreator && (
              <Button asChild variant="outline" size="sm">
                <Link href={EVENTS_EDIT_PATH}>
                  <Pencil className="h-3.5 w-3.5" />
                  {t(lang, "events.edit")}
                </Link>
              </Button>
            )}
            <Button asChild variant="red" size="sm">
              <Link href={href} target={target}>
                {isPast ? t(lang, "events.recap") : t(lang, "events.learnMore")}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
