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

  const eventInfo = useMemo(
    () => project.hackathon?.title ?? "",
    [project.hackathon?.title]
  );

  const coverImage = useMemo(
    () => project.cover_url?.trim() ||
      "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/hackathon-images/project-banner-2whUMzkW6ABHW5GjIAH3NbBHLQIJzw.png",
    [project.cover_url]
  );

  // Category color mapping
  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'DeFi': 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400',
      'NFT': 'bg-pink-100 text-pink-700 dark:bg-pink-950/30 dark:text-pink-400',
      'Gaming': 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400',
      'Infrastructure': 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
      'Social': 'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400',
      'DAO': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400',
      'Identity': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400',
      'Marketplace': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-400',
      'Security': 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400',
      'Analytics': 'bg-teal-100 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400',
    };
    return colors[category] || 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400';
  };

  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (isAssignBadgeOpen) return;
    const isInteractive = (e.target as HTMLElement).closest(
      '[data-interactive="true"]'
    );
    if (isInteractive) return;

    // When clicked from profile, go to edit page; otherwise go to showcase view
    if (isFromProfile) {
      const isBuildGames = project.hackaton_id === "249d2911-7931-4aa0-a696-37d8370b79f9";
      router.push(isBuildGames
        ? `/build-games/submit?stage=1`
        : `/hackathons/project-submission?project=${project.id}`
      );
    } else {
      router.push(`/showcase/${project.id}`);
    }
  }, [confirmOpen, isAssignBadgeOpen, router, project.id, isFromProfile]);
  return (
    <Card
      className="group relative w-full h-[420px] flex flex-col overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-300 cursor-pointer hover:shadow-lg"
      onClick={handleCardClick}
    >
      {/* Cover Image */}
      <div className="relative w-full h-[160px] flex-shrink-0 overflow-hidden bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900">
        <Image
          src={coverImage}
          alt={`${project.project_name} banner`}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {/* Options Menu - Floating */}
        <div className="absolute top-2 right-2 z-10" data-interactive="true">
          <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm rounded-lg p-1">
            <ProjectOptions
              project={project}
              isAssignBadgeOpen={isAssignBadgeOpen}
              setIsAssignBadgeOpen={setIsAssignBadgeOpen}
              isFromProfile={isFromProfile}
            />
          </div>
        </div>

        {/* Winner Badge - Floating */}
        {project.is_winner && (
          <div className="absolute top-2 left-2 z-10">
            <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white border-none shadow-lg flex items-center gap-1.5 px-2.5 py-0.5">
              <Trophy size={12} />
              <span className="text-xs font-semibold">Winner</span>
            </Badge>
          </div>
        )}
      </div>

      {/* Content Section - Flex grow to push footer down */}
      <div className="flex flex-col flex-1 p-4 pt-2">
        {/* Categories - Right after image */}
        {project.categories && Array.isArray(project.categories) && project.categories.length > 0 ? (
          <div className="flex items-center gap-1.5 mb-2 flex-wrap min-h-[24px]">
            {project.categories.slice(0, 3).map((category, index) => (
              <Badge
                key={index}
                className={`text-xs px-2.5 py-0.5 border-none font-medium ${getCategoryColor(category)}`}
              >
                {category}
              </Badge>
            ))}
            {project.categories.length > 3 && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                +{project.categories.length - 3}
              </span>
            )}
          </div>
        ) : (
          <div className="h-[24px] mb-2" />
        )}

        {/* Title & Description - Fixed height for alignment */}
        <div className="mb-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 line-clamp-1 group-hover:text-red-600 dark:group-hover:text-red-500 transition-colors h-7 leading-7 cursor-default">
                  {project.project_name}
                </h3>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{project.project_name}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Description */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-1 h-5 leading-5 mt-1.5 cursor-default">
                  {project.short_description}
                </p>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{project.short_description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Spacer to push footer down */}
        <div className="flex-1" />

        {/* Footer: Event Info */}
        <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800">
          {/* Event Info */}
          <div className="flex items-center gap-2">
            <MapPin size={13} className="text-zinc-500 dark:text-zinc-400 flex-shrink-0" />
            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">
              {eventInfo || "Independent Project"}
            </p>
          </div>
        </div>

        {/* Badges Row - Last element at bottom - Always reserve space */}
        <div className="pt-3 min-h-[40px] flex items-center">
          {approvedBadges.length > 0 && (
            <TooltipProvider>
              <div className="flex items-center gap-1.5">
                {approvedBadges.slice(0, 5).map((badge) => (
                  <Tooltip key={badge.id}>
                    <TooltipTrigger asChild>
                      <div className="relative w-7 h-7 rounded-full overflow-hidden border-2 border-zinc-200 dark:border-zinc-700 hover:border-red-500 dark:hover:border-red-500 transition-colors cursor-pointer">
                        <Image
                          src={badge.image_path!}
                          alt={badge.name!}
                          fill
                          className="object-cover"
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{badge.name}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
                {approvedBadges.length > 5 && (
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    +{approvedBadges.length - 5}
                  </span>
                )}
              </div>
            </TooltipProvider>
          )}
        </div>
      </div>
    </Card>
  );
}
