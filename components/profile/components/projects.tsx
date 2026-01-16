"use client";

import { ProjectCard } from "@/components/showcase/ProjectCard";
import { useProject } from "./hooks/use-project";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useRouter } from "next/navigation";

// Skeleton component for project cards
function ProjectCardSkeleton() {
  return (
    <Card className="h-[450px] w-full py-6 flex flex-col gap-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-none">
      <div className="px-6 flex items-center justify-between gap-2">
        <Skeleton className="h-8 w-32" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-6 w-6 rounded-full" />
        </div>
      </div>
      <div className="w-full h-[156px] relative mt-2">
        <Skeleton className="w-full h-[153px] rounded-none" />
      </div>
      <div className="px-6 flex flex-col justify-between gap-1 h-full">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="flex gap-2 justify-between mt-4">
          <Skeleton className="h-4 w-24" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-xl" />
            <Skeleton className="h-6 w-16 rounded-xl" />
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function Projects() {
  const { projects, isLoading, error } = useProject();
  const router = useRouter();

  const handleNewProject = () => {
    router.push('/hackathons/project-submission');
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-4">
          <Button onClick={handleNewProject}>New project</Button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
          {[...Array(8)].map((_, index) => (
            <ProjectCardSkeleton key={index} />
          ))}
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="text-destructive mb-2">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p className="text-sm font-medium">Error loading projects</p>
            <p className="text-xs text-muted-foreground mt-1">{error.message}</p>
          </div>
        </div>
      )}

      {/* Projects Grid */}
      {!isLoading && !error && (
        <>
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">No projects found</p>
            </div>
          ) : (
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
              {projects.map((project, index) => (
                <ProjectCard project={project} key={project.id || index} isFromProfile={true} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

