"use client";

import { Badge } from "@/components/ui/badge";
import { Project } from "@/types/showcase";
import { MapPin, Trophy } from "lucide-react";
import Image from "next/image";
import { Card } from "../ui/card";
import { Button } from "../ui/button";

type Props = {
  project: Project;
};

export function ProjectCard({ project }: Props) {
  return (
    <Card className="h-[471px] w-[306px] flex flex-col rounded-xl bg-zinc-900 border-none">
      <div className="relative p-6 flex items-start justify-between">
        <h3 className="text-3xl font-medium">{project.name}</h3>
        {project.isWinner && (
          <div className="p-2 bg-red-500 rounded-full">
            <Trophy size={18} color="white" />
          </div>
        )}
      </div>
      <div className="w-full h-[156px] relative mt-2">
        <Image
          src={project.bannerUrl}
          alt={`${project.name} banner`}
          width={306}
          height={153}
          className="w-full h-[153px]"
        />
      </div>

      <div className="p-6 flex flex-col justify-between h-full">
        <p className="text-sm text-zinc-400">{project.shortDescription}</p>
        <div className="flex gap-2 justify-between">
          <div className="max-w-[60%] flex items-center gap-2 xl:gap-6">
            <MapPin size={18} color="#BFBFC7" className="w-5 h-5"/>
            <p className="text-xs text-zinc-300">
              {`${project.event.name} ${project.event.location} ${project.event.year}`}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {project.tracks.map((track) => (
              <Badge
                key={track}
                variant="outline"
                className="border-2 border-zinc-50 flex justify-center"
              >
                {track}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
