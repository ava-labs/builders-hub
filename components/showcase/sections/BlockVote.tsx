import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Project } from "@/types/showcase";
import { MapPin, Trophy } from "lucide-react";

type Props = {
  project: Project;
};
export default function BlockVote({ project }: Props) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-between">
        <div className="flex items-center gap-3 md:gap-6">
          <h1 className="text-3xl md:text-5xl font-bold md:font-extrabold">BlockVote</h1>
          {project.isWinner && (
            <div className="p-2 bg-red-500 rounded-full">
              <Trophy size={30} color="white" className="w-4 h-4 md:w-8 md:h-8" />
            </div>
          )}
        </div>
        <div className="max-w-[60%] flex items-center gap-3 md:gap-6">
          <MapPin size={18} color="#BFBFC7" />
          <p className="text-xs text-zinc-300">
            {`${project.event.name} ${project.event.location} ${project.event.year}`}
          </p>
        </div>
      </div>
      <p className="text-zinc-50">{project.shortDescription}</p>
      <div className="flex gap-2">
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
      <div className="flex gap-4">
        {project.liveDemoUrl && (
          <Button variant="secondary" className="bg-red-500 text-zinc-50">
            Live Demo
          </Button>
        )}
        {project.sourceCodeUrl && (
          <Button variant="secondary" className="bg-zinc-50 text-zinc-900">
            Source Code
          </Button>
        )}
      </div>
    </div>
  );
}
