"use client";

import { Badge } from "@/components/ui/badge";
import { Project } from "@/types/showcase";
import { MapPin, Trophy } from "lucide-react";
import Image from "next/image";
import { Card } from "../ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Props = {
  project: Project;
};

export function ProjectCard({ project }: Props) {
  const eventInfo = `${project.hackathon?.title ?? ""}`;
  console.log(project.prizes)
  return (
    <Card className="h-[450px] w-full py-6 flex flex-col gap-4 rounded-xl bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-none">
    <div className="relative px-6 flex items-center justify-between gap-2">
      <h3 className="text-3xl font-medium flex items-center text-zinc-900 dark:text-zinc-50 break-all leading-tight">
        {project.project_name.slice(0, 25)}
        {project.project_name.length > 25 ? "..." : ""}
      </h3>
      
      {project.prizes?.length > 0 && (
        <div className="p-2 bg-red-500 rounded-full">
          <Trophy size={18} color="white" />
        </div>
      )}
    </div>
    <div className="w-full h-[156px] relative mt-2">
      <Image
        src={
          project.cover_url && project.cover_url.trim().length > 0
            ? project.cover_url
            : "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/hackathon-images/project-banner-2whUMzkW6ABHW5GjIAH3NbBHLQIJzw.png"
        }
        alt={`${project.project_name} banner`}
        width={306}
        height={153}
        className="w-full h-[153px] object-cover"
      />
    </div>
  
    <div className="px-6 flex flex-col justify-between gap-1 h-full">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {project.short_description.slice(0, 100)}
        {project.short_description.length > 100 ? "..." : ""}
      </p>
      <div className="flex gap-2 justify-between">
        <div className="max-w-[60%] flex items-center gap-2 xl:gap-6">
          <MapPin
            size={18}
            className="min-w-4 w-4 h-4 !text-zinc-700 dark:!text-zinc-300"
          />
          <p className="text-xs text-zinc-700 dark:text-zinc-300">
            {eventInfo.slice(0, 30)}
            {eventInfo.length > 30 ? "..." : ""}
          </p>
        </div>
  
        <div className="flex flex-col items-center gap-2">
          {project.tracks.slice(0, 2).map((track) => (
            <TooltipProvider key={track}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="border-2 border-zinc-900 dark:border-zinc-50 flex justify-center rounded-xl max-w-[120px]"
                  >
                    <span className="truncate">{track}</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{track}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      </div>
    </div>
  </Card>
  
  );
}
