import type { EventsLang } from "@/lib/events/i18n";
import type { HackathonHeader } from "@/types/hackathons";

/** The Build Games hackathon redirects to its own standalone landing page. */
export const BUILD_GAMES_HACKATHON_ID = "249d2911-7931-4aa0-a696-37d8370b79f9";

/** Edit/management page (PR 2 will wire per-event `?id=`; for now it lists events). */
export const EVENTS_EDIT_PATH = "/events/edit";

export const FALLBACK_SMALL_BANNER =
  "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/hackathon-images/hackathon-mock-dgUJCbkFtJZtWgg7zxIAATwEnCntMt.png";
export const FALLBACK_BANNER =
  "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/hackathon-images/main_banner_img-crBsoLT7R07pdstPKvRQkH65yAbpFX.png";

/** Mono "eyebrow" label style shared across the listing components. */
export const EYEBROW =
  "font-mono text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400";

const LOCALE: Record<EventsLang, string> = { en: "en-US", es: "es-ES" };

export function normalizeEventType(event?: string) {
  return (event || "hackathon").toLowerCase();
}

/** Proper-noun event type label (kept identical across locales by design). */
export function typeLabel(event?: string) {
  const type = normalizeEventType(event);
  if (type === "hackathon") return "Hackathon";
  if (type === "workshop") return "Workshop";
  if (type === "bootcamp") return "Bootcamp";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function deriveFormat(location?: string): "Online" | "In person" {
  return (location || "").toLowerCase().includes("online") ? "Online" : "In person";
}

export function formatMoney(n?: number) {
  return n ? `$${n.toLocaleString("en-US")}` : "—";
}

export function fmtDate(value?: string | Date | null, lang: EventsLang = "en") {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(LOCALE[lang], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Compact, deduped date range (e.g. "Mar 3 – 5, 2026" / "Mar 28 – Apr 2, 2026"). */
export function fmtDateRange(
  start?: string | null,
  end?: string | null,
  lang: EventsLang = "en",
) {
  if (!start) return "Date TBD";
  const sa = new Date(start);
  if (isNaN(sa.getTime())) return "Date TBD";
  const sb = end ? new Date(end) : null;
  const loc = LOCALE[lang];
  const md = { month: "short", day: "numeric" } as const;

  if (!sb || isNaN(sb.getTime()) || sa.toDateString() === sb.toDateString()) {
    return sa.toLocaleDateString(loc, { ...md, year: "numeric" });
  }
  const sameMonth =
    sa.getMonth() === sb.getMonth() && sa.getFullYear() === sb.getFullYear();
  if (sameMonth) {
    return `${sa.toLocaleDateString(loc, md)} – ${sb.getDate()}, ${sb.getFullYear()}`;
  }
  return `${sa.toLocaleDateString(loc, md)} – ${sb.toLocaleDateString(loc, md)}, ${sb.getFullYear()}`;
}

/** Resolve where a card/hero should link — preserving the Build Games carve-out. */
export function getEventHref(
  hackathon: Pick<HackathonHeader, "id" | "event" | "custom_link">,
  basePath = "/events",
) {
  if (hackathon.id === BUILD_GAMES_HACKATHON_ID) return "/build-games";
  const type = normalizeEventType(hackathon.event);
  const isWorkshopOrBootcamp = type === "workshop" || type === "bootcamp";
  const defaultPath = isWorkshopOrBootcamp ? "/events" : basePath;
  return hackathon.custom_link || `${defaultPath}/${hackathon.id}`;
}
