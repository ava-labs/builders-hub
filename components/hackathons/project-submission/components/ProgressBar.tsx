import { Progress } from "@/components/ui/progress";

interface ProgressBarProps {
  progress: number;
}

export const ProgressBar = ({ progress }: ProgressBarProps) => {
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
    </div>
  );
}; 