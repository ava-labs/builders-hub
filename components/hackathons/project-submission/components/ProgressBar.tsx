import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Hourglass } from "lucide-react";

interface ProgressBarProps {
  progress: number;
  timeLeft: string;
}

export const ProgressBar = ({ progress, timeLeft }: ProgressBarProps) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4 w-full md:w-auto">
        <Progress
          value={progress}
          className="rounded-full h-4 w-[294px] md:w-[430px]"
        />
        <span className="text-sm">
          {progress}% Complete - Finish your submission!
        </span>
      </div>

      <Badge
        variant="outline"
        className="flex items-center gap-2 border-red-500 px-3 py-1"
      >
        <Hourglass size={16} color="#F5F5F9" />
        <span>Deadline: {timeLeft} remaining</span>
      </Badge>
    </div>
  );
}; 