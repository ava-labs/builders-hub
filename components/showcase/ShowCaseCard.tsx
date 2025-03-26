"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@radix-ui/react-dropdown-menu";
import { Search } from "lucide-react";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Project } from "@/types/showcase";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../ui/pagination";
import React from "react";
import { ProjectCard } from "./ProjectCard";
import Link from "next/link";

const events = [
  { id: "id1", name: "Event 1" },
  { id: "id2", name: "Event 2" },
  { id: "id3", name: "Event 3" },
];
const tracks = ["Track 1", "Track 2", "Track 3"];
export const projects: Project[] = [
  {
    id: "1",
    name: "BlockVote",
    isWinner: true,
    bannerUrl: "/temp/project-banner.png",
    shortDescription:
      "A decentralized and tamper-proof voting system leveraging blockchain technology to ensure fair elections.",
    event: {
      name: "Avalanche Summit",
      location: "LATAM",
      year: 2024,
    },
    tracks: ["GAMING", "DEFI"],
  },
  {
    id: "2",
    name: "MetaMed",
    isWinner: false,
    bannerUrl: "/temp/project-banner.png",
    shortDescription:
      "A metaverse-powered medical training platform using VR to simulate emergency scenarios.",
    event: {
      name: "ETHGlobal",
      location: "New York",
      year: 2023,
    },
    tracks: ["HEALTHCARE", "EDTECH"],
  },
  {
    id: "3",
    name: "GreenChain",
    isWinner: true,
    bannerUrl: "/temp/project-banner.png",
    shortDescription:
      "A carbon credit tracking system that brings transparency to environmental efforts via blockchain.",
    event: {
      name: "Devcon",
      location: "Bogotá",
      year: 2022,
    },
    tracks: ["SUSTAINABILITY", "SUPPLY_CHAIN"],
  },
];

export default function ShowCaseCard() {
  const [searchValue, setSearchValue] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsByPage, setRecordsByPage] = useState(12);
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      // handleSearchChange(searchValue);
    }
  };
  const pages = Math.ceil(
    [...Array(20)].flatMap(() => projects).length / recordsByPage
  );
  return (
    <Card className="bg-zinc-950 relative border boder-zinc-800 p-8">
      <h2 className="text-2xl text-zinc-50">Showcase</h2>
      <p className="text-zinc-400">
        Discover innovative projects built during our hackathons. Filter by
        track, technology, and winners
      </p>
      <Separator className="my-8 bg-zinc-300 dark:bg-zinc-800 h-[2px]" />
      <div className="flex items-center justify-between gap-2">
        <Tabs defaultValue="allProjects">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="allProjects">All Projects</TabsTrigger>
            <TabsTrigger value="winingProjects">Winning Projects</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-[271px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-zinc-400 stroke-zinc-700" />
          <Input
            type="text"
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search by name, event, location..."
            className="w-full h-full px-3 pl-10 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-md dark:text-zinc-50 text-zinc-900 placeholder-zinc-500"
          />
        </div>
        <Select>
          <SelectTrigger className="w-[237px] border border-zinc-300 dark:border-zinc-800">
            <SelectValue placeholder="Select events" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800">
            {events.map((event) => (
              <SelectItem key={event.id} value={event.id}>
                {event.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select>
          <SelectTrigger className="w-[237px] border border-zinc-300 dark:border-zinc-800">
            <SelectValue placeholder="Select tracks" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800">
            {tracks.slice(0, 2).map((track) => (
              <SelectItem key={track} value={track}>
                {track}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="mt-12">
        <h1 className="text-2xl text-zinc-50">
          {projects.length ?? ""}{" "}
          {projects.length > 1
            ? "Projects"
            : projects.length == 0
            ? "No projects found"
            : "Project"}{" "}
          found
        </h1>
        <Separator className="my-8 bg-zinc-300 dark:bg-zinc-800 h-[2px]" />
        <div className="grid grid-cols-1 gap-y-8 gap-x-4 xl:grid-cols-4">
          {[...Array(20)]
            .flatMap(() => projects)
            .map((project, index) => (
              <Link href={`/showcase/${project.id}`} key={index}>
                <ProjectCard project={project} />
              </Link>
            ))}
        </div>
        <div className="w-full flex justify-end mt-8">
          <Pagination className="flex justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious href={`?page=${currentPage - 1}`} />
              </PaginationItem>
              {Array.from(
                { length: currentPage + 5 },
                (_, i) => currentPage + i
              ).map((page) => (
                <PaginationItem key={page}>
                  <PaginationLink
                    href={`?page=${page}`}
                    isActive={page === currentPage}
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext href={`?page=${currentPage + 1}`} />
              </PaginationItem>
              Page {currentPage} of {pages}
            </PaginationContent>
          </Pagination>
        </div>
      </div>
    </Card>
  );
}
