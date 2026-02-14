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
import { useRouter } from "next/navigation";
import { ProjectOptions } from "./ProjectOptions";
import { useState, useMemo, useCallback } from "react";
import { BadgeAwardStatus } from "@/types/badge";

export type Props = {
  project: Project,
  isFromProfile?: boolean;
};

export function ProjectCard({ project, isFromProfile = false }: Props) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isAssignBadgeOpen, setIsAssignBadgeOpen] = useState(false);

  // Memoize computed values to prevent unnecessary recalculations
  const approvedBadges = useMemo(
    () => project.badges?.filter(badge =>
      badge?.status === BadgeAwardStatus.approved &&
      badge?.image_path &&
      badge?.name
    ) ?? [],
    [project.badges]
  );

  const displayName = useMemo(
    () => project.project_name.length > 25
      ? `${project.project_name.slice(0, 25)}...`
      : project.project_name,
    [project.project_name]
  );

  const displayDescription = useMemo(
    () => project.short_description.length > 100
      ? `${project.short_description.slice(0, 100)}...`
      : project.short_description,
    [project.short_description]
  );

  const eventInfo = useMemo(
    () => project.hackathon?.title ?? "",
    [project.hackathon?.title]
  );

  const displayEventInfo = useMemo(
    () => eventInfo.length > 30 ? `${eventInfo.slice(0, 30)}...` : eventInfo,
    [eventInfo]
  );

  const coverImage = useMemo(
    () => project.cover_url?.trim() ||
      "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/hackathon-images/project-banner-2whUMzkW6ABHW5GjIAH3NbBHLQIJzw.png",
    [project.cover_url]
  );

  const visibleTracks = useMemo(
    () => project.tracks?.slice(0, 2) ?? [],
    [project.tracks]
  );

  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (confirmOpen || isAssignBadgeOpen) return;
    const isInteractive = (e.target as HTMLElement).closest(
      '[data-interactive="true"]'
    );
    if (isInteractive) return;

    // When clicked from profile, go to edit page; otherwise go to showcase view
    if (isFromProfile) {
      router.push(`/hackathons/project-submission?project=${project.id}`);
    } else {
      router.push(`/showcase/${project.id}`);
    }
  }, [confirmOpen, isAssignBadgeOpen, router, project.id, isFromProfile]);
  return (
    <Card
      className="h-[450px] w-full py-6 flex flex-col gap-4 rounded-xl bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-none cursor-pointer"
      onClick={handleCardClick}
    >
      <div className="relative px-6 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h3 className="text-2xl font-medium flex items-center text-zinc-900 dark:text-zinc-50 break-all leading-tight">
            {displayName}
          </h3>
          {project.is_winner && (
            <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white border-none flex items-center gap-1 whitespace-nowrap">
              <Trophy size={14} />
              Winner
            </Badge>
          )}
        </div>
        <div className="flex items-center">
            <ProjectOptions
              project={project}
              confirmOpen={confirmOpen}
              setConfirmOpen={setConfirmOpen}
              isAssignBadgeOpen={isAssignBadgeOpen}
              setIsAssignBadgeOpen={setIsAssignBadgeOpen}
              isFromProfile={isFromProfile}
            />
        </div>
      </div>
      <div className="w-full h-[156px] relative mt-2">
        <Image
          src={coverImage}
          alt={`${project.project_name} banner`}
          width={306}
          height={153}
          className="w-full h-[153px] object-cover"
        />
      </div>

      <div className="px-6 flex flex-col justify-between gap-2 h-full">
        <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3">
          {displayDescription}
        </p>

        <div className="flex flex-col gap-2">
          {/* Badge Images - Wrap all tooltips in a single provider */}
          {approvedBadges.length > 0 && (
            <TooltipProvider>
              <div className="flex items-center gap-1.5">
                {approvedBadges.slice(0, 4).map((badge) => (
                  <Tooltip key={badge.id}>
                    <TooltipTrigger asChild>
                      <div className="relative w-7 h-7 rounded-full overflow-hidden border-2 border-zinc-300 dark:border-zinc-600 hover:border-yellow-400 transition-colors">
                        <Image
                          src={badge.image_path!}
                          alt={badge.name!}
                          fill
                          className="object-cover"
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{badge.name}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
                {approvedBadges.length > 4 && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    +{approvedBadges.length - 4}
                  </span>
                )}
              </div>
            </TooltipProvider>
          )}

          <div className="flex gap-2 justify-between">
            <div className="max-w-[60%] flex items-center gap-2 xl:gap-6">
              <MapPin
                size={18}
                className="min-w-4 w-4 h-4 !text-zinc-700 dark:!text-zinc-300"
              />
              <p className="text-xs text-zinc-700 dark:text-zinc-300">
                {displayEventInfo}
              </p>
            </div>

            <TooltipProvider>
              <div className="flex flex-col items-center gap-2">
                {visibleTracks.map((track) => (
                  <Tooltip key={track}>
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
                ))}
              </div>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </Card>
  );
}
