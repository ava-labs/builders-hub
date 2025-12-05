import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Project } from "@/types/showcase";
import { MapPin, Trophy, Code2 } from "lucide-react";
import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function parseLinks(linkString: string): string[] {
  if (!linkString) return [];
  return linkString
    .split(/[,\s\n]+/)
    .map(l => l.trim())
    .filter(l => l.startsWith('http://') || l.startsWith('https://'));
}

function getRepoPath(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
    return parts[parts.length - 1] || url;
  } catch {
    return url;
  }
}


type Props = {
  project: Project;
};
export default function Info({ project }: Props) {
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="flex flex-col sm:flex-row justify-between gap-8 lg:gap-24">
        <div className="flex items-center gap-3 md:gap-4">
          <h1 className="text-2xl md:text-5xl font-bold md:font-extrabold break-all">
            {project.project_name.slice(0, 55)}
            {project.project_name.length > 55 ? "..." : ""}
          </h1>
          {project.prizes.length > 1 && (
            <div className="p-2 bg-red-500 rounded-full">
              <Trophy
                size={30}
                color="white"
                className="w-6 h-6 md:w-8 md:h-8"
              />
            </div>
          )}
        </div>
        <div className="max-w-[60%] flex items-center gap-3 md:gap-6">
          <MapPin
            size={18}
            className="min-w-5 w-5 h-5 !text-zinc-700 dark:!text-zinc-300"
          />
          <p className="text-xs text-zinc-700 dark:text-zinc-300">
            {`${project.hackathon?.title ?? ""} ${
              project.hackathon?.location ?? ""
            } ${project.hackathon?.start_date ? new Date(project.hackathon.start_date).getFullYear() : ""}`}
          </p>
        </div>
      </div>
      <p className="text-zinc-900 dark:text-zinc-50">
        {project.short_description}
      </p>
      <div className="flex flex-wrap gap-2">
        {project.tracks?.map((tag) => (
          <Badge
            key={tag}
            variant="outline"
            className="border-2 border-zinc-900 dark:border-zinc-50 flex justify-center rounded-xl"
          >
            {tag}
          </Badge>
        ))}
      </div>
      
      <div className="flex flex-wrap gap-4">
        {project.demo_link && (() => {
          const firstLink = parseLinks(project.demo_link)[0];
          return firstLink ? (
            <Link href={firstLink} target="_blank">
              <Button
                variant="secondary"
                className="flex-1 md:flex-none bg-red-500 hover:bg-red-500 text-zinc-50"
              >
                Live Demo
              </Button>
            </Link>
          ) : null;
        })()}
        {project.github_repository && (() => {
          const repos = parseLinks(project.github_repository);
          if (repos.length === 0) return null;

          // If single repo, show simple button
          if (repos.length === 1) {
            return (
              <Link href={repos[0]} target="_blank">
                <Button
                  variant="secondary"
                  className="flex-1 md:flex-none bg-zinc-900 hover:bg-zinc-900 dark:bg-zinc-50 hover:dark:bg-zinc-50 text-zinc-50 dark:text-zinc-900"
                >
                  Source Code
                </Button>
              </Link>
            );
          }

          // Multiple repos - show each with friendly label and tooltip
          return repos.map((repo, index) => (
            <Tooltip key={index}>
              <TooltipTrigger asChild>
                <Link href={repo} target="_blank">
                  <Button
                    variant="secondary"
                    className="flex-1 md:flex-none bg-zinc-900 hover:bg-zinc-900 dark:bg-zinc-50 hover:dark:bg-zinc-50 text-zinc-50 dark:text-zinc-900 gap-2"
                  >
                    <Code2 className="w-4 h-4" />
                    Repo {index + 1}
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                <p>{getRepoPath(repo)}</p>
              </TooltipContent>
            </Tooltip>
          ));
        })()}
      </div>
    </div>
  );
}
