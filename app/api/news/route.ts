import { NextResponse } from "next/server";
import { blog } from "@/lib/source";

/* The city's news: the official Avalanche blog and the Builder Hub's own
   posts, newest first. The Avalanche blog publishes no feed, so its page
   is read for its cards (title, date, link); X gives no feed without its
   paid API, so posts there are not read. The page is read at most once a
   half hour per instance, and a failed read keeps the last good cards */

export const dynamic = "force-static";
export const revalidate = 1800;

export interface NewsItem {
  title: string;
  href: string;
  /** ISO date */
  date: string;
  source: "Avalanche" | "Builder Hub";
  /** the post's picture: the blog card's own, or a Builder Hub post's social image */
  image?: string;
}

const BLOG = "https://www.avalanche.com/about/blog";
const TTL_MS = 30 * 60 * 1000;
const SHOWN = 8;
let kept: { at: number; official: NewsItem[] } | null = null;

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", ndash: "–", hellip: "…" };
function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}
const textOf = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/* a card's picture: the smallest in its srcset, else its src, made absolute on the blog's site */
function pictureOf(card: string): string | undefined {
  const img = card.match(/<img\b[^>]*>/)?.[0];
  if (!img) return undefined;
  const set = img.match(/\ssrcset="([^"]+)"/)?.[1];
  const smallest = set
    ? decode(set)
        .split(",")
        .map((c) => c.trim().split(/\s+/))
        .filter((c) => c[0])
        .sort((a, b) => (parseInt(a[1] ?? "", 10) || Infinity) - (parseInt(b[1] ?? "", 10) || Infinity))[0]?.[0]
    : undefined;
  const src = smallest ?? decode(img.match(/\ssrc="([^"]+)"/)?.[1] ?? "");
  try {
    return src ? new URL(src, "https://www.avalanche.com").toString() : undefined;
  } catch {
    return undefined;
  }
}

/* the blog's cards: a link to a post holding its title (a heading) and a line that starts with its date, month.day.year */
async function official(): Promise<NewsItem[]> {
  const res = await fetch(BLOG, { headers: { "user-agent": "Mozilla/5.0 (compatible; BuilderHub/1.0; +https://build.avax.network)" }, signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  for (const [, path, inner] of html.matchAll(/<a href="(\/about\/blog\/[a-z0-9-]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    if (seen.has(path)) continue;
    const title = inner.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/)?.[1];
    // the date leads the card's byline, month.day.year, inside its own tags
    const day = textOf(inner).match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);
    if (!title || !day) continue;
    const at = Date.UTC(Number(day[3]), Number(day[1]) - 1, Number(day[2]));
    if (!Number.isFinite(at)) continue;
    seen.add(path);
    out.push({ title: textOf(title), href: `https://www.avalanche.com${path}`, date: new Date(at).toISOString(), source: "Avalanche", image: pictureOf(inner) });
  }
  if (!out.length) throw new Error("no cards");
  return out;
}

function builderHub(): NewsItem[] {
  return blog.getPages().flatMap((page) => {
    const raw = page.data.date as string | Date | undefined;
    const at = raw ? new Date(raw) : null;
    if (!at || Number.isNaN(at.getTime()) || !page.data.title) return [];
    // the social image the post's own page names (app/blog/[...slug]/page.tsx)
    const og = new URLSearchParams({ title: `${page.data.title} | Avalanche Builder Hub`, description: page.data.description ?? "Developer documentation for everything related to the Avalanche ecosystem." });
    return [{ title: page.data.title, href: page.url, date: at.toISOString(), source: "Builder Hub" as const, image: `/api/og/blog/${page.slugs[0]}?${og.toString()}&v=2` }];
  });
}

export async function GET() {
  if (!kept || Date.now() - kept.at > TTL_MS) {
    const cards = await official().catch(() => kept?.official ?? []);
    kept = { at: Date.now(), official: cards };
  }
  const items = [...kept.official, ...builderHub()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, SHOWN);
  return NextResponse.json({ items }, { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400" } });
}
