"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  Globe,
  Rss,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import SheetBackdrop from "@/components/landing-v2/SheetBackdrop";
import { BrandButton } from "@/components/landing-v2/BrandButton";
import { track } from "@/components/landing-v2/track";
import HackathonCard from "@/components/hackathons/HackathonCard";
import type { HackathonHeader } from "@/types/hackathons";

/* ------------------------------------------------------------------ */
/* /ecosystem - the Avalanche ecosystem, community-run by Team1        */
/* ------------------------------------------------------------------ */

const ECOSYSTEM_WORDS = ["Finance", "Gaming", "Payments", "Community"];

// same avalanche pass as /solutions: the pulse walks the periods, then rests
const CASCADE_MS = 650;
const CASCADE_STEPS = ECOSYSTEM_WORDS.length + 12;

const CASCADE_URL = "https://cascade.team1.network/";
const TEAM1_LUMA_URL = "https://lu.ma/Team1?utm_source=builder_hub";

const FORMATS = [
  {
    icon: Zap,
    name: "Hackathons",
    desc: "Global and regional hackathons with prizes, mentors and a path to grants.",
    href: "/hackathons",
    external: false,
  },
  {
    icon: Wrench,
    name: "Builder Workshops",
    desc: "Hands-on sessions - launching L1s, tooling, agents.",
    href: "/events",
    external: false,
  },
  {
    icon: Users,
    name: "Community Events",
    desc: "Meetups and watch parties across Team1 chapters.",
    href: TEAM1_LUMA_URL,
    external: true,
  },
];

const COMMUNITY_TILES = [
  {
    img: "/team1/team1-events.png",
    label: "Community events",
    href: TEAM1_LUMA_URL,
    external: true,
  },
  {
    img: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/nav-banner/Avalanche-Event-TnQovuFzkt8CGHyF0wfiSYTrGVtuPU.jpg",
    label: "Builder events",
    href: "/events",
    external: false,
  },
  {
    img: "/grants/team1-mini-grants.jpg",
    label: "Grants",
    href: "/grants",
    external: false,
  },
];

const TelegramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
);

const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
  </svg>
);

const XIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.4l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.6l5.24 6.93ZM17.6 20.65h2.04L6.5 3.24H4.3Z" />
  </svg>
);

type Channel = {
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  href: string;
  external: boolean;
};

const TEAM1_CHANNELS: Channel[] = [
  { icon: DiscordIcon, name: "Discord", href: "https://discord.gg/team1", external: true },
  { icon: XIcon, name: "@AvaxTeam1", href: "https://x.com/AvaxTeam1", external: true },
  { icon: Rss, name: "Blog", href: "https://www.team1.blog/", external: true },
  { icon: Globe, name: "team1.network", href: "https://team1.network/", external: true },
  { icon: BookOpen, name: "Academy", href: "/academy", external: false },
];

const AVALANCHE_CHANNELS: Channel[] = [
  {
    icon: TelegramIcon,
    name: "Avalanche Academy Chat",
    href: "https://t.me/avalancheacademy",
    external: true,
  },
  {
    icon: TelegramIcon,
    name: "Avalanche Builders Chat",
    href: "https://t.me/+KDajA4iToKY2ZjBk",
    external: true,
  },
  { icon: DiscordIcon, name: "Avalanche Discord", href: "https://discord.gg/avax", external: true },
  {
    icon: XIcon,
    name: "Avalanche Developers X",
    href: "https://x.com/AvaxDevelopers",
    external: true,
  },
];

const MONO_LABEL = "font-mono text-[10px] uppercase tracking-[0.18em]";
const ICON_CLASS =
  "h-4 w-4 shrink-0 text-zinc-500 transition-colors group-hover:text-[#E6212F] dark:text-zinc-400";

function ChannelCell({ channel }: { channel: Channel }) {
  const Icon = channel.icon;
  const className =
    "group flex items-center gap-2.5 bg-white p-4 transition-colors hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900";
  const body = (
    <>
      <Icon className={ICON_CLASS} />
      <span className="text-[13.5px] font-medium text-zinc-900 dark:text-zinc-100">
        {channel.name}
      </span>
      <span className="ml-auto font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
        {channel.external ? "↗" : "→"}
      </span>
    </>
  );
  return channel.external ? (
    <a href={channel.href} target="_blank" rel="noopener noreferrer" className={className}>
      {body}
    </a>
  ) : (
    <Link href={channel.href} className={className}>
      {body}
    </Link>
  );
}

export default function EcosystemIndex({
  events,
  l1Count,
}: {
  events: HackathonHeader[];
  l1Count: number | null;
}) {
  const reducedMotion = useReducedMotion();

  // -1 = resting; 0..3 = the word the red pulse is passing through
  const [step, setStep] = useState(ECOSYSTEM_WORDS.length);
  useEffect(() => {
    if (reducedMotion) return;
    const timer = setInterval(() => setStep((s) => (s + 1) % CASCADE_STEPS), CASCADE_MS);
    return () => clearInterval(timer);
  }, [reducedMotion]);
  const active = step < ECOSYSTEM_WORDS.length ? step : -1;

  const rise = (delay: number) =>
    reducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, amount: 0.1 },
          transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <main className="relative overflow-x-clip bg-white dark:bg-zinc-950">
      <SheetBackdrop snowOnly />
      <div className="relative">
        {/* -- summit strip - temporary: remove after Sep 17 ------------- */}
        <div className="relative border-b border-zinc-200 bg-white/85 dark:border-zinc-800 dark:bg-zinc-950/85">
          <div
            className={`mx-auto flex h-10 w-full max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 px-5 md:px-6 ${MONO_LABEL} text-zinc-500 dark:text-zinc-400`}
          >
            <span className="h-1.5 w-1.5 shrink-0 bg-[#E6212F]" />
            <b className="font-medium text-zinc-900 dark:text-zinc-100">Avalanche Summit</b>
            <span className="text-zinc-300 dark:text-zinc-700">·</span>
            New York City
            <span className="text-zinc-300 dark:text-zinc-700">·</span>
            Sep 16-17
            <span className="text-zinc-300 dark:text-zinc-700">·</span>
            Chelsea Industrial
            <a
              href="https://www.avalanchesummit.com/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                track("ecosystem_cta_clicked", {
                  section: "summit-strip",
                  label: "Get tickets",
                  href: "https://www.avalanchesummit.com/",
                })
              }
              className="ml-auto text-zinc-900 transition-colors hover:text-[#E6212F] dark:text-zinc-100"
            >
              Get tickets ↗
            </a>
          </div>
        </div>

        {/* -- hero: the solutions cascade, ecosystem verticals ---------- */}
        {/* 2.5rem below the 3.5rem navbar accounts for the summit strip;
            revert to -3.5rem alone when the strip is removed */}
        <section className="flex min-h-[calc(100vh-3.5rem-2.5rem)] flex-col">
          <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-5 pb-7 pt-12 md:px-6">
            <motion.div
              className={`flex items-center gap-3 ${MONO_LABEL} text-zinc-500 dark:text-zinc-400`}
              {...rise(0)}
            >
              The Avalanche ecosystem
              <span className="text-zinc-300 dark:text-zinc-700">·</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/team1/text-logo.svg"
                alt="Team1"
                className="h-[17px] w-auto brightness-0 dark:brightness-100"
              />
              <span className="text-zinc-300 dark:text-zinc-700">·</span>
              community-run
            </motion.div>

            <div className="grid min-h-0 flex-1 items-stretch gap-10 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:gap-14">
              <motion.div className="flex flex-col justify-center" {...rise(0.07)}>
                <h1 className="v2-display text-[clamp(2.5rem,6vw,6rem)]">
                  {ECOSYSTEM_WORDS.map((word, i) => {
                    const lit = active === i;
                    const last = i === ECOSYSTEM_WORDS.length - 1;
                    return (
                      <span
                        key={word}
                        className="block whitespace-nowrap"
                        style={{ marginLeft: `${i * 0.6}em` }}
                      >
                        <span className="text-zinc-900 dark:text-zinc-50">{word}</span>
                        {/* only the periods carry the pulse; the words hold still */}
                        <span
                          className={`transition-colors duration-500 ${
                            lit || last
                              ? "text-[#E6212F]"
                              : "text-zinc-300 dark:text-zinc-700"
                          }`}
                        >
                          .
                        </span>
                      </span>
                    );
                  })}
                </h1>
              </motion.div>

              <motion.div
                className="flex flex-col justify-center lg:border-l lg:border-zinc-200 lg:pl-10 dark:lg:border-zinc-800"
                {...rise(0.14)}
              >
                <p className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-300">
                  One network - institutions, games and payments shipping{" "}
                  <strong className="font-semibold text-zinc-900 dark:text-zinc-50">
                    real products
                  </strong>
                  , carried by a global community of builders.
                </p>
                <div className="mt-7 flex flex-col gap-4">
                  <BrandButton
                    href="/integrations"
                    onClick={() =>
                      track("ecosystem_cta_clicked", {
                        section: "hero",
                        label: "Explore dApps",
                        href: "/integrations",
                      })
                    }
                  >
                    Explore dApps
                  </BrandButton>
                  <BrandButton
                    href="/academy"
                    variant="secondary"
                    onClick={() =>
                      track("ecosystem_cta_clicked", {
                        section: "hero",
                        label: "Start building",
                        href: "/academy",
                      })
                    }
                  >
                    Start building
                  </BrandButton>
                </div>
                {/* ecosystem scale, each number a doorway */}
                <div className="mt-8 grid grid-cols-2 gap-px border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800">
                  <a
                    href={CASCADE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      track("ecosystem_cta_clicked", {
                        section: "hero-stats",
                        label: "600+ projects",
                        href: CASCADE_URL,
                      })
                    }
                    className="group bg-white p-4 transition-colors hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                  >
                    <div className="v2-display text-3xl text-zinc-900 dark:text-zinc-50">
                      600+
                    </div>
                    <div className="mt-2 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-500 transition-colors group-hover:text-zinc-700 dark:text-zinc-400 dark:group-hover:text-zinc-300">
                      Projects <span className="text-[#E6212F]">·</span> Cascade ↗
                    </div>
                  </a>
                  <Link
                    href="/explorer/mainnet/chains"
                    onClick={() =>
                      track("ecosystem_cta_clicked", {
                        section: "hero-stats",
                        label: "Live L1s",
                        href: "/explorer/mainnet/chains",
                      })
                    }
                    className="group bg-white p-4 transition-colors hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                  >
                    <div className="v2-display text-3xl text-zinc-900 dark:text-zinc-50">
                      {l1Count ?? "-"}
                    </div>
                    <div className="mt-2 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-500 transition-colors group-hover:text-zinc-700 dark:text-zinc-400 dark:group-hover:text-zinc-300">
                      Live L1s <span className="text-[#E6212F]">·</span> Explorer →
                    </div>
                  </Link>
                </div>
              </motion.div>
            </div>

            <motion.a
              href="#whats-on"
              className={`mt-7 flex items-center justify-center gap-2 ${MONO_LABEL} text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100`}
              {...rise(0.21)}
            >
              See what&apos;s on
              <ChevronDown className="h-3.5 w-3.5 motion-safe:animate-bounce" />
            </motion.a>
          </div>
        </section>

        {/* -- events & programs: the hub's own event cards -------------- */}
        <section id="whats-on" className="py-16">
          <div className="mx-auto w-full max-w-7xl px-5 md:px-6">
            <motion.div className="mb-6 flex items-center gap-4" {...rise(0)}>
              <span className={`${MONO_LABEL} text-zinc-900 dark:text-zinc-100`}>
                Events &amp; programs
              </span>
              <Link
                href="/events"
                className={`ml-auto ${MONO_LABEL} text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100`}
              >
                All events →
              </Link>
            </motion.div>

            {events.length > 0 ? (
              <motion.div className="grid gap-6 md:grid-cols-2" {...rise(0.07)}>
                {events.map((hackathon) => (
                  <HackathonCard key={hackathon.id} hackathon={hackathon} />
                ))}
              </motion.div>
            ) : (
              <motion.div
                className="border border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400"
                {...rise(0.07)}
              >
                No events listed right now.{" "}
                <Link
                  href="/events"
                  className="text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
                >
                  Browse all events
                </Link>
              </motion.div>
            )}

            {/* the recurring formats behind the calendar */}
            <motion.div
              className="mt-6 grid grid-cols-1 gap-px border border-zinc-200 bg-zinc-200 md:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-800"
              {...rise(0.14)}
            >
              {FORMATS.map((f) => (
                <Link
                  key={f.name}
                  href={f.href}
                  target={f.external ? "_blank" : undefined}
                  rel={f.external ? "noopener noreferrer" : undefined}
                  className="group flex items-start gap-3 bg-white p-4 transition-colors hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                >
                  <f.icon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-zinc-500 transition-colors group-hover:text-[#E6212F] dark:text-zinc-400" />
                  <span>
                    <span className="block text-[13.5px] font-medium text-zinc-900 dark:text-zinc-100">
                      {f.name}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                      {f.desc}
                    </span>
                  </span>
                </Link>
              ))}
            </motion.div>
          </div>
        </section>

        {/* -- grants: the ConsoleBar grammar, pointed at /grants -------- */}
        <Link
          href="/grants"
          onClick={() =>
            track("ecosystem_cta_clicked", {
              section: "grants",
              label: "View grants",
              href: "/grants",
            })
          }
          className="group relative flex items-center justify-between overflow-hidden bg-[#1F1F1F] py-5"
        >
          <span
            aria-hidden
            className="absolute inset-0 origin-left scale-x-0 bg-[#EBF0FA] transition-transform duration-300 ease-out group-hover:scale-x-100"
          />
          <span className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-5 md:px-6">
            <span className="text-sm font-medium text-white transition-colors duration-300 group-hover:text-[#1F1F1F]">
              Grants &amp; funding - Builder Grants, Research Grants, and more
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-[#E6212F]" />
          </span>
        </Link>

        {/* -- team1: the community layer -------------------------------- */}
        <section className="py-16">
          <div className="mx-auto w-full max-w-7xl px-5 md:px-6">
            <motion.div className="mb-6" {...rise(0)}>
              <span className={`${MONO_LABEL} text-zinc-900 dark:text-zinc-100`}>
                The community layer
              </span>
            </motion.div>

            <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
              {/* the Team1 poster panel: red diagonal, rotated mark */}
              <motion.div
                className="relative isolate min-h-[380px] overflow-hidden bg-gradient-to-br from-[#E6212F] to-[#B2131F] [clip-path:polygon(0_0,100%_0,100%_100%,8%_100%,0_88%)]"
                {...rise(0.07)}
              >
                <span
                  aria-hidden
                  className="absolute inset-0 opacity-50"
                  style={{
                    background:
                      "repeating-linear-gradient(150deg, rgba(255,255,255,.05) 0 2px, transparent 2px 26px)",
                  }}
                />
                <span
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(200deg, transparent 55%, rgba(0,0,0,.28) 100%)",
                  }}
                />
                <div className="absolute left-6 top-5 z-10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/team1/text-logo.svg"
                    alt="Team1"
                    className="h-6 w-auto brightness-0 invert"
                  />
                </div>
                <svg
                  aria-hidden
                  className="absolute -right-5 top-2 w-[54%] -rotate-6"
                  viewBox="-76.247 -19.782 303.324 303.324"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fill="#09090b"
                    d="M150.78,5.84v119.22c0,2.6-2.1,4.7-4.7,4.7h-39.44c-2.59,0-4.69-2.11-4.69-4.7V53.59c0-2.59-2.1-4.7-4.7-4.7h-27.23c-2.59,0-4.69-2.11-4.69-4.7V4.7c0-2.6,2.1-4.7,4.69-4.7h74.92c3.22,0,5.83,2.61,5.83,5.84Z"
                  />
                  <path
                    fill="#fff"
                    d="M150.83,219.57v39.49c0,2.6-2.1,4.7-4.7,4.7h-51.22c-32.39,0-58.64-26.29-58.64-58.72v-65.4c0-2.6-2.1-4.7-4.7-4.7H4.7c-2.59,0-4.7-2.11-4.7-4.7v-39.49c0-2.59,2.1-4.7,4.7-4.7h26.88c2.59,0,4.7-2.11,4.7-4.7v-10.34c0-2.6,2.1-4.7,4.69-4.7h39.44c2.59,0,4.7,2.11,4.7,4.7v132.52c0,6.26,5.07,11.34,11.32,11.34h49.71c2.59,0,4.7,2.11,4.7,4.7Z"
                  />
                </svg>
                <div className="absolute bottom-5 left-6 right-6 z-10 flex items-end gap-8 text-white">
                  <div>
                    <div className="v2-display text-4xl">600+</div>
                    <div className={`mt-1.5 ${MONO_LABEL} opacity-85`}>Members</div>
                  </div>
                  <div>
                    <div className="v2-display text-4xl">60+</div>
                    <div className={`mt-1.5 ${MONO_LABEL} opacity-85`}>Countries</div>
                  </div>
                </div>
              </motion.div>

              <div className="flex flex-col gap-5">
                <motion.p
                  className="max-w-[66ch] text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400"
                  {...rise(0.07)}
                >
                  <strong className="font-semibold text-zinc-900 dark:text-zinc-50">
                    Team1
                  </strong>{" "}
                  is the global network of builders, creators and operators growing the
                  Avalanche ecosystem - running the community events, programs and grants
                  on this page.
                </motion.p>

                <motion.div
                  className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-3"
                  {...rise(0.14)}
                >
                  {COMMUNITY_TILES.map((tile) => {
                    const tileClass =
                      "group relative isolate block min-h-[190px] overflow-hidden border border-zinc-200 dark:border-zinc-800";
                    const body = (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={tile.img}
                          alt=""
                          className="absolute inset-0 -z-10 h-full w-full object-cover saturate-[.92] transition-transform duration-700 ease-out group-hover:scale-105"
                        />
                        <span
                          className={`absolute bottom-3 left-3.5 ${MONO_LABEL} text-white [text-shadow:0_1px_8px_rgba(0,0,0,.8)]`}
                        >
                          {tile.label} {tile.external ? "↗" : "→"}
                        </span>
                      </>
                    );
                    return tile.external ? (
                      <a
                        key={tile.label}
                        href={tile.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={tileClass}
                      >
                        {body}
                      </a>
                    ) : (
                      <Link key={tile.label} href={tile.href} className={tileClass}>
                        {body}
                      </Link>
                    );
                  })}
                </motion.div>
              </div>
            </div>

            <motion.div
              className="mt-5 grid grid-cols-1 gap-px border border-zinc-200 bg-zinc-200 sm:grid-cols-2 md:grid-cols-5 dark:border-zinc-800 dark:bg-zinc-800"
              {...rise(0.21)}
            >
              {TEAM1_CHANNELS.map((channel) => (
                <ChannelCell key={channel.name} channel={channel} />
              ))}
            </motion.div>
          </div>
        </section>

        {/* -- official avalanche channels -------------------------------- */}
        <section className="pb-24">
          <div className="mx-auto w-full max-w-7xl px-5 md:px-6">
            <motion.div className="mb-6" {...rise(0)}>
              <span className={`${MONO_LABEL} text-zinc-900 dark:text-zinc-100`}>
                Official Avalanche channels
              </span>
            </motion.div>
            <motion.div
              className="grid grid-cols-1 gap-px border border-zinc-200 bg-zinc-200 sm:grid-cols-2 md:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-800"
              {...rise(0.07)}
            >
              {AVALANCHE_CHANNELS.map((channel) => (
                <ChannelCell key={channel.name} channel={channel} />
              ))}
            </motion.div>
          </div>
        </section>
      </div>
    </main>
  );
}
