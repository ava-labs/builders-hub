"use client";

import { Calendar, Trophy, Users, Check } from "lucide-react";
import { useState, useEffect } from "react";

interface PhaseDetails {
  deadline: string;
  requirements: string;
  criteria: string;
  support: string | React.ReactNode;
}

interface TimelinePhase {
  label: string;
  status: "completed" | "current" | "upcoming";
  date: string;
  details: PhaseDetails;
}

function PhaseIcon({ status }: { status: TimelinePhase["status"] }) {
  if (status === "completed") {
    return (
      <div className="w-[28px] h-[28px] rounded-full bg-[#66acd6] flex items-center justify-center shrink-0">
        <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
          <path d="M1 5L5 9L13 1" stroke="#152d44" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }

  if (status === "current") {
    return (
      <div className="w-[28px] h-[28px] rounded-full border-2 border-[#66acd6] bg-[#152d44] flex items-center justify-center shrink-0">
        <div className="w-[12px] h-[12px] rounded-full bg-[#66acd6] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="w-[28px] h-[28px] rounded-full border-2 border-[rgba(102,172,214,0.4)] bg-transparent shrink-0" />
  );
}

function DesktopTimeline({
  phases,
  onPhaseClick,
  selectedIndex
}: {
  phases: TimelinePhase[];
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
            className={`rounded-full p-1 transition-all duration-300 active:scale-95 mb-4 hover:bg-[#66acd6]/10 ${
              index === selectedIndex
                ? 'bg-[#66acd6]/20 px-6 py-3 rounded-full shadow-lg shadow-cyan-500/20'
                : 'px-2 py-2'
            }`}
          >
            <PhaseIcon status={phase.status} />
          </button>

          {/* Text */}
          <div className="flex flex-col items-center px-2">
            <span
              className={`font-['Aeonik:Medium',sans-serif] text-[14px] text-center ${
                phase.status === "completed" || phase.status === "current" ? "text-white" : "text-[rgba(255,255,255,0.5)]"
              }`}
            >
              {phase.label}
            </span>
            <span className="font-['Aeonik:Regular',sans-serif] text-[12px] text-[rgba(255,255,255,0.5)]">
              {phase.date}
            </span>
          </div>

          {/* Connecting line */}
          {index < phases.length - 1 && (
            <div
              className={`absolute top-[15px] left-[calc(50%+20px)] w-[calc(100%-40px)] h-[2px] ${
                phases[index + 1].status === "completed" || phases[index + 1].status === "current" ? "bg-[#66acd6]" : "bg-[rgba(102,172,214,0.3)]"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function MobileTimeline({
  phases,
  onPhaseClick,
  selectedIndex
}: {
  phases: TimelinePhase[];
  onPhaseClick: (index: number) => void;
  selectedIndex: number;
}) {
  return (
    <div className="flex md:hidden flex-col items-start w-full gap-4 px-4 py-8">
      {phases.map((phase, index) => (
        <div key={phase.label} className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <button
              onClick={() => onPhaseClick(index)}
              className={`rounded-full p-1 transition-all duration-300 active:scale-95 hover:bg-[#66acd6]/10 ${
                index === selectedIndex
                  ? 'bg-[#66acd6]/20 px-3 py-2 rounded-full shadow-lg shadow-cyan-500/20'
                  : 'px-2 py-2'
              }`}
            >
              <PhaseIcon status={phase.status} />
            </button>
            {index < phases.length - 1 && (
              <div
                className={`w-[2px] h-[32px] ${
                  phases[index + 1].status === "completed" || phases[index + 1].status === "current" ? "bg-[#66acd6]" : "bg-[rgba(102,172,214,0.3)]"
                }`}
              />
            )}
          </div>
          <div className="flex flex-col pt-1">
            <span
              className={`font-['Aeonik:Medium',sans-serif] text-[14px] ${
                phase.status === "completed" || phase.status === "current" ? "text-white" : "text-[rgba(255,255,255,0.5)]"
              }`}
            >
              {phase.label}
            </span>
            <span className="font-['Aeonik:Regular',sans-serif] text-[12px] text-[rgba(255,255,255,0.5)]">
              {phase.date}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function KickOffDetails() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[rgba(102,172,214,0.08)] via-[rgba(102,172,214,0.04)] to-transparent border border-[#66acd6]/30 p-8 md:p-12">
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#66acd6]/5 rounded-full blur-3xl" />
      <div className="relative">
        <div className="mb-8">
          <h3 className="text-[28px] font-['Aeonik:Medium',sans-serif] font-medium text-white mb-4">
            Join us for an inspiring first day! 🚀
          </h3>
          <p className="text-[18px] font-['Aeonik:Regular',sans-serif] text-white/80 leading-relaxed">
            Kick off your BuildGames journey with a full day of immersive experiences designed to set you up for success.
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#66acd6]/20 border border-[#66acd6]/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#66acd6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-[17px] font-['Aeonik:Medium',sans-serif] text-white mb-2">Deep Dive into the Program</h4>
              <p className="text-[15px] font-['Aeonik:Regular',sans-serif] text-white/70 leading-relaxed">
                Get a comprehensive overview of BuildGames, meet your mentors, and understand what's ahead in the coming weeks.
              </p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#66acd6]/20 border border-[#66acd6]/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#66acd6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-[17px] font-['Aeonik:Medium',sans-serif] text-white mb-2">Hands-On Workshops</h4>
              <p className="text-[15px] font-['Aeonik:Regular',sans-serif] text-white/70 leading-relaxed">
                Participate in product workshops that will help you identify market opportunities, validate assumptions, and craft your idea into something truly valuable.
              </p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#66acd6]/20 border border-[#66acd6]/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#66acd6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-[17px] font-['Aeonik:Medium',sans-serif] text-white mb-2">Team Formation & Co-founder Matching</h4>
              <p className="text-[15px] font-['Aeonik:Regular',sans-serif] text-white/70 leading-relaxed">
                Connect with fellow builders through structured activities designed to help you find co-founders, teammates, and collaborators who share your vision.
              </p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#66acd6]/20 border border-[#66acd6]/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#66acd6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-[17px] font-['Aeonik:Medium',sans-serif] text-white mb-2">Industry Insights</h4>
              <p className="text-[15px] font-['Aeonik:Regular',sans-serif] text-white/70 leading-relaxed">
                Learn from multiple industry experts who will share insights on market trends, emerging opportunities, and what makes ideas succeed in the Avalanche ecosystem.
              </p>
            </div>
          </div>
        </div>

        <a
          href="https://calendar.google.com/calendar/u/0?cid=Y19mNzExYTJkN2NjZDJhZTY2MWFjYmJlMjE5MDM4ZDZmYzcwMjRjNmFiMzJjNGVmZDhhNmVkYTIxMDY1MGRiODdiQGdyb3VwLmNhbGVuZGFyLmdvb2dsZS5jb20"
          target="_blank"
          rel="noopener noreferrer"
          className="group mt-10 p-6 rounded-xl bg-[rgba(102,172,214,0.08)] border border-[#66acd6]/20 hover:border-[#66acd6]/40 hover:bg-[rgba(102,172,214,0.12)] transition-all duration-300 cursor-pointer block"
        >
          <div className="flex items-start gap-3">
            <Calendar className="text-[#66acd6] flex-shrink-0 mt-1 group-hover:scale-110 transition-transform" size={20} />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-[15px] font-['Aeonik:Medium',sans-serif] text-white mb-1">
                  📅 February 20, 2026
                </p>
                <span className="text-[#66acd6] text-[12px] font-['Aeonik:Medium',sans-serif] opacity-0 group-hover:opacity-100 transition-opacity">
                  + Add to Calendar
                </span>
              </div>
              <p className="text-[14px] font-['Aeonik:Regular',sans-serif] text-white/70">
                Mark your calendar and come prepared to be inspired, connect with fellow builders, and start shaping your idea!
              </p>
            </div>
          </div>
        </a>
      </div>
    </div>
  );
}

function PhaseDetailsCards({ phase }: { phase: TimelinePhase }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="group relative p-6 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[#66acd6]/20 backdrop-blur-sm hover:bg-[rgba(255,255,255,0.04)] transition-all duration-300 hover:border-[#66acd6]/40 hover:shadow-lg hover:shadow-cyan-500/10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#66acd6]/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
        <div className="relative">
          <div className="flex items-center justify-center w-12 h-12 mb-4 rounded-lg bg-[#66acd6]/10 border border-[#66acd6]/20">
            <Calendar className="text-[#66acd6]" size={24} />
          </div>
          <h3 className="text-lg font-['Aeonik:Medium',sans-serif] font-medium text-white mb-3">
            Deadline
          </h3>
          <p className="text-[15px] font-['Aeonik:Regular',sans-serif] text-white/70 leading-relaxed">
            {phase.details.deadline}
          </p>
        </div>
      </div>

      <div className="group relative p-6 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[#66acd6]/20 backdrop-blur-sm hover:bg-[rgba(255,255,255,0.04)] transition-all duration-300 hover:border-[#66acd6]/40 hover:shadow-lg hover:shadow-cyan-500/10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#66acd6]/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
        <div className="relative">
          <div className="flex items-center justify-center w-12 h-12 mb-4 rounded-lg bg-[#66acd6]/10 border border-[#66acd6]/20">
            <Check className="text-[#66acd6]" size={24} />
          </div>
          <h3 className="text-lg font-['Aeonik:Medium',sans-serif] font-medium text-white mb-3">
            Requirements
          </h3>
          <p className="text-[15px] font-['Aeonik:Regular',sans-serif] text-white/70 leading-relaxed">
            {phase.details.requirements}
          </p>
        </div>
      </div>

      <div className="group relative p-6 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[#66acd6]/20 backdrop-blur-sm hover:bg-[rgba(255,255,255,0.04)] transition-all duration-300 hover:border-[#66acd6]/40 hover:shadow-lg hover:shadow-cyan-500/10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#66acd6]/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
        <div className="relative">
          <div className="flex items-center justify-center w-12 h-12 mb-4 rounded-lg bg-[#66acd6]/10 border border-[#66acd6]/20">
            <Trophy className="text-[#66acd6]" size={24} />
          </div>
          <h3 className="text-lg font-['Aeonik:Medium',sans-serif] font-medium text-white mb-3">
            Evaluation Criteria
          </h3>
          <p className="text-[15px] font-['Aeonik:Regular',sans-serif] text-white/70 leading-relaxed">
            {phase.details.criteria}
          </p>
        </div>
      </div>

      <div className="group relative p-6 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[#66acd6]/20 backdrop-blur-sm hover:bg-[rgba(255,255,255,0.04)] transition-all duration-300 hover:border-[#66acd6]/40 hover:shadow-lg hover:shadow-cyan-500/10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#66acd6]/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
        <div className="relative">
          <div className="flex items-center justify-center w-12 h-12 mb-4 rounded-lg bg-[#66acd6]/10 border border-[#66acd6]/20">
            <Users className="text-[#66acd6]" size={24} />
          </div>
          <h3 className="text-lg font-['Aeonik:Medium',sans-serif] font-medium text-white mb-3">
            Support
          </h3>
          <p className="text-[15px] font-['Aeonik:Regular',sans-serif] text-white/70 leading-relaxed">
            {phase.details.support}
          </p>
        </div>
      </div>
    </div>
  );
}

function Stage1ResultBanner({ result, projectName }: { result: string; projectName?: string | null }) {
  const accepted = result === "accepted";
  return (
    <div
      className={`mb-8 flex items-start gap-4 rounded-xl border p-5 ${
        accepted
          ? "bg-emerald-950/40 border-emerald-500/40"
          : "bg-red-950/40 border-red-500/30"
      }`}
    >
      <div
        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
          accepted ? "bg-emerald-500/20" : "bg-red-500/20"
        }`}
      >
        {accepted ? (
          <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </div>
      <div>
        <p className={`font-['Aeonik:Medium',sans-serif] text-[16px] mb-1 ${accepted ? "text-emerald-300" : "text-red-300"}`}>
          {projectName ? (
            accepted
              ? <><strong>{projectName}</strong> advanced to Stage 2!</>
              : <><strong>{projectName}</strong> was not selected to continue</>
          ) : (
            accepted ? "Your project advanced to Stage 2!" : "Your project was not selected to continue"
          )}
        </p>
        <p className="font-['Aeonik:Regular',sans-serif] text-[14px] text-white/60">
          {accepted
            ? "Congratulations — your Stage 1 submission was accepted. Keep building and submit your MVP for Stage 2. If during these days your idea changed, please update your 1st stage submission to always reflect the latest version of your project."
            : "Thank you for participating in Stage 1. We appreciate the effort you put into your submission and you're still welcome to attend the Workshops and Office Hours to get feedback from mentors and other builders to keep building your project."}
        </p>
      </div>
    </div>
  );
}

export default function ProgramTimeline({ isParticipant = false, stage1Result = null, projectName = null }: { isParticipant?: boolean; stage1Result?: string | null; projectName?: string | null }) {
  // Reactive date — updates every minute so the timeline advances automatically
  // without requiring a page reload.
  const [todayDate, setTodayDate] = useState<Date>(() => new Date());

  // Phase deadlines at 11:59 PM NYC time.
  // Feb dates use EST (UTC-5) = 04:59Z next day.
  // Mar dates use EDT (UTC-4, DST starts Mar 8) = 03:59Z next day.
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

  const competitionPhases: TimelinePhase[] = [
    {
      label: "Kick Off",
      status: statuses[0],
      date: "Feb 20",
      details: {
        deadline: "February 20, 2026 - Event Day",
        requirements: "Attend the virtual kick-off event to meet your cohort, mentors, and learn about the program structure and expectations.",
        criteria: "Attendance and engagement during the kick-off session.",
        support: "Meet and greet with mentors, Q&A session, and program overview presentation.",
      },
    },
    {
      label: "Stage 1: Idea",
      status: statuses[1],
      date: "Feb 25",
      details: {
        deadline: "February 25, 2026 at 11:59 PM EST",
        requirements: "Create a 2-minute video clearly explaining your project idea, target problem, solution approach, and value proposition.",
        criteria: "Clarity of idea, problem-solution fit, innovation, presentation quality, and potential market impact.",
        support: (
          <>
            Attend the Product design workshops, and join the <a href="https://t.me/avaxbuildgames" target="_blank" rel="noopener noreferrer" className="underline text-[#66acd6]">Support chat</a>.
          </>
        ),
      },
    },
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
    },
    {
      label: "Stage 4: Finals",
      status: statuses[4],
      date: "March 27",
      details: {
        deadline: "March 27, 2026 - Live presentation",
        requirements: "Final pitch deck, live product demo, complete project documentation, and Q&A session with judges.",
        criteria: "Overall project quality, innovation, technical excellence, market potential, presentation skills, and ecosystem fit.",
        support: "Presentation coaching, demo preparation, final pitch refinement. Attend the Office Hours and get feedback from mentors and other builders. Schedule a time here: ",
      },
    },
  ];

  const [selectedPhaseIndex, setSelectedPhaseIndex] = useState(0);
  const [currentPhase, setCurrentPhase] = useState<TimelinePhase | null>(null);
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
    <div className="gradient-border-section relative rounded-[16px] shrink-0 w-full">
      <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-cover opacity-30 pointer-events-none rounded-[16px] size-full" src="/build-games/frame-23.png" />
      <div className="content-stretch flex flex-col items-start overflow-clip pb-[48px] pt-[48px] px-[48px] relative rounded-[inherit] w-full">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-12 w-full">
          <div className="content-stretch flex flex-col gap-[10px] items-start overflow-clip p-[10px] relative shrink-0">
            <div className="flex flex-col font-['Aeonik:Medium',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[48px] text-white">
              <p className="leading-none">
                Program
                <br aria-hidden="true" />
                Timeline
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <a
              href="https://t.me/avaxbuildgames"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative inline-flex"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-[#66acd6] via-[#38bdf8] to-[#66acd6] rounded-lg blur-sm opacity-20 group-hover:opacity-40 transition duration-300" />
              <div className="relative flex items-center gap-2 px-6 py-3 bg-transparent border border-[#66acd6]/50 rounded-lg font-['Aeonik:Medium',sans-serif] font-medium text-[#66acd6] group-hover:border-[#66acd6] group-hover:bg-[#66acd6]/10 transition-all duration-200">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248-2.012 9.483c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.26 14.4l-2.95-.924c-.64-.203-.654-.64.136-.948l11.527-4.444c.537-.194 1.006.131.589.164z" />
                </svg>
                <span className="text-[15px] whitespace-nowrap">Join the Build Games chat</span>
              </div>
            </a>
            <a
              href="https://calendar.google.com/calendar/u/0?cid=Y19mNzExYTJkN2NjZDJhZTY2MWFjYmJlMjE5MDM4ZDZmYzcwMjRjNmFiMzJjNGVmZDhhNmVkYTIxMDY1MGRiODdiQGdyb3VwLmNhbGVuZGFyLmdvb2dsZS5jb20"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative inline-flex"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-[#66acd6] via-[#38bdf8] to-[#66acd6] rounded-lg blur-sm opacity-30 group-hover:opacity-50 transition duration-300" />
              <div className="relative flex items-center gap-2 px-6 py-3 bg-[#66acd6] rounded-lg font-['Aeonik:Medium',sans-serif] font-medium text-[#152d44] group-hover:bg-[#7fc0e5] transition-all duration-200 shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/40">
                <Calendar size={20} />
                <span className="text-[15px] whitespace-nowrap">Add to Calendar</span>
              </div>
            </a>
          </div>
        </div>

        {/* Timeline */}
        <div className="mb-12 rounded-2xl bg-[rgba(255,255,255,0.03)] border border-[#66acd6]/20 overflow-hidden backdrop-blur-sm w-full shadow-lg shadow-black/20 relative">
          <DesktopTimeline
            phases={competitionPhases}
            onPhaseClick={setSelectedPhaseIndex}
            selectedIndex={selectedPhaseIndex}
          />
          <MobileTimeline
            phases={competitionPhases}
            onPhaseClick={setSelectedPhaseIndex}
            selectedIndex={selectedPhaseIndex}
          />

          {/* Bottom section with Current Stage and Helper text */}
          <div className="flex items-center justify-between px-8 pb-6 gap-4">
            {/* Current Stage Indicator - Left */}
            {currentPhase && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[rgba(102,172,214,0.1)] to-[rgba(102,172,214,0.05)] border border-[#66acd6]/20">
                <div className="relative flex items-center justify-center w-6 h-6 shrink-0">
                  <div className="absolute w-2 h-2 rounded-full bg-[#66acd6] animate-pulse" />
                  <div className="absolute w-2 h-2 rounded-full bg-[#66acd6] animate-ping opacity-75" />
                </div>
                <div className="flex items-center gap-2">
                  {currentPhase.label === 'Kick Off' ? (
                    <>
                      <span className="font-['Aeonik:Medium',sans-serif] text-white/50 text-[10px] uppercase tracking-wider">
                        {daysUntilStart ? 'Next' : 'Current'}
                      </span>
                      <span className="font-['Aeonik:Medium',sans-serif] text-[#66acd6] text-[13px]">{currentPhase.label}</span>
                      {daysUntilStart && (
                        <span className="font-['Aeonik:Regular',sans-serif] text-white/50 text-[11px]">
                          · starts in {daysUntilStart} {daysUntilStart === 1 ? 'day' : 'days'}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="font-['Aeonik:Medium',sans-serif] text-white/50 text-[10px] uppercase tracking-wider">
                        Next Submission:
                      </span>
                      <span className="font-['Aeonik:Medium',sans-serif] text-[#66acd6] text-[13px]">{currentPhase.label}</span>
                      <span className="font-['Aeonik:Regular',sans-serif] text-white/50 text-[11px]">
                        · deadline in {daysUntilStart ?? 0} {(daysUntilStart ?? 0) === 1 ? 'day' : 'days'}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Helper text - Right */}
            <p className="text-[13px] font-['Aeonik:Regular',sans-serif] text-[#66acd6]/70">
              Click on each stage to view details
            </p>
          </div>

          {/* Stage 1 result banner — always visible when a result exists */}
          {stage1Result && (
            <div className="px-8 pb-6">
              <Stage1ResultBanner result={stage1Result} projectName={projectName} />
            </div>
          )}
        </div>

        {/* Selected Phase Details */}
        <div className="mb-12 w-full">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#66acd6]/30 to-transparent" />
            <h3 className="text-[32px] font-['Aeonik:Medium',sans-serif] font-medium text-white">
              {competitionPhases[selectedPhaseIndex].label}
            </h3>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#66acd6]/30 to-transparent" />
          </div>

          {/* Show special Kick Off details for index 0, regular cards for others */}
          {selectedPhaseIndex === 0 ? (
            <KickOffDetails />
          ) : (
            <PhaseDetailsCards phase={competitionPhases[selectedPhaseIndex]} />
          )}
        </div>

        {/* Submit Button - Only show for stages 1-4 (not Kick Off) */}
        {selectedPhaseIndex >= 1 && (() => {
          const selectedStatus = competitionPhases[selectedPhaseIndex].status;
          const isBeforeKickOff = todayDate < phaseDeadlines[0];
          const isUpcoming = selectedStatus === "upcoming";
          const isDisabled = isBeforeKickOff || isUpcoming;

          const disabledReason = isBeforeKickOff
            ? "Submission forms open after the Kick Off on February 20, 2026"
            : `${competitionPhases[selectedPhaseIndex].label} hasn't started yet`;

          // Non-participants (logged out or not in the program) see a prompt
          if (!isParticipant) {
            return (
              <div className="flex flex-col items-center w-full pt-4 gap-3">
                <div className="group relative inline-flex opacity-60 cursor-not-allowed">
                  <div className="relative flex items-center gap-3 px-10 py-5 bg-gray-700 rounded-xl font-['Aeonik:Medium',sans-serif] font-medium text-gray-400">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span className="text-[17px]">Submit {competitionPhases[selectedPhaseIndex].label}</span>
                  </div>
                </div>
                <p className="text-[13px] font-['Aeonik:Regular',sans-serif] text-white/50 text-center">
                  Log into a participant account to submit
                </p>
              </div>
            );
          }

          return (
            <div className="flex flex-col items-center w-full pt-4 gap-3">
              {isDisabled ? (
                <div className="group relative inline-flex opacity-50 cursor-not-allowed">
                  <div className="relative flex items-center gap-3 px-10 py-5 bg-gray-600 rounded-xl font-['Aeonik:Medium',sans-serif] font-medium text-gray-400">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-[17px]">Submit {competitionPhases[selectedPhaseIndex].label}</span>
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ) : (
                <a
                  href={`/build-games/submit?stage=${selectedPhaseIndex}`}
                  className="group relative inline-flex"
                >
                  <div className="absolute -inset-1 bg-gradient-to-r from-[#66acd6] via-[#38bdf8] to-[#66acd6] rounded-xl blur-sm opacity-40 group-hover:opacity-70 transition duration-500 animate-pulse" />
                  <div className="relative flex items-center gap-3 px-10 py-5 bg-[#66acd6] rounded-xl font-['Aeonik:Medium',sans-serif] font-medium text-[#152d44] group-hover:bg-[#7fc0e5] transition-all duration-200 shadow-xl shadow-cyan-500/30 group-hover:shadow-cyan-500/50 group-hover:scale-105">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-[17px]">Submit {competitionPhases[selectedPhaseIndex].label}</span>
                    <svg
                      className="w-5 h-5 transition-transform group-hover:translate-x-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </a>
              )}
              {isDisabled && (
                <p className="text-[13px] font-['Aeonik:Regular',sans-serif] text-white/50 text-center">
                  {disabledReason}
                </p>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
