import { Progress } from "@/components/ui/progress";
import { EventsLang, t } from "@/lib/events/i18n";

interface ProgressBarProps {
  progress: number;
  lang?: EventsLang;
}

export const ProgressBar = ({ progress, lang = "en" }: ProgressBarProps) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4 w-full md:w-auto">
        <Progress
          value={progress}
          className="rounded-full h-4 w-[294px] md:w-[430px]"
        />
        <span className="text-sm">
          {t(lang, "submission.progress.complete", { progress })}
        </span>
      </div>
    </div>
  );
}; 