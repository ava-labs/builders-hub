"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import axios from "axios";
import { Calendar, Plus } from "lucide-react";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../ui/pagination";
import DiscoveryCard from "./DiscoveryCard";
import EventCard from "./events/EventCard";
import HeroBanner from "./events/HeroBanner";
import FilterBar from "./events/FilterBar";
import { EYEBROW, FALLBACK_BANNER, normalizeEventType } from "./events/utils";
import { HackathonHeader, HackathonsFilters } from "@/types/hackathons";
import { type EventsLang, normalizeEventsLang, t } from "@/lib/events/i18n";

const AVALANCHE_CALENDAR_URL = "https://lu.ma/calendar/cal-Igl2DB6quhzn7Z4";
// Avalanche Summit & conferences — reuses the shared Avalanche banner as its cover.
const SUMMIT_URL = "https://summit.avax.network";
const SUMMIT_IMAGE = FALLBACK_BANNER;

function buildQueryString(
  filters: HackathonsFilters,
  searchQuery: string,
  eventType: string,
) {
  const params = new URLSearchParams();

  if (filters.location) params.set("location", filters.location);
  if (filters.status) params.set("status", filters.status);
  if (filters.page) params.set("page", filters.page.toString());
  if (filters.recordsByPage) params.set("pageSize", filters.recordsByPage.toString());
  if (searchQuery.trim()) params.set("search", searchQuery.trim());
  if (eventType) params.set("event", eventType);

  return params.toString();
}

const sortByStartDateAsc = (a: HackathonHeader, b: HackathonHeader) => {
  const aDate = a.start_date ? new Date(a.start_date).getTime() : 0;
  const bDate = b.start_date ? new Date(b.start_date).getTime() : 0;
  return aDate - bDate;
};

function SectionHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-zinc-200 pb-3 dark:border-zinc-800">
      <h2 className="text-xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">
        {title}
      </h2>
      <span className={EYEBROW}>{sub}</span>
    </div>
  );
}

function EmptyState({ lang }: { lang: EventsLang }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-zinc-300 bg-white/50 py-16 text-center dark:border-zinc-700 dark:bg-zinc-900/30">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
        <Calendar className="h-6 w-6" />
      </div>
      <div className="max-w-sm">
        <h4 className="text-base font-medium text-zinc-900 dark:text-zinc-50">
          {t(lang, "events.empty.title")}
        </h4>
        <p className="mt-1 text-sm font-light text-zinc-600 dark:text-zinc-400">
          {t(lang, "events.empty.body")}
        </p>
      </div>
      <Button asChild variant="outline" size="sm">
        <a
          href="https://t.me/avalancheacademy"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t(lang, "events.joinTelegram")}
        </a>
      </Button>
    </div>
  );
}

type Props = {
  initialPastEvents: HackathonHeader[];
  initialUpcomingEvents: HackathonHeader[];
  initialOngoingEvents: HackathonHeader[];
  initialFilters: HackathonsFilters;
  totalPastEvents: number;
  totalUpcomingEvents: number;
};

export default function Events({
  initialPastEvents,
  initialUpcomingEvents,
  initialOngoingEvents,
  initialFilters,
  totalPastEvents,
}: Props) {
  // Listing language is global (mixed events). Default to English.
  const lang = normalizeEventsLang(undefined);
  const { data: session } = useSession();
  const isHackathonCreator =
    session?.user?.custom_attributes?.includes("hackathonCreator") ||
    session?.user?.custom_attributes?.includes("team1-admin") ||
    false;

  const router = useRouter();

  const [pastEvents, setPastEvents] = useState<HackathonHeader[]>(initialPastEvents);
  const [upcomingEvents] = useState<HackathonHeader[]>(initialUpcomingEvents);
  const [ongoingEvents] = useState<HackathonHeader[]>(initialOngoingEvents);

  const [filters, setFilters] = useState<HackathonsFilters>(initialFilters);
  const [searchInput, setSearchInput] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeEventType, setActiveEventType] = useState<string>("all");
  // Page size is driven by the records-per-page selector (filters.recordsByPage).
  const pageSize = filters.recordsByPage ?? 4;
  const [pastTotal, setPastTotal] = useState<number>(totalPastEvents);
  const [totalPages, setTotalPages] = useState<number>(
    Math.ceil(totalPastEvents / pageSize),
  );
  const [currentPage, setCurrentPage] = useState<number>(
    Math.max(1, filters.page ?? 1),
  );

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const apiEventType = activeEventType === "all" ? "" : activeEventType;

  // Featured event — shown only in the hero, excluded from the grid below.
  const topMostEvent = useMemo(
    () => [...upcomingEvents, ...ongoingEvents].find((x) => x.top_most),
    [upcomingEvents, ongoingEvents],
  );

  // Type counts for the segmented control (over the full open pool, sans featured).
  const typeCounts = useMemo(() => {
    const openPool = [...ongoingEvents, ...upcomingEvents].filter((e) => !e.top_most);
    const count = (type: string) =>
      type === "all"
        ? openPool.length
        : openPool.filter((e) => normalizeEventType(e.event) === type).length;
    return {
      all: count("all"),
      hackathon: count("hackathon"),
      workshop: count("workshop"),
      bootcamp: count("bootcamp"),
    };
  }, [ongoingEvents, upcomingEvents]);

  // Open-for-registration grid: ongoing + upcoming, filtered client-side.
  const activeEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const loc = filters.location;
    const matches = (e: HackathonHeader) => {
      if (activeEventType !== "all" && normalizeEventType(e.event) !== activeEventType)
        return false;
      if (loc) {
        const isOnline = (e.location || "").toLowerCase().includes("online");
        if (loc === "Online" && !isOnline) return false;
        if (loc === "InPerson" && isOnline) return false;
      }
      if (query) {
        const haystack =
          `${e.title} ${e.location} ${(e.tags || []).join(" ")}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    };

    const sortedOngoing = [...ongoingEvents].sort(sortByStartDateAsc);
    const sortedUpcoming = [...upcomingEvents].sort(sortByStartDateAsc);
    return [...sortedOngoing, ...sortedUpcoming]
      .filter((e) => !e.top_most)
      .filter(matches);
  }, [ongoingEvents, upcomingEvents, activeEventType, searchQuery, filters.location]);

  // Past events come from the API (search / location / type / pagination).
  useEffect(() => {
    const abortController = new AbortController();
    const signal = abortController.signal;

    async function fetchEvents() {
      try {
        const queryString = buildQueryString(filters, searchQuery, apiEventType);
        const { data } = await axios.get(`/api/events?${queryString}&status=ENDED`, {
          signal,
        });
        if (!signal.aborted) {
          setPastEvents(data.hackathons);
          setPastTotal(data.total);
          setTotalPages(Math.ceil(data.total / pageSize));
        }
      } catch (err: any) {
        if (!signal.aborted) console.error("Error fetching events:", err);
      }
    }

    fetchEvents();
    return () => abortController.abort();
  }, [filters, searchQuery, apiEventType, pageSize]);

  const handleFilterChange = (type: keyof HackathonsFilters, value: string) => {
    if (type === "page") {
      const pageNum = Number(value);
      if (isNaN(pageNum) || pageNum < 1) {
        console.warn(`Invalid page number: ${value}`);
        return;
      }
    }

    const newFilters = {
      ...filters,
      [type]: value === "all" ? "" : value,
      ...(type !== "page" ? { page: undefined } : {}),
    };

    setFilters(newFilters);
    if (type === "page") setCurrentPage(Number(value));
    else setCurrentPage(1);

    const queryString = buildQueryString(newFilters, searchQuery, apiEventType);
    router.replace(`/events?${queryString}`);
  };

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => {
        setSearchQuery(value);
        const newFilters = { ...filters, page: undefined };
        setFilters(newFilters);
        setCurrentPage(1);
        const queryString = buildQueryString(newFilters, value, apiEventType);
        router.replace(`/events?${queryString}`);
      }, 300);
    },
    [filters, apiEventType, router],
  );

  const handleTypeChange = (value: string) => {
    setActiveEventType(value);
    const apiType = value === "all" ? "" : value;
    const newFilters = { ...filters, page: undefined };
    setFilters(newFilters);
    setCurrentPage(1);
    const queryString = buildQueryString(newFilters, searchQuery, apiType);
    router.replace(`/events?${queryString}`);
  };

  const addNewHackathon = () => {
    router.push("/events/edit");
  };

  return (
    <section className="flex flex-col gap-10 py-8">
      {/* Page head */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-[32px] font-medium leading-tight tracking-tight text-zinc-900 dark:text-zinc-50">
            {t(lang, "events.listing.title")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm font-light text-zinc-600 dark:text-zinc-400">
            {t(lang, "events.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={AVALANCHE_CALENDAR_URL} target="_blank" rel="noopener noreferrer">
              <Calendar className="h-4 w-4" />
              {t(lang, "events.subscribeCalendar")}
            </a>
          </Button>
          {isHackathonCreator && (
            <Button variant="red" size="sm" onClick={addNewHackathon}>
              <Plus className="h-4 w-4" />
              {t(lang, "events.newEvent")}
            </Button>
          )}
        </div>
      </div>

      {/* Featured hero */}
      {topMostEvent && (
        <HeroBanner
          hackathon={topMostEvent}
          lang={lang}
          isCreator={isHackathonCreator}
        />
      )}

      {/* Global filter bar */}
      <FilterBar
        lang={lang}
        search={searchInput}
        onSearchChange={handleSearchChange}
        activeType={activeEventType}
        onActiveTypeChange={handleTypeChange}
        typeCounts={typeCounts}
        location={filters.location}
        onLocationChange={(value) => handleFilterChange("location", value)}
      />

      {/* Open for registration */}
      <div className="flex flex-col gap-5">
        <SectionHead
          title={t(lang, "events.openForRegistration")}
          sub={`${activeEvents.length} ${
            activeEvents.length === 1
              ? t(lang, "events.eventLabel")
              : t(lang, "events.eventsLabel")
          }`}
        />
        {activeEvents.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {activeEvents.map((event) => (
              <EventCard
                key={event.id}
                hackathon={event}
                lang={lang}
                isCreator={isHackathonCreator}
                basePath="/events"
              />
            ))}
          </div>
        ) : (
          <EmptyState lang={lang} />
        )}
      </div>

      {/* Discover more */}
      <div className="flex flex-col gap-5">
        <SectionHead
          title={t(lang, "events.discoverMore")}
          sub={t(lang, "events.discoverMoreSub")}
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <DiscoveryCard
            meta="lu.ma · external"
            title={t(lang, "events.discovery.avalancheCalendar.title")}
            description={t(lang, "events.discovery.avalancheCalendar.description")}
            image="https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/nav-banner/Avalanche-Event-TnQovuFzkt8CGHyF0wfiSYTrGVtuPU.jpg"
            url={AVALANCHE_CALENDAR_URL}
          />
          <DiscoveryCard
            meta="Team1 · external"
            title={t(lang, "events.discovery.communityEvents.title")}
            description={t(lang, "events.discovery.communityEvents.description")}
            image="https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/nav-banner/local_events_team1-UJLssyvek3G880Q013A94SdMKxiLRq.jpg"
            url="https://lu.ma/Team1?utm_source=builder_hub"
          />
          <DiscoveryCard
            meta="Universities"
            title={t(lang, "events.discovery.campusConnect.title")}
            description={t(lang, "events.discovery.campusConnect.description")}
            image="https://qizat5l3bwvomkny.public.blob.vercel-storage.com/University-Slideshow/729e397093550313627a7a1717249ef2%20%282%29.jpg"
            url="/university"
          />
          <DiscoveryCard
            meta="avax.network · external"
            title={t(lang, "events.discovery.summit.title")}
            description={t(lang, "events.discovery.summit.description")}
            image={SUMMIT_IMAGE}
            url={SUMMIT_URL}
          />
        </div>
      </div>

      {/* Past events */}
      <div className="flex flex-col gap-5">
        <SectionHead
          title={t(lang, "events.pastEvents")}
          sub={`${pastTotal} ${t(lang, "events.archivedLabel")}`}
        />
        {pastEvents.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {pastEvents.map((event) => (
              <EventCard
                key={event.id}
                hackathon={event}
                lang={lang}
                isCreator={isHackathonCreator}
                basePath="/events"
              />
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {t(lang, "events.empty.title")}
          </p>
        )}

        <Pagination className="flex justify-end gap-2">
          <PaginationContent className="flex-wrap cursor-pointer">
            {currentPage > 1 && (
              <PaginationItem
                onClick={() =>
                  handleFilterChange("page", (currentPage - 1).toString())
                }
              >
                <PaginationPrevious />
              </PaginationItem>
            )}
            {Array.from(
              { length: totalPages > 7 ? 7 : totalPages },
              (_, i) => {
                let startPage = Math.max(1, currentPage - 3);
                if (totalPages > 7 && startPage + 6 > totalPages) {
                  startPage = Math.max(1, totalPages - 6);
                }
                return startPage + i;
              },
            ).map((page) => (
              <PaginationItem
                key={page}
                onClick={() => {
                  if (page >= 1 && page <= totalPages) {
                    handleFilterChange("page", page.toString());
                  }
                }}
              >
                <PaginationLink isActive={page === currentPage}>{page}</PaginationLink>
              </PaginationItem>
            ))}
            {totalPages - currentPage > 3 && (
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
            )}
            {currentPage < totalPages && (
              <PaginationItem
                onClick={() =>
                  handleFilterChange("page", (currentPage + 1).toString())
                }
              >
                <PaginationNext />
              </PaginationItem>
            )}

            <p className="mx-2">
              {t(lang, "events.pagination.pageOf", {
                current: currentPage,
                total: totalPages,
              })}
            </p>

            <Select
              onValueChange={(value: string) =>
                handleFilterChange("recordsByPage", value)
              }
              value={String(pageSize)}
            >
              <SelectTrigger className="border border-zinc-300 dark:border-zinc-800">
                <SelectValue
                  placeholder={t(lang, "events.pagination.pageSize.placeholder")}
                />
              </SelectTrigger>
              <SelectContent className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800">
                {[4, 8, ...Array.from({ length: 5 }, (_, i) => (i + 1) * 12)].map(
                  (option) => (
                    <SelectItem key={option} value={option.toString()}>
                      {option}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </PaginationContent>
        </Pagination>
      </div>
    </section>
  );
}
