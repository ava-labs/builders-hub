"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Project } from "@/types/showcase";
import { MapPin, Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type Props = {
  project: Project;
};
export default function Info({ project }: Props) {
  const parseLinks = (linkString: string | null | undefined): string[] => {
    if (!linkString) return [];
    return linkString.split(',').map(link => link.trim()).filter(link => link.length > 0);
  };
  const [demoLinks, setDemoLinks] = useState<string[]>([]);
  const [githubLinks, setGithubLinks] = useState<string[]>([]);

  useEffect(() => {
    setDemoLinks(parseLinks(project.demo_link));
    setGithubLinks(parseLinks(project.github_repository));
  }, [project.demo_link, project.github_repository]);
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

      <div className="flex gap-4 flex-wrap">
        {demoLinks.map((link, index) => (
          <Link key={`demo-${index}`} href={link} target="_blank">
            <Button
              variant="secondary"
              className="flex-1 md:flex-none bg-red-500 hover:bg-red-600 text-zinc-50"
            >
              Link {demoLinks.length > 1 ? `${index + 1}` : ''}
            </Button>
          </Link>
        ))}
        {githubLinks.map((link, index) => (
          <Link key={`github-${index}`} href={link} target="_blank">
            <Button
              variant="secondary"
              className="flex-1 md:flex-none bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-50 hover:dark:bg-zinc-200 text-zinc-50 dark:text-zinc-900"
            >
              Source Code {githubLinks.length > 1 ? `${index + 1}` : ''}
            </Button>
          </Link>
        ))}
      </div>
    </div>
  );
}
