"use client";
import { Search, Building2 } from "lucide-react";
import { Input } from "../ui/input";
import {
  Select,
  SelectItem,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import HackathonCard from "./HackathonCard";
import { HackathonHeader, HackathonsFilters } from "@/types/hackathons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Separator } from "../ui/separator";
import { useSession } from "next-auth/react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../ui/pagination";
import OverviewBanner from "./hackathon/sections/OverviewBanner";
import Link from "next/link";
import Image from "next/image";
import DiscoveryCard from "./DiscoveryCard";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { normalizeEventsLang, t } from "@/lib/events/i18n";


function buildQueryString(
  filters: HackathonsFilters,
  searchQuery: string,
  pageSize: number,
  eventType: string
) {
  const params = new URLSearchParams();

  if (filters.location) {
    params.set("location", filters.location);
  }
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.page) {
    params.set("page", filters.page.toString());
  }
  if (filters.recordsByPage) {
    params.set("pageSize", filters.recordsByPage.toString());
  }
  if (searchQuery.trim()) {
    params.set("search", searchQuery.trim());
  }
  if (eventType) {
    params.set("event", eventType);
  }

  return params.toString();
}

function normalizeEventType(event?: string) {
  return (event || "hackathon").toLowerCase();
}

function labelForEventType(eventType: string) {
  if (eventType === "hackathon") return "Hackathon";
  if (eventType === "workshop") return "Workshop";
  if (eventType === "bootcamp") return "Bootcamp";
  return eventType.charAt(0).toUpperCase() + eventType.slice(1);
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
  totalUpcomingEvents,
}: Props) {
  // Listing language is global (mixed events). Default to English unless you later add a global locale.
  const lang = normalizeEventsLang(undefined);
  const { data: session, status } = useSession();
  const isHackathonCreator = session?.user?.custom_attributes.includes("hackathonCreator") || session?.user?.custom_attributes.includes("team1-admin");
  
  const router = useRouter();

  const [pastEvents, setPastEvents] = useState<HackathonHeader[]>(
    initialPastEvents
  );
  const [upcomingEvents, setUpcomingEvents] = useState<
    HackathonHeader[]
  >(initialUpcomingEvents);
  const [ongoingEvents, setOngoingEvents] = useState<
    HackathonHeader[]
  >(initialOngoingEvents);

  const [filters, setFilters] = useState<HackathonsFilters>(initialFilters);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [pageSize, setPageSize] = useState<number>(filters.recordsByPage ?? 4);
  const [totalPages, setTotalPages] = useState<number>(
    Math.ceil(totalPastEvents / pageSize)
  );
  const [currentPage, setCurrentPage] = useState<number>(filters.page ?? 1);
  const [searchValue, setSearchValue] = useState("");
  const [activeEventType, setActiveEventType] = useState<string>("all");
  const [pastEventType, setPastEventType] = useState<string>("");

  // Search debounce
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const eventsSectionRef = useRef<HTMLDivElement | null>(null);

  const eventTypes = useMemo(() => {
    const types = new Set<string>(["hackathon", "workshop", "bootcamp"]);
    [...upcomingEvents, ...ongoingEvents, ...pastEvents].forEach((e) => {
      const t = normalizeEventType(e.event);
      if (t) types.add(t);
    });
    return Array.from(types);
  }, [upcomingEvents, ongoingEvents, pastEvents]);

  const sortByStartDateAsc = (a: HackathonHeader, b: HackathonHeader) => {
    const aDate = a.start_date ? new Date(a.start_date).getTime() : 0;
    const bDate = b.start_date ? new Date(b.start_date).getTime() : 0;
    return aDate - bDate;
  };

  const activeEvents = useMemo(() => {
    const filterByType = (events: HackathonHeader[]) => {
      if (activeEventType === "all") return events;
      return events.filter(
        (e) => normalizeEventType(e.event) === activeEventType
      );
    };

    const sortedOngoing = [...ongoingEvents].sort(sortByStartDateAsc);
    const sortedUpcoming = [...upcomingEvents].sort(sortByStartDateAsc);

    return [...filterByType(sortedOngoing), ...filterByType(sortedUpcoming)];
  }, [ongoingEvents, upcomingEvents, activeEventType]);

  useEffect(() => {
    const abortController = new AbortController();
    const signal = abortController.signal;

    async function fetchEvents() {
      try {
        const queryString = buildQueryString(filters, searchQuery, pageSize, pastEventType);
        const { data } = await axios.get(
          `/api/hackathons?${queryString}&status=ENDED`,
          {
            signal,
          }
        );

        if (!signal.aborted) {
          setPastEvents(data.hackathons);
          setTotalPages(Math.ceil(data.total / pageSize));
        }
      } catch (err: any) {
        if (!signal.aborted) {
          console.error("Error fetching events:", err);
        }
      }
    }

    fetchEvents();

    return () => {
      abortController.abort();
    };
  }, [filters, searchQuery, pageSize, pastEventType]);

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      console.log("User ID:", session.user.id);

      if (session.user.custom_attributes?.includes("hackathonCreator") || session.user.custom_attributes?.includes("team1-admin")) {
        console.log("User is hackathonCreator");
      }
    }
  }, [session, status]);

  const handleFilterChange = (type: keyof HackathonsFilters, value: string) => {
    const newFilters = {
      ...filters,
      [type]: value === "all" ? "" : value,
      ...(type !== "page" ? { page: undefined } : {}),
    };

    setFilters(newFilters);
    if (type === "page") setCurrentPage(Number(value));
    if (type !== "page") setCurrentPage(1);

    const queryString = buildQueryString(newFilters, searchQuery, pageSize, pastEventType);
    router.replace(`/events?${queryString}`);
  };

  const handleSearchChange = useCallback((query: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(query);
      const newFilters = { ...filters, page: undefined };

      setFilters(newFilters);
      setCurrentPage(1);

      const queryString = buildQueryString(newFilters, query, pageSize, pastEventType);
      router.replace(`/events?${queryString}`);
    }, 300);
  }, [filters, pageSize, pastEventType, router]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearchChange(searchValue);
    }
  };
  const bannerPool = [...upcomingEvents, ...ongoingEvents];
  const topMostEvent = bannerPool.find((x) => x.top_most);

  const handleActiveEventTypeChange = (value: string) => {
    setActiveEventType(value);
    if (eventsSectionRef.current) {
      eventsSectionRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  const addNewHackathon = () => {
    router.push('/hackathons/edit');
  };

  const BUILD_GAMES_HACKATHON_ID = '249d2911-7931-4aa0-a696-37d8370b79f9';

  return (
    <section className="px-8 py-6">
      {topMostEvent && (
        <div className="w-full flex flex-col gap-8 justify-center">
          <div className="sm:block relative w-full">
            <OverviewBanner
              hackathon={topMostEvent}
              id={topMostEvent.id}
              isTopMost={true}
              isRegistered={false} //To keep showing "Learn More" button
              hideTextOverlay={topMostEvent.id === BUILD_GAMES_HACKATHON_ID}
              customRedirectUrl={topMostEvent.id === BUILD_GAMES_HACKATHON_ID ? '/build-games' : undefined}
            />
            <Link href={topMostEvent.id === BUILD_GAMES_HACKATHON_ID ? '/build-games' : `/events/${topMostEvent.id}`}>
              <Image
                src={
                  topMostEvent.banner?.trim().trim().length > 0
                    ? topMostEvent.banner
                    : "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/hackathon-images/main_banner_img-crBsoLT7R07pdstPKvRQkH65yAbpFX.png"
                }
                alt="Event background"
                width={1270}
                height={760}
                className="w-full h-full"
                priority
              />
            </Link>
          </div>
          </div>
        )}

        {isHackathonCreator && (
          <>
        <button
          className={`flex items-center gap-2 font-medium text-3xl text-zinc-900 dark:text-zinc-50 ${topMostEvent ? "mt-12" : ""} px-4 py-2 rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-red-500 hover:text-white transition-colors duration-200 cursor-pointer`}
          onClick={addNewHackathon}
        >
          <Building2 className="h-6 w-6" />
          {t(lang, "events.myHackathons")}
        </button>
        <Separator className="my-4 bg-zinc-300 dark:bg-zinc-800" />
        </>)}
        <div
          ref={eventsSectionRef}
          className={`flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${topMostEvent ? "mt-12" : ""}`}
        >
          <h2 className="font-medium text-3xl text-zinc-900 dark:text-zinc-50">
            {t(lang, "events.listing.title")}
          </h2>
          <Tabs
            value={activeEventType}
            onValueChange={handleActiveEventTypeChange}
            className="w-full md:w-auto"
          >
            <TabsList>
              <TabsTrigger value="all" className="cursor-pointer">
                {t(lang, "events.tabs.all")}
              </TabsTrigger>
              <TabsTrigger value="hackathon" className="cursor-pointer">
                {t(lang, "events.tabs.hackathons")}
              </TabsTrigger>
              <TabsTrigger value="workshop" className="cursor-pointer">
                {t(lang, "events.tabs.workshops")}
              </TabsTrigger>
              <TabsTrigger value="bootcamp" className="cursor-pointer">
                {t(lang, "events.tabs.bootcamps")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <Separator className="my-4 bg-zinc-300 dark:bg-zinc-800" />
        {activeEvents.length > 0 ? (
          <div className="grid grid-cols-1 gap-y-8 gap-x-4 xl:grid-cols-2">
            {activeEvents.map((event: any) => (
              <HackathonCard key={event.id} hackathon={event} basePath="/events" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="max-w-md">
              <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-6">
                {t(lang, "events.emptyActive")}
              </p>
              <a
                href="https://t.me/avalancheacademy"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-md transition-colors duration-200"
              >
                {t(lang, "events.joinTelegram")}
              </a>
            </div>
          </div>
        )}

        {/* Discovery Section */}
        <div className="mt-12 mb-12">
          <h2 className="font-medium text-3xl text-zinc-900 dark:text-zinc-50 mb-4">
            {t(lang, "events.discoverMore")}
          </h2>
          <Separator className="mb-6 bg-zinc-300 dark:bg-zinc-800" />
          <div className="grid md:grid-cols-3 gap-6">
            <DiscoveryCard
              title={t(lang, "events.discovery.avalancheCalendar.title")}
              description={t(lang, "events.discovery.avalancheCalendar.description")}
              image="https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/nav-banner/Avalanche-Event-TnQovuFzkt8CGHyF0wfiSYTrGVtuPU.jpg"
              url="https://lu.ma/calendar/cal-Igl2DB6quhzn7Z4"
            />
            <DiscoveryCard
              title={t(lang, "events.discovery.communityEvents.title")}
              description={t(lang, "events.discovery.communityEvents.description")}
              image="https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/nav-banner/local_events_team1-UJLssyvek3G880Q013A94SdMKxiLRq.jpg"
              url="https://lu.ma/Team1?utm_source=builder_hub"
            />
            <DiscoveryCard
              title={t(lang, "events.discovery.campusConnect.title")}
              description={t(lang, "events.discovery.campusConnect.description")}
              image="https://qizat5l3bwvomkny.public.blob.vercel-storage.com/University-Slideshow/729e397093550313627a7a1717249ef2%20%282%29.jpg"
              url="/university"
            />
          </div>
        </div>

        <h2 className="font-medium text-3xl text-zinc-900 dark:text-zinc-50 mt-12">
          {t(lang, "events.past")}
        </h2>
        <Separator className="my-4 bg-zinc-300 dark:bg-zinc-800" />
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 justify-between">
          <div className="flex items-stretch gap-4 max-w-sm w-full h-9">
            {/* Input */}
            <div className="relative flex-grow h-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-zinc-400 stroke-zinc-700" />
              <Input
                type="text"
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t(lang, "events.search.placeholder")}
                className="w-full h-full px-3 pl-10 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-md dark:text-zinc-50 text-zinc-900 placeholder-zinc-500"
              />
            </div>
            {/* Button */}
            <button
              onClick={() => handleSearchChange(searchValue)}
              className="px-[6px] rounded-md bg-red-500 hover:bg-red-600 transition"
            >
              <Search size={24} color="white" />
            </button>
          </div>
          <div className="flex flex-row gap-4 items-center">
            <Select
              onValueChange={(value: string) => {
                const normalized = value === "all" ? "" : value;
                setPastEventType(normalized);
                const newFilters = { ...filters, page: undefined };
                setFilters(newFilters);
                setCurrentPage(1);
                const queryString = buildQueryString(
                  newFilters,
                  searchQuery,
                  pageSize,
                  normalized
                );
                router.replace(`/events?${queryString}`);
              }}
              value={pastEventType}
            >
              <SelectTrigger className="w-[180px] border border-zinc-300 dark:border-zinc-800">
                <SelectValue placeholder={t(lang, "events.filter.event.placeholder")} />
              </SelectTrigger>
              <SelectContent className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800">
                <SelectItem value="all">{t(lang, "events.filter.event.all")}</SelectItem>
                {eventTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {labelForEventType(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              onValueChange={(value: string) =>
                handleFilterChange("location", value)
              }
              value={filters.location}
            >
              <SelectTrigger className="w-[180px] border border-zinc-300 dark:border-zinc-800">
                <SelectValue placeholder={t(lang, "events.filter.location.placeholder")} />
              </SelectTrigger>
              <SelectContent className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800">
                <SelectItem value="all">{t(lang, "events.filter.location.all")}</SelectItem>
                <SelectItem value="Online">Online</SelectItem>
                <SelectItem value="InPerson">{t(lang, "events.filter.location.inPerson")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-y-8 gap-x-4 xl:grid-cols-2 my-8">
          {pastEvents.map((event: any) => (
              <HackathonCard key={event.id} hackathon={event} basePath="/events" />
            ))}
        </div>
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
              {
                length: totalPages > 7 ? 7 : totalPages,
              },
              (_, i) =>
                1 +
                i -
                (currentPage > 3
                  ? totalPages - currentPage > 3
                    ? 3
                    : totalPages - 1 - (totalPages - currentPage)
                  : currentPage - 1)
            ).map((page) => (
              <PaginationItem
                key={page}
                onClick={() => handleFilterChange("page", page.toString())}
              >
                <PaginationLink isActive={page === currentPage}>
                  {page}
                </PaginationLink>
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
              value={String(pageSize) ?? 4}
            >
              <SelectTrigger className="border border-zinc-300 dark:border-zinc-800">
                <SelectValue placeholder={t(lang, "events.pagination.pageSize.placeholder")} />
              </SelectTrigger>
              <SelectContent className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800">
                {[4, 8, ...Array.from({ length: 5 }, (_, i) => (i + 1) * 12)].map(
                  (option) => (
                    <SelectItem key={option} value={option.toString()}>
                      {option}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </PaginationContent>
        </Pagination>
      </section>
    );
}
