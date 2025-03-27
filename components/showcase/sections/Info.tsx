import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Project } from "@/types/showcase";
import { MapPin, Trophy } from "lucide-react";

type Props = {
  project: Project;
};
export default function Info({ project }: Props) {
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="flex flex-col sm:flex-row justify-between gap-12 lg:gap-24">
        <div className="flex items-center gap-3 md:gap-4">
          <h1 className="text-2xl md:text-5xl font-bold md:font-extrabold">{project.name}</h1>
          {project.isWinner && (
            <div className="p-2 bg-red-500 rounded-full">
              <Trophy size={30} color="white" className="w-6 h-6 md:w-8 md:h-8" />
            </div>
          )}
        </div>
        <div className="max-w-[60%] flex items-center gap-3 md:gap-6">
          <MapPin size={18} color="#BFBFC7" className="min-w-5 w-5 h-5" />
          <p className="text-xs text-zinc-300">
            {`${project.event.name} ${project.event.location} ${project.event.year}`}
          </p>
        </div>
      </div>
      <p className="text-zinc-50">{project.shortDescription}</p>
      <div className="flex flex-wrap gap-2">
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
          <Button variant="secondary" className="flex-1 md:flex-none bg-red-500 text-zinc-50">
            Live Demo
          </Button>
        )}
        {project.sourceCodeUrl && (
          <Button variant="secondary" className="flex-1 md:flex-none bg-zinc-50 text-zinc-900">
            Source Code
          </Button>
        )}
      </div>
    </div>
  );
}
