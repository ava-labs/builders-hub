"use client";

import { HackathonStage, TagItem as StageTagItem } from "@/types/hackathon-stage";
import { JSX, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { HackathonHeader } from "@/types/hackathons";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Upload } from "lucide-react";
import StageSubmitPageContent from '@/components/hackathons/project-submission/stages/submit-form/page-content'

type StageStatus = "completed" | "current" | "upcoming";

export default function Stages({ isParticipant, stages, hackathon, renderInPreview }: { isParticipant: boolean; stages: HackathonStage[]; hackathon: HackathonHeader; renderInPreview?: boolean }): JSX.Element {
  const [todayDate, setTodayDate] = useState<Date>(() => new Date());
  const [selectedPhaseIndex, setSelectedPhaseIndex] = useState<number>(0);

  useEffect(() => {
    const interval: ReturnType<typeof setInterval> = setInterval((): void => {
      setTodayDate(new Date());
    }, 60_000);

    return (): void => clearInterval(interval);
  }, []);

  const normalizedStages: HackathonStage[] = useMemo((): HackathonStage[] => {
    return [...stages].sort((a: HackathonStage, b: HackathonStage): number => {
      return parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime();
    });
  }, [stages]);

  const currentStageIndex: number = useMemo((): number => {
    return normalizedStages.findIndex((stage: HackathonStage): boolean => {
      return getStageStatus(stage, todayDate) === "current";
    });
  }, [normalizedStages, todayDate]);

  const nextUpcomingStageIndex: number = useMemo((): number => {
    return normalizedStages.findIndex((stage: HackathonStage): boolean => {
      return getStageStatus(stage, todayDate) === "upcoming";
    });
  }, [normalizedStages, todayDate]);

  const highlightedStageIndex: number =
    currentStageIndex >= 0 ? currentStageIndex : nextUpcomingStageIndex >= 0 ? nextUpcomingStageIndex : 0;

  const highlightedStage: HackathonStage | null =
    normalizedStages[highlightedStageIndex] ?? null;

  const daysUntilRelevantDate: number | null = useMemo((): number | null => {
    if (!highlightedStage) {
      return null;
    }

    const highlightedStatus: StageStatus = getStageStatus(highlightedStage, todayDate);

    const targetDate: Date =
      highlightedStatus === "current"
        ? parseLocalDate(highlightedStage.deadline)
        : parseLocalDate(highlightedStage.date);

    const diffTime: number = targetDate.getTime() - todayDate.getTime();
    const diffDays: number = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays > 0 ? diffDays : 0;
  }, [highlightedStage, todayDate]);

  useEffect((): void => {
    if (normalizedStages.length === 0) {
      return;
    }

    if (selectedPhaseIndex < normalizedStages.length) {
      return;
    }

    if (currentStageIndex >= 0) {
      setSelectedPhaseIndex(currentStageIndex);
      return;
    }

    if (nextUpcomingStageIndex >= 0) {
      setSelectedPhaseIndex(nextUpcomingStageIndex);
      return;
    }

    setSelectedPhaseIndex(0);
  }, [normalizedStages.length, currentStageIndex, nextUpcomingStageIndex]);

  const selectedStage: HackathonStage | null = normalizedStages[selectedPhaseIndex] ?? null;

  if (normalizedStages.length === 0) {
    return <></>;
  }

  return (
    <div className="border border-[#d66666]/20 relative rounded-[16px] shrink-0 w-full">
      <img
        alt=""
        className="absolute inset-0 max-w-none object-50%-50% object-cover opacity-30 pointer-events-none rounded-[16px] size-full"
        src="/build-games/frame-23.png"
      />

      <div className="content-stretch flex flex-col items-start overflow-clip pb-[48px] pt-[48px] px-[48px] relative rounded-[inherit] w-full">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-12 w-full">
          <div className="content-stretch flex flex-col gap-[10px] items-start overflow-clip p-[10px] relative shrink-0">
            <div className="flex flex-col justify-center leading-[0] not-italic relative shrink-0 text-[48px] text-white">
              <p className="text-md sm:text-xl md:text-3xl lg:text-4xl xl:text-5xl text-zinc-50 font-bold sm:mb-2">
                Program
                <br aria-hidden="true" />
                Timeline
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="https://calendar.google.com/calendar"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative inline-flex shrink-0"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-[#d66666] via-[#f83838] to-[#d66666] rounded-lg blur-sm opacity-30 group-hover:opacity-50 transition duration-300" />
              <div className="relative flex items-center gap-2 px-4 py-3 bg-[#d66666] rounded-lg font-medium text-[#152d44] group-hover:bg-[#e57f7f] transition-all duration-200 shadow-lg shadow-amber-500/20 group-hover:shadow-amber-500/40">
                <span className="text-[15px]">Add to Calendar</span>
              </div>
            </a>
          </div>
        </div>

        <div className="mb-12 rounded-2xl bg-[rgba(255,255,255,0.03)] border border-[#d66666]/20 overflow-hidden backdrop-blur-sm w-full shadow-lg shadow-black/20 relative">
          <DesktopTimeline
            phases={normalizedStages}
            onPhaseClick={setSelectedPhaseIndex}
            selectedIndex={selectedPhaseIndex}
            todayDate={todayDate}
          />

          <div className="flex items-center justify-between px-8 pb-6 gap-4">
            {highlightedStage && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[rgba(214,102,102,0.1)] to-[rgba(214,102,102,0.05)] border border-[#66acd6]/20">
                <div className="relative flex items-center justify-center w-6 h-6 shrink-0">
                  <div className="absolute w-2 h-2 rounded-full bg-[#d66666] animate-pulse" />
                  <div className="absolute w-2 h-2 rounded-full bg-[#d66666] animate-ping opacity-75" />
                </div>

                <div className="flex items-center gap-2">
                  {getStageStatus(highlightedStage, todayDate) === "current" ? (
                    <>
                      <span className="text-white/50 text-[10px] uppercase tracking-wider">
                        Current Stage:
                      </span>
                      <span className="text-[#d66666] text-[13px]">{highlightedStage.label}</span>
                      <span className="text-white/50 text-[11px]">
                        · deadline in {daysUntilRelevantDate ?? 0}{" "}
                        {(daysUntilRelevantDate ?? 0) === 1 ? "day" : "days"}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-white/50 text-[10px] uppercase tracking-wider">
                        Next Stage:
                      </span>
                      <span className="text-[#d66666] text-[13px]">{highlightedStage.label}</span>
                      <span className="text-white/50 text-[11px]">
                        · starts in {daysUntilRelevantDate ?? 0}{" "}
                        {(daysUntilRelevantDate ?? 0) === 1 ? "day" : "days"}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}

            <p className="text-[13px] text-[#d66666]">
              Click on each stage to view details
            </p>
          </div>
        </div>

        {selectedStage && (
          <div className="flex flex-col items-center gap-4 w-full">
            <div className="mb-12 !w-full">
              <div className="flex items-center gap-4 mb-8">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#d66666]/30 to-transparent" />
                <h3 className="text-[32px] font-medium text-white">
                  {selectedStage.label}
                </h3>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#d66666]/30 to-transparent" />
              </div>

              {renderStageComponent(selectedStage)}

            </div>
            {
              selectedStage.submitForm && (
                renderInPreview ? (
                  <Dialog>
                    <DialogTrigger asChild>
                      <button
                        type="button"
                        className="group relative inline-flex cursor-pointer"
                      >
                        <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-[#d66666] via-[#f83838] to-[#d66666] blur-sm opacity-40 transition duration-500 group-hover:opacity-70" />
                        <div className="relative flex items-center gap-3 rounded-xl bg-[#d66666] px-10 py-5 font-['Aeonik:Medium',sans-serif] font-medium text-[#152d44] shadow-xl shadow-[#d66666]/30 transition-all duration-200 group-hover:scale-105 group-hover:bg-[#e57f7f] group-hover:shadow-[#d66666]/50">
                          <Upload className="h-5 w-5 text-zinc-900" />
                          <span className="text-[17px] font-semibold text-zinc-900">
                            Submit
                          </span>
                        </div>
                      </button>
                    </DialogTrigger>

                    <DialogContent>
                      <StageSubmitPageContent
                        hackathon={hackathon}
                        hackathonCreator={''}
                        stage={selectedStage}
                        stageIndex={selectedPhaseIndex}
                        renderInPreview={renderInPreview}
                      />
                    </DialogContent>
                  </Dialog>
                ) : (
                  <Link href={`/hackathons/${hackathon.id}/stage-form?stage=${selectedPhaseIndex}`}>
                    <button type="button" className="group relative inline-flex cursor-pointer">
                      <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-[#d66666] via-[#f83838] to-[#d66666] blur-sm opacity-40 transition duration-500 group-hover:opacity-70" />
                      <div className="relative flex items-center gap-3 rounded-xl bg-[#d66666] px-10 py-5 font-['Aeonik:Medium',sans-serif] font-medium text-[#152d44] shadow-xl shadow-[#d66666]/30 transition-all duration-200 group-hover:scale-105 group-hover:bg-[#e57f7f] group-hover:shadow-[#d66666]/50">
                        <Upload className="h-5 w-5 text-zinc-900" />
                        <span className="text-[17px] font-semibold text-zinc-900">
                          Submit
                        </span>
                      </div>
                    </button>
                  </Link>
                )
              )
            }
          </div>
        )}
      </div>
    </div>
  );
}

function DesktopTimeline({
  phases,
  onPhaseClick,
  selectedIndex,
  todayDate,
}: {
  phases: HackathonStage[];
  onPhaseClick: (index: number) => void;
  selectedIndex: number;
  todayDate: Date;
}): JSX.Element {
  return (
    <div className="hidden md:flex items-start justify-between w-full py-12 px-8 relative">
      {phases.map((phase: HackathonStage, index: number): JSX.Element => {
        const status: StageStatus = getStageStatus(phase, todayDate);
        const nextPhaseStatus: StageStatus | null =
          index < phases.length - 1 ? getStageStatus(phases[index + 1], todayDate) : null;

        return (
          <div key={phase.label} className="flex flex-col items-center flex-1 relative">
            <button
              onClick={(): void => onPhaseClick(index)}
              className={`rounded-full p-1 transition-all duration-300 active:scale-95 mb-4 hover:bg-[#d66666]/10 ${index === selectedIndex
                ? "bg-[#d66666]/20 px-6 py-3 rounded-full shadow-lg shadow-amber-500/20"
                : "px-2 py-2"
                }`}
            >
              <PhaseIcon status={status} />
            </button>

            <div className="flex flex-col items-center px-2">
              <span
                className={`text-[14px] text-center ${status === "completed" || status === "current"
                  ? "text-white"
                  : "text-[rgba(255,255,255,0.5)]"
                  }`}
              >
                {phase.label}
              </span>

              <span className="text-[12px] text-[rgba(255,255,255,0.5)]">
                {formatStageDate(phase.date)}
              </span>
            </div>

            {index < phases.length - 1 && (
              <div
                className={`absolute top-[15px] left-[calc(50%+20px)] w-[calc(100%-40px)] h-[2px] ${nextPhaseStatus === "completed" || nextPhaseStatus === "current"
                  ? "bg-[#d66666]"
                  : "bg-[rgba(214,102,102,0.3)]"
                  }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function PhaseIcon({ status }: { status: StageStatus }): JSX.Element {
  if (status === "completed") {
    return (
      <div className="w-[28px] h-[28px] rounded-full bg-[#d66666] flex items-center justify-center shrink-0">
        <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
          <path
            d="M1 5L5 9L13 1"
            stroke="#152d44"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  if (status === "current") {
    return (
      <div className="w-[28px] h-[28px] rounded-full border-2 border-[#d66666] bg-[#441515] flex items-center justify-center shrink-0">
        <div className="w-[12px] h-[12px] rounded-full bg-[#d66666] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="w-[28px] h-[28px] rounded-full border-2 border-[rgba(214,102,102,0.4)] bg-transparent shrink-0" />
  );
}

type PhaseDetailItem = {
  icon: string;
  title: string;
  description: string;
};

function CardsComponent({ stage }: { stage: HackathonStage }): JSX.Element | null {
  if (stage.component?.type !== "cards") {
    return null;
  }

  const detailItems: PhaseDetailItem[] = stage.component.cards;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {detailItems.map((item: PhaseDetailItem, index: number): JSX.Element => (
        <div
          key={`${item.title}-${index}`}
          className="group relative p-6 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[#d66666]/20 backdrop-blur-sm hover:bg-[rgba(255,255,255,0.04)] transition-all duration-300 hover:border-[#d66666]/40 hover:shadow-lg hover:shadow-[#d66666]/10"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#d66666]/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />

          <div className="relative">
            {/* <div className="flex items-center justify-center w-12 h-12 mb-4 rounded-lg bg-[#d66666]/10 border border-[#d66666]/20">
              {renderIcon(item.icon)}
            </div> */}

            <h3 className="text-lg font-medium text-white mb-3">{item.title}</h3>

            <div className="text-[15px] text-white/70 leading-relaxed">
              {item.description}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TagsComponent({ stage }: { stage: HackathonStage }): JSX.Element | null {
  if (stage.component?.type !== "tags") {
    return null;
  }

  const items: StageTagItem[] = stage.component.tags;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[rgba(214,102,102,0.08)] via-[rgba(214,102,102,0.04)] to-transparent border border-[#d66666]/30 p-8 md:p-12">
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#d66666]/5 rounded-full blur-3xl" />

      <div className="relative">
        <div className="mb-8">
          <h3 className="text-[28px] text-white mb-4">
            {stage.component.title}
          </h3>

          <p className="text-[18px] text-white/80 leading-relaxed">
            {stage.component.description}
          </p>
        </div>

        <div className="space-y-6">
          {items.map((item: StageTagItem, index: number): JSX.Element => (
            <div key={`${item.title}-${index}`} className="flex gap-4 items-start">
              {/* <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#d66666]/20 border border-[#d66666]/30 flex items-center justify-center">
                {renderIcon(item.icon, "small")}
              </div> */}

              <div className="flex-1">
                <h4 className="text-[17px] text-white mb-2">{item.title}</h4>
                <p className="text-[15px] text-white/70 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getStageStatus(stage: HackathonStage, now: Date = new Date()): StageStatus {
  const startDate: Date = startOfDay(parseLocalDate(stage.date));
  const endDate: Date = endOfDay(parseLocalDate(stage.deadline));

  if (endDate < now) {
    return "completed";
  }

  if (startDate <= now && endDate >= now) {
    return "current";
  }

  return "upcoming";
}

function parseLocalDate(dateString: string): Date {
  const [year, month, day]: number[] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function formatStageDate(dateString: string): string {
  const date: Date = parseLocalDate(dateString);

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}

function renderStageComponent(stage: HackathonStage): React.JSX.Element | null {
  if (!stage.component) return null

  switch (stage.component.type) {
    case 'cards':
      return <CardsComponent stage={stage} />

    case 'tags':
      return <TagsComponent stage={stage} />

    default:
      return null
  }
}
