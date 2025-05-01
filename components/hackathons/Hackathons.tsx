"use client";
import { Search } from "lucide-react";
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
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Separator } from "../ui/separator";
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

function buildQueryString(
  filters: HackathonsFilters,
  searchQuery: string,
  pageSize: number
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

  return params.toString();
}

type Props = {
  initialPastHackathons: HackathonHeader[];
  initialUpcomingHackathons: HackathonHeader[];
  initialFilters: HackathonsFilters;
  totalPastHackathons: number;
  totalUpcomingHackathons: number;
};

export default function Hackathons({
  initialPastHackathons,
  initialUpcomingHackathons,
  initialFilters,
  totalPastHackathons,
  totalUpcomingHackathons,
}: Props) {
  const router = useRouter();
  const pageSize = 4;

  const [pastHackathons, setPastHackathons] = useState<HackathonHeader[]>(
    initialPastHackathons
  );
  const [upcomingHackathons, setUpcomingHackathons] = useState<
    HackathonHeader[]
  >(initialUpcomingHackathons);

  const [filters, setFilters] = useState<HackathonsFilters>(initialFilters);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [totalPages, setTotalPages] = useState<number>(
    Math.ceil(totalPastHackathons / pageSize)
  );
  const [currentPage, setCurrentPage] = useState<number>(filters.page ?? 1);
  const [searchValue, setSearchValue] = useState("");

  // Search debounce
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    const signal = abortController.signal;

    async function fetchHackathons() {
      try {
        const queryString = buildQueryString(filters, searchQuery, pageSize);
        const { data } = await axios.get(
          `/api/hackathons?${queryString}&status=ENDED`,
          {
            signal,
          }
        );

        if (!signal.aborted) {
          setPastHackathons(data.hackathons);
          setTotalPages(Math.ceil(data.total / pageSize));
        }
      } catch (err: any) {
        if (!signal.aborted) {
          console.error("Error fetching hackathons:", err);
        }
      }
    }

    fetchHackathons();

    return () => {
      abortController.abort();
    };
  }, [filters, searchQuery]);

  const handleFilterChange = (type: keyof HackathonsFilters, value: string) => {
    const newFilters = {
      ...filters,
      [type]: value === "all" ? "" : value,
      ...(type !== "page" ? { page: undefined } : {}),
    };

    setFilters(newFilters);

    const params = new URLSearchParams();
    if (newFilters.page) params.set("page", newFilters.page.toString());
    if (newFilters.location) params.set("location", newFilters.location);
    if (newFilters.status) params.set("status", newFilters.status);
    if (newFilters.recordsByPage)
      params.set("recordsByPage", String(newFilters.recordsByPage));

    router.replace(`/hackathons?${params.toString()}`);
  };

  const handleSearchChange = useCallback((query: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(query);
      const newFilters = { ...filters, page: undefined };

      setFilters(newFilters);

      const queryString = buildQueryString(newFilters, query, pageSize);
      router.replace(`/hackathons?${queryString}`);
    }, 300);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearchChange(searchValue);
    }
  };
  const topMostHackathon = upcomingHackathons.find((x) => x.top_most);

  return (
    <section className="px-8 py-6">
      {topMostHackathon && (
        <div className="w-full flex flex-col gap-8 justify-center">
          <div className="sm:block relative w-full">
            <OverviewBanner
              hackathon={topMostHackathon}
              id={topMostHackathon.id}
            />
            <Link href={`/hackathons/${topMostHackathon.id}`}>
              <Image
                src={
                  topMostHackathon.banner?.trim().trim().length > 0
                    ? topMostHackathon.banner
                    : "/hackathon-images/main_banner_img.png"
                }
                alt="Hackathon background"
                width={1270}
                height={760}
                className="w-full h-full"
                priority
              />
            </Link>
          </div>
        </div>
      )}

      <h2
        className={`font-medium text-3xl text-zinc-900 dark:text-zinc-50 ${
          topMostHackathon ? "mt-12" : ""
        }`}
      >
        Upcoming
      </h2>
      <Separator className="my-4 bg-zinc-300 dark:bg-zinc-800" />
      <div className="grid grid-cols-1 gap-y-8 gap-x-4 xl:grid-cols-2">
        {upcomingHackathons
          .filter((x) => !x.top_most)
          .map((hackathon: any) => (
            <HackathonCard key={hackathon.id} hackathon={hackathon} />
          ))}
      </div>
      <h2 className="font-medium text-3xl text-zinc-900 dark:text-zinc-50 mt-12">
        Past
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
              placeholder="Search by name, track or location"
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
          {/* <h3 className="font-medium text-xl py-5 text-zinc-900 dark:text-zinc-50">
            {totalPastHackathons ?? ""}{" "}
            {totalPastHackathons > 1
              ? "Hackathons"
              : totalPastHackathons == 0
              ? "No Hackathons"
              : "Hackathon"}{" "}
            found
          </h3> */}
          <Select
            onValueChange={(value: string) =>
              handleFilterChange("location", value)
            }
            value={filters.location}
          >
            <SelectTrigger className="w-[180px] border border-zinc-300 dark:border-zinc-800">
              <SelectValue placeholder="Filter by Location" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800">
              <SelectItem value="all">All Locations</SelectItem>
              <SelectItem value="Online">Online</SelectItem>
              <SelectItem value="InPerson">In Person</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {/* <Separator className="my-4 bg-zinc-300 dark:bg-zinc-800" color="transparent" /> */}
      <div className="grid grid-cols-1 gap-y-8 gap-x-4 xl:grid-cols-2 my-8">
        {pastHackathons.map((hackathon: any) => (
          <HackathonCard key={hackathon.id} hackathon={hackathon} />
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
              currentPage +
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
            Page {currentPage} of {totalPages}
          </p>

          <Select
            onValueChange={(value: string) =>
              handleFilterChange("recordsByPage", value)
            }
            value={String(filters.recordsByPage ?? 4)}
          >
            <SelectTrigger className="border border-zinc-300 dark:border-zinc-800">
              <SelectValue placeholder="Select track" />
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
