import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ExternalLink, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type EventsLang, t } from "@/lib/events/i18n";
import type { HackathonHeader } from "@/types/hackathons";
import {
  BUILD_GAMES_HACKATHON_ID,
  EVENTS_EDIT_PATH,
  EYEBROW,
  FALLBACK_BANNER,
  deriveFormat,
  fmtDateRange,
  formatMoney,
  getEventHref,
  normalizeEventType,
  typeLabel,
} from "./utils";

function HeroStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className={EYEBROW}>{label}</span>
      <span
        className={cn(
          "text-sm font-medium",
          accent ? "text-red-500" : "text-zinc-900 dark:text-zinc-100",
        )}
      >
        {value}
      </span>
    </div>
  );
}

type Props = {
  hackathon: HackathonHeader;
  lang: EventsLang;
  isCreator?: boolean;
};

export default function HeroBanner({ hackathon, lang, isCreator = false }: Props) {
  const eventType = normalizeEventType(hackathon.event);
  const isHackathon = eventType === "hackathon";
  const isPast = hackathon.status === "ENDED";
  const href = getEventHref(hackathon);
  const isExternal =
    Boolean(hackathon.custom_link) && hackathon.id !== BUILD_GAMES_HACKATHON_ID;
  const target = isExternal ? "_blank" : "_self";
  const banner =
    hackathon.banner?.trim().length > 0 ? hackathon.banner : FALLBACK_BANNER;
  const hasPrizes = isHackathon && (hackathon.total_prizes ?? 0) > 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="grid lg:grid-cols-2">
        {/* Art */}
        <Link
          href={href}
          target={target}
          className="relative block aspect-[16/10] overflow-hidden lg:aspect-auto lg:min-h-[440px]"
        >
          <Image
            src={banner}
            alt={hackathon.title}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
            priority
          />
        </Link>

        {/* Meta */}
        <div className="flex flex-col justify-center gap-5 p-6 lg:p-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              {t(lang, "events.chip.featured")} · {typeLabel(eventType)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  hackathon.status === "ONGOING" ? "bg-green-500" : "bg-amber-500",
                )}
              />
              {hackathon.status === "ONGOING"
                ? t(lang, "events.chip.liveNow")
                : t(lang, "events.chip.upcoming")}
            </span>
          </div>

          <h2 className="text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50 lg:text-3xl">
            {hackathon.title}
          </h2>

          {hackathon.description && (
            <p className="line-clamp-3 max-w-xl text-sm font-light leading-relaxed text-zinc-600 dark:text-zinc-400">
              {hackathon.description}
            </p>
          )}

          <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-zinc-200 pt-5 dark:border-zinc-800">
            <HeroStat
              label={t(lang, "events.stats.when")}
              value={fmtDateRange(hackathon.start_date, hackathon.end_date, lang)}
            />
            <HeroStat
              label={t(lang, "events.stats.where")}
              value={hackathon.location || "—"}
            />
            {hasPrizes ? (
              <HeroStat
                label={t(lang, "events.stats.prizes")}
                value={formatMoney(hackathon.total_prizes)}
                accent
              />
            ) : (
              <HeroStat
                label="Format"
                value={deriveFormat(hackathon.location)}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button asChild variant="red">
              <Link href={href} target={target}>
                {isPast ? t(lang, "events.recap") : t(lang, "events.register")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={href} target={target}>
                <ExternalLink className="h-4 w-4" />
                {t(lang, "events.viewPage")}
              </Link>
            </Button>
            {isCreator && (
              <Button asChild variant="ghost">
                <Link href={EVENTS_EDIT_PATH}>
                  <Pencil className="h-4 w-4" />
                  {t(lang, "events.edit")}
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
