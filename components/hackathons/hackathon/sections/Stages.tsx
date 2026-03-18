"use client"

import { Calendar } from "@/components/ui/calendar";
import { HackathonStage } from "@/types/hackathon-stage";
import { JSX, useEffect, useState } from "react";

export default function Stages({ isParticipant = false, stageResults = [] }: { isParticipant?: boolean; stageResults?: { projectName: string; stage1Result: string }[] }) {
  const [todayDate, setTodayDate] = useState<Date>(() => new Date());

  const phaseDeadlines = [
    new Date("2026-02-21T04:59:00Z"), // Kick Off — Feb 20 11:59 PM EST
    new Date("2026-02-26T04:59:00Z"), // Stage 1  — Feb 25 11:59 PM EST
    new Date("2026-03-10T03:59:00Z"), // Stage 2  — Mar  9 11:59 PM EDT
    new Date("2026-03-20T03:59:00Z"), // Stage 3  — Mar 19 11:59 PM EDT
    new Date("2026-03-28T03:59:00Z"), // Stage 4  — Mar 27 11:59 PM EDT
  ];

  // Compute statuses based on todayDate so re-renders from the interval pick
  // up the new day automatically.
  const getPhaseStatuses = (): ("completed" | "current" | "upcoming")[] => {
    let currentPhaseIndex = -1;
    for (let i = 0; i < phaseDeadlines.length; i++) {
      if (todayDate <= phaseDeadlines[i]) {
        currentPhaseIndex = i;
        break;
      }
    }
    if (currentPhaseIndex === -1) return phaseDeadlines.map(() => "completed");
    return phaseDeadlines.map((_, index) => {
      if (index < currentPhaseIndex) return "completed";
      if (index === currentPhaseIndex) return "current";
      return "upcoming";
    });
  };

  const statuses = getPhaseStatuses();

  const competitionPhases: any[] = [
    {
      label: "Stage 2: MVP",
      status: statuses[2],
      date: "March 9",
      details: {
        deadline: "March 9, 2026 at 11:59 PM EST",
        requirements: "Functional prototype, GitHub repository with code, technical implementaiton details, and product walkthrough video (max 5 mins) demonstrating key features.",
        criteria: "Technical implementation quality, use of Avalanche technologies, MVP architecture design, and UX design.",
        support: "Attend the Office Hours and get feedback from mentors and other builders. Schedule a time here: ",
      },
    },
    {
      label: "Stage 3: GTM & Vision",
      status: statuses[3],
      date: "March 19",
      details: {
        deadline: "March 19, 2026 at 11:59 PM EST",
        requirements: "Go-to-market plan, growth strategy, target user personas, competitive analysis, and long-term product vision document.",
        criteria: "Market understanding, growth strategy viability, user acquisition plan, business model clarity, and scalability potential.",
        support: "Attend the Office Hours and get feedback from mentors and other builders. Schedule a time here:.",
      }
    }
  ];

  const [selectedPhaseIndex, setSelectedPhaseIndex] = useState(0);
  const [currentPhase, setCurrentPhase] = useState<any | null>(null);
  const [daysUntilStart, setDaysUntilStart] = useState<number | null>(null);

  // Advance todayDate at midnight without requiring a page reload.
  useEffect(() => {
    const interval = setInterval(() => {
      setTodayDate(new Date());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Sync the selected/current phase whenever todayDate advances to a new day.
  useEffect(() => {
    const current = competitionPhases.find((phase) => phase.status === "current");
    const currentIndex = competitionPhases.findIndex((phase) => phase.status === "current");
    setCurrentPhase(current || null);
    setSelectedPhaseIndex(currentIndex >= 0 ? currentIndex : 0);

    if (current && currentIndex >= 0) {
      const diffTime = phaseDeadlines[currentIndex].getTime() - todayDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setDaysUntilStart(diffDays > 0 ? diffDays : null);
    }
  }, [todayDate]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="border border-[#d66666]/20 relative rounded-[16px] shrink-0 w-full">
      <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-cover opacity-30 pointer-events-none rounded-[16px] size-full" src="/build-games/frame-23.png" />
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

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            <a
              href="https://calendar.google.com/calendar"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative inline-flex shrink-0"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-[#d66666] via-[#f83838] to-[#d66666] rounded-lg blur-sm opacity-30 group-hover:opacity-50 transition duration-300" />
              <div className="relative flex items-center gap-2 px-4 py-3 bg-[#d66666] rounded-lg font-medium text-[#152d44] group-hover:bg-[#e57f7f] transition-all duration-200 shadow-lg shadow-amber-500/20 group-hover:shadow-amber-500/40">
                {/* <Calendar size={20} className="shrink-0" /> */}
                <span className="text-[15px]">Add to Calendar</span>
              </div>
            </a>
          </div>
        </div>

        {/* Timeline */}
        <div className="mb-12 rounded-2xl bg-[rgba(255,255,255,0.03)] border border-[#d66666]/20 overflow-hidden backdrop-blur-sm w-full shadow-lg shadow-black/20 relative">
          <DesktopTimeline
            phases={competitionPhases}
            onPhaseClick={setSelectedPhaseIndex}
            selectedIndex={selectedPhaseIndex}
          />

          {/* Bottom section with Current Stage and Helper text */}
          <div className="flex items-center justify-between px-8 pb-6 gap-4">
            {/* Current Stage Indicator - Left */}
            {currentPhase && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[rgba(214,102,102,0.1)] to-[rgba(214,102,102,0.05)] border border-[#66acd6]/20">
                <div className="relative flex items-center justify-center w-6 h-6 shrink-0">
                  <div className="absolute w-2 h-2 rounded-full bg-[#d66666] animate-pulse" />
                  <div className="absolute w-2 h-2 rounded-full bg-[#d66666] animate-ping opacity-75" />
                </div>
                <div className="flex items-center gap-2">
                  {currentPhase.label === 'Kick Off' ? (
                    <>
                      <span className="text-white/50 text-[10px] uppercase tracking-wider">
                        {daysUntilStart ? 'Next' : 'Current'}
                      </span>
                      <span className="text-[#d66666] text-[13px]">{currentPhase.label}</span>
                      {daysUntilStart && (
                        <span className="text-white/50 text-[11px]">
                          · starts in {daysUntilStart} {daysUntilStart === 1 ? 'day' : 'days'}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="text-white/50 text-[10px] uppercase tracking-wider">
                        Next Submission:
                      </span>
                      <span className="text-[#d66666] text-[13px]">{currentPhase.label}</span>
                      <span className="text-white/50 text-[11px]">
                        · deadline in {daysUntilStart ?? 0} {(daysUntilStart ?? 0) === 1 ? 'day' : 'days'}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Helper text - Right */}
            <p className="text-[13px] text-[#d66666]">
              Click on each stage to view details
            </p>
          </div>

          {/* Stage 1 result banners — always visible when results exist */}
          {stageResults.length > 0 && (
            <div className="px-8 pb-6 flex flex-col gap-3">
              {stageResults.map((r) => (
                // <Stage1ResultBanner key={r.projectName} result={r.stage1Result} projectName={r.projectName} />
                <div></div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Phase Details */}
        <div className="mb-12 w-full">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#d66666]/30 to-transparent" />
            <h3 className="text-[32px] font-medium text-white">
              {competitionPhases[selectedPhaseIndex].label}
            </h3>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#d66666]/30 to-transparent" />
          </div>

          {/* Show special Kick Off details for index 0, regular cards for others */}
          {selectedPhaseIndex === 0 ? (
            <TagsComponent/>
          ) : (
            <CardsComponent phase={competitionPhases[selectedPhaseIndex]} />
          )}
        </div>
      </div>
    </div>
  );
}
function DesktopTimeline({
  phases,
  onPhaseClick,
  selectedIndex
}: {
  phases: HackathonStage[];
  onPhaseClick: (index: number) => void;
  selectedIndex: number;
}) {
  return (
    <div className="hidden md:flex items-start justify-between w-full py-12 px-8 relative">
      {phases.map((phase, index) => (
        <div key={phase.label} className="flex flex-col items-center flex-1 relative">
          {/* Circle */}
          <button
            onClick={() => onPhaseClick(index)}
            className={`rounded-full p-1 transition-all duration-300 active:scale-95 mb-4 hover:bg-[#d66666]/10 ${index === selectedIndex
              ? 'bg-[#d66666]/20 px-6 py-3 rounded-full shadow-lg shadow-amber-500/20'
              : 'px-2 py-2'
              }`}
          >
            <PhaseIcon status={phase.status}/>
          </button>

          {/* Text */}
          <div className="flex flex-col items-center px-2">
            <span
            className={`text-[14px] text-center ${
              phase.status === "completed" || phase.status === "current" ? "text-white" : "text-[rgba(255,255,255,0.5)]"
            }`}
            >
              {phase.label}
            </span>
            <span className="text-[12px] text-[rgba(255,255,255,0.5)]">
              {phase.date.toString()}
            </span>
          </div>

          {/* Connecting line */}
          {index < phases.length - 1 && (
            <div
            className={`absolute top-[15px] left-[calc(50%+20px)] w-[calc(100%-40px)] h-[2px] ${
              phases[index + 1].status === "completed" || phases[index + 1].status === "current" ? "bg-[#d66666]" : "bg-[rgba(214,102,102,0.3)]"
            }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function PhaseIcon({ status }: { status: 'completed' | 'current' | 'upcoming' }) {
  if (status === "completed") {
    return (
      <div className="w-[28px] h-[28px] rounded-full bg-[#d66666] flex items-center justify-center shrink-0">
        <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
          <path d="M1 5L5 9L13 1" stroke="#152d44" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
type TagItem = {
  icon: JSX.Element;
  title: string;
  description: string;
};

const TAG_ITEMS: TagItem[] = [
  {
    icon: (
      <svg className="w-5 h-5 text-[#d66666]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: "Deep Dive into the Program",
    description: "Get a comprehensive overview of BuildGames, meet your mentors, and understand what's ahead in the coming weeks."
  },
  {
    icon: (
      <svg className="w-5 h-5 text-[#d66666]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
    title: "Hands-On Workshops",
    description: "Participate in product workshops that will help you identify market opportunities, validate assumptions, and craft your idea into something truly valuable."
  },
  {
    icon: (
      <svg className="w-5 h-5 text-[#d66666]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    title: "Team Formation & Co-founder Matching",
    description: "Connect with fellow builders through structured activities designed to help you find co-founders, teammates, and collaborators who share your vision."
  },
  {
    icon: (
      <svg className="w-5 h-5 text-[#d66666]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    title: "Industry Insights",
    description: "Learn from multiple industry experts who will share insights on market trends, emerging opportunities, and what makes ideas succeed in the Avalanche ecosystem."
  }
];
type PhaseDetailItem = {
  title: string;
  value: React.ReactNode;
};

function CardsComponent({ phase }: { phase: any }): JSX.Element {
  const detailItems: PhaseDetailItem[] = [
    {
      title: "Deadline",
      value: phase.details.deadline
    },
    {
      title: "Requirements",
      value: phase.details.requirements
    },
    {
      title: "Evaluation Criteria",
      value: phase.details.criteria
    },
    {
      title: "Support",
      value: phase.details.support
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {detailItems.map((item: PhaseDetailItem, index: number) => (
        <div
          key={item.title}
          className="group relative p-6 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[#d66666]/20 backdrop-blur-sm hover:bg-[rgba(255,255,255,0.04)] transition-all duration-300 hover:border-[#d66666]/40 hover:shadow-lg hover:shadow-[#d66666]/10"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#d66666]/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />

          <div className="relative">
            <div className="flex items-center justify-center w-12 h-12 mb-4 rounded-lg bg-[#d66666]/10 border border-[#d66666]/20">
              {getPhaseDetailIcon(index)}
            </div>

            <h3 className="text-lg font-medium text-white mb-3">
              {item.title}
            </h3>

            <div className="text-[15px] text-white/70 leading-relaxed">
              {item.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function getPhaseDetailIcon(index: number): JSX.Element {
  if (index === 0) {
    return (
      <svg className="w-6 h-6 text-[#d66666]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m-11 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v11a2 2 0 002 2z" />
      </svg>
    );
  }

  if (index === 1) {
    return (
      <svg className="w-6 h-6 text-[#d66666]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    );
  }

  if (index === 2) {
    return (
      <svg className="w-6 h-6 text-[#d66666]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 21h8m-4-4v4m5-13V7a5 5 0 00-10 0v1H5v3a7 7 0 0014 0V8h-2z" />
      </svg>
    );
  }

  return (
    <svg className="w-6 h-6 text-[#d66666]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}
function TagsComponent(): JSX.Element {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[rgba(214,102,102,0.08)] via-[rgba(214,102,102,0.04)] to-transparent border border-[#d66666]/30 p-8 md:p-12">
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#d66666]/5 rounded-full blur-3xl" />

      <div className="relative">
        <div className="mb-8">
          <h3 className="text-[28px] text-white mb-4">
            Join us for an inspiring first day! 🚀
          </h3>
          <p className="text-[18px] text-white/80 leading-relaxed">
            Kick off your BuildGames journey with a full day of immersive experiences designed to set you up for success.
          </p>
        </div>

        <div className="space-y-6">
          {TAG_ITEMS.map((item: TagItem, index: number) => (
            <div key={index} className="flex gap-4 items-start">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#d66666]/20 border border-[#d66666]/30 flex items-center justify-center">
                {item.icon}
              </div>

              <div className="flex-1">
                <h4 className="text-[17px] text-white mb-2">
                  {item.title}
                </h4>
                <p className="text-[15px] text-white/70 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA se queda igual */}
      </div>
    </div>
  );
}

function getStageStatus(stage: HackathonStage): 'completed' | 'current' | 'upcoming' {
  if (stage.deadline < new Date()) {
    return 'completed';
  }
  if (stage.deadline > new Date() && stage.date < new Date()) {
    return 'current';
  }
  return 'upcoming';
}