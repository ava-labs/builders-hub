"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Newspaper, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import { EASE, GLASS } from "@/components/explorer-v2/network/city-frame";

/* The city's corner, where the site's chat button stands on other pages:
   the newest posts from the Avalanche blog and the Builder Hub. Shut, a
   round button with a dot while a post is new to the reader; under the
   pointer, the newest headline beside it; open, the latest eight, each a
   door out. A pane at the right takes the corner (away): the button fades
   out and back, and its list shuts with it. /api/news reads both and keeps
   them for half an hour */

interface NewsItem {
  title: string;
  href: string;
  date: string;
  source: "Avalanche" | "Builder Hub";
  image?: string;
}

const SEEN_KEY = "city-news-seen";
/** a post this recent, not yet opened here, marks the button */
const FRESH_MS = 3 * 86_400_000;

function whenOf(iso: string): string {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

const THUMB = "mt-0.5 h-12 w-[72px] shrink-0 rounded-lg border border-zinc-200/70 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900";
/** the post's picture, small, at the row's left; a post with none, or one that fails to load, keeps the column with a plain tile */
function Thumb({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed)
    return (
      <span aria-hidden className={cn(THUMB, "flex items-center justify-center")}>
        <AvalancheLogo className="h-4 w-4 text-zinc-300 dark:text-zinc-700 [&_path]:fill-current" />
      </span>
    );
  return <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} className={cn(THUMB, "object-cover")} />;
}

function Byline({ item }: { item: NewsItem }) {
  return (
    <span className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
      <span className={item.source === "Avalanche" ? "text-[#E6212F] dark:text-[#FF394A]" : "text-[#0061E2] dark:text-[#5f9dff]"}>{item.source}</span>
      <span aria-hidden>·</span>
      <span>{whenOf(item.date)}</span>
    </span>
  );
}

export function NewsFeed({ className, away = false }: { className?: string; away?: boolean }) {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [open, setOpen] = useState(false);
  const [peek, setPeek] = useState(false);
  const [seen, setSeen] = useState<string | null>(null);
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/news", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((d: { items?: NewsItem[] }) => setItems(d.items ?? []))
      .catch(() => setItems([]));
    try {
      setSeen(localStorage.getItem(SEEN_KEY));
    } catch {}
    return () => controller.abort();
  }, []);

  // Esc and a click outside let it go; Esc stops there, so the city does not step back too
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (card.current && !card.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [open]);

  // stepping away shuts the list and the headline, so neither comes back with the button
  if (away && (open || peek)) {
    setOpen(false);
    setPeek(false);
  }
  if (!items?.length) return null;
  const top = items[0];
  const fresh = seen !== top.href && Date.now() - Date.parse(top.date) < FRESH_MS;
  const show = () => {
    setOpen(true);
    setPeek(false);
    setSeen(top.href);
    try {
      localStorage.setItem(SEEN_KEY, top.href);
    } catch {}
  };

  return (
    <div
      ref={card}
      inert={away || undefined}
      aria-hidden={away || undefined}
      className={cn(
        // visibility flips after the fade, so a button away is out of the tab order and the accessibility tree; it comes back once the pane has gone
        "pointer-events-auto transition-[opacity,translate,visibility] duration-300",
        EASE,
        away ? "pointer-events-none invisible translate-y-2 opacity-0 duration-200" : "delay-150 motion-reduce:delay-0",
        className,
      )}
    >
      {open ? (
        <div role="dialog" aria-label="News" className={cn("w-[340px] overflow-hidden rounded-2xl animate-[bh-fade_160ms_ease-out]", GLASS)}>
          <div className="flex items-center justify-between border-b border-zinc-100 py-2 pl-4 pr-2 dark:border-zinc-900">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">News</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close the news"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <ul className="max-h-[min(26rem,58vh)] overflow-y-auto overscroll-contain">
            {items.map((item) => {
              const out = /^https?:\/\//.test(item.href);
              const row = "group block px-4 py-2.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900";
              const body = (
                <span className="flex items-start gap-3">
                  <Thumb src={item.image} />
                  <span className="min-w-0 flex-1">
                    <Byline item={item} />
                    <span className="mt-0.5 flex items-start gap-1.5">
                      <span className="line-clamp-2 flex-1 text-[13px] font-medium leading-snug text-zinc-900 dark:text-zinc-50">{item.title}</span>
                      {out ? (
                        <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-300 transition-colors group-hover:text-zinc-600 dark:text-zinc-600 dark:group-hover:text-zinc-300" />
                      ) : (
                        <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-300 transition-colors group-hover:text-zinc-600 dark:text-zinc-600 dark:group-hover:text-zinc-300" />
                      )}
                    </span>
                  </span>
                </span>
              );
              return (
                <li key={item.href} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                  {out ? (
                    <a href={item.href} target="_blank" rel="noopener noreferrer" className={row}>
                      {body}
                    </a>
                  ) : (
                    <Link href={item.href} className={row}>
                      {body}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="relative" onPointerEnter={() => setPeek(true)} onPointerLeave={() => setPeek(false)}>
          {/* the newest headline, beside the button while the pointer rests on it */}
          {peek && (
            <div className={cn("pointer-events-none absolute bottom-0 right-[3.75rem] w-[280px] rounded-2xl px-3.5 py-2.5 animate-[bh-fade_160ms_ease-out]", GLASS)}>
              <Byline item={top} />
              <p className="mt-0.5 line-clamp-2 text-[12.5px] font-medium leading-snug text-zinc-900 dark:text-zinc-50">{top.title}</p>
            </div>
          )}
          <button
            type="button"
            onClick={show}
            onFocus={() => setPeek(true)}
            onBlur={() => setPeek(false)}
            aria-label="News from Avalanche and the Builder Hub"
            aria-expanded={false}
            className={cn("relative flex h-12 w-12 items-center justify-center rounded-full transition-colors hover:border-zinc-300 dark:hover:border-zinc-700", GLASS)}
          >
            <Newspaper className="h-5 w-5 text-zinc-700 dark:text-zinc-300" />
            {fresh && <span aria-hidden className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[#E6212F] ring-2 ring-white dark:bg-[#FF394A] dark:ring-zinc-950" />}
          </button>
        </div>
      )}
    </div>
  );
}
