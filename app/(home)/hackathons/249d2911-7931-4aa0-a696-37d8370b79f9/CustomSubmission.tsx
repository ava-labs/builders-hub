"use client";

import { HackathonHeader } from "@/types/hackathons";
import { Calendar, Trophy, Users, Check } from "lucide-react";
import { useState, useEffect } from "react";

interface PhaseDetails {
  deadline: string;
  requirements: string;
  criteria: string;
  support: string;
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
  onPhaseClick
}: {
  phases: TimelinePhase[];
  onPhaseClick: (index: number) => void;
}) {
  return (
    <div className="hidden md:flex items-start justify-between w-full py-12 px-8 relative">
      {phases.map((phase, index) => (
        <div key={phase.label} className="flex flex-col items-center flex-1 relative">
          {/* Circle */}
          <button
            onClick={() => onPhaseClick(index)}
            className="rounded-full p-1 transition-all duration-300 active:scale-95 mb-4"
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
  onPhaseClick
}: {
  phases: TimelinePhase[];
  onPhaseClick: (index: number) => void;
}) {
  return (
    <div className="flex md:hidden flex-col items-start w-full gap-4 px-4 py-8">
      {phases.map((phase, index) => (
        <div key={phase.label} className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <button
              onClick={() => onPhaseClick(index)}
              className="rounded-full p-1 transition-all duration-300 active:scale-95"
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

function PhaseDetailsCards({ phase }: { phase: TimelinePhase }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="p-6 rounded-xl bg-[rgba(21,45,68,0.3)] border border-[#66acd6]/20 backdrop-blur-sm">
        <Calendar className="mb-3 text-[#66acd6]/80" size={20} />
        <h3 className="text-base font-['Aeonik:Medium',sans-serif] font-medium text-white mb-2">
          Deadline
        </h3>
        <p className="text-sm font-['Aeonik:Regular',sans-serif] text-white/70 leading-relaxed">
          {phase.details.deadline}
        </p>
      </div>

      <div className="p-6 rounded-xl bg-[rgba(21,45,68,0.3)] border border-[#66acd6]/20 backdrop-blur-sm">
        <Check className="mb-3 text-[#66acd6]/80" size={20} />
        <h3 className="text-base font-['Aeonik:Medium',sans-serif] font-medium text-white mb-2">
          Requirements
        </h3>
        <p className="text-sm font-['Aeonik:Regular',sans-serif] text-white/70 leading-relaxed">
          {phase.details.requirements}
        </p>
      </div>

      <div className="p-6 rounded-xl bg-[rgba(21,45,68,0.3)] border border-[#66acd6]/20 backdrop-blur-sm">
        <Trophy className="mb-3 text-[#66acd6]/80" size={20} />
        <h3 className="text-base font-['Aeonik:Medium',sans-serif] font-medium text-white mb-2">
          Evaluation Criteria
        </h3>
        <p className="text-sm font-['Aeonik:Regular',sans-serif] text-white/70 leading-relaxed">
          {phase.details.criteria}
        </p>
      </div>

      <div className="p-6 rounded-xl bg-[rgba(21,45,68,0.3)] border border-[#66acd6]/20 backdrop-blur-sm">
        <Users className="mb-3 text-[#66acd6]/80" size={20} />
        <h3 className="text-base font-['Aeonik:Medium',sans-serif] font-medium text-white mb-2">
          Support
        </h3>
        <p className="text-sm font-['Aeonik:Regular',sans-serif] text-white/70 leading-relaxed">
          {phase.details.support}
        </p>
      </div>
    </div>
  );
}

export default function CustomSubmission({ hackathon }: { hackathon: HackathonHeader }) {
  // Define phase deadlines
  const phaseDeadlines = [
    new Date("2026-02-18"), // Application Process
    new Date("2026-02-20"), // Kick Off
    new Date("2026-02-25"), // Idea Pitch
    new Date("2026-03-09"), // Prototype / MVP
    new Date("2026-03-19"), // GTM Plan & Vision
    new Date("2026-03-27"), // Final Pitch
  ];

  // Helper function to determine phase statuses based on current date
  const getPhaseStatuses = (): ("completed" | "current" | "upcoming")[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let currentPhaseIndex = -1;

    // Find the first phase that hasn't passed its deadline
    for (let i = 0; i < phaseDeadlines.length; i++) {
      if (today <= phaseDeadlines[i]) {
        currentPhaseIndex = i;
        break;
      }
    }

    // If all phases have passed, mark all as completed
    if (currentPhaseIndex === -1) {
      return phaseDeadlines.map(() => "completed");
    }

    // Set statuses: completed before current, current at index, upcoming after
    return phaseDeadlines.map((_, index) => {
      if (index < currentPhaseIndex) return "completed";
      if (index === currentPhaseIndex) return "current";
      return "upcoming";
    });
  };

  const statuses = getPhaseStatuses();

  const competitionPhases: TimelinePhase[] = [
    {
      label: "Application Process",
      status: statuses[0],
      date: "Jan 20 - Feb 18",
      details: {
        deadline: "February 18, 2026 at 11:59 PM PST",
        requirements: "Complete application form with team information, project concept, and why you want to participate in BuildGames.",
        criteria: "Team composition, project idea clarity, motivation, and alignment with Avalanche ecosystem goals.",
        support: "Application review assistance and feedback on your submission before the deadline.",
      },
    },
    {
      label: "Kick Off",
      status: statuses[1],
      date: "Feb 20",
      details: {
        deadline: "February 20, 2026 - Event Day",
        requirements: "Attend the virtual kick-off event to meet your cohort, mentors, and learn about the program structure and expectations.",
        criteria: "Attendance and engagement during the kick-off session.",
        support: "Meet and greet with mentors, Q&A session, and program overview presentation.",
      },
    },
    {
      label: "Idea Pitch",
      status: statuses[2],
      date: "Feb 25",
      details: {
        deadline: "February 25, 2026 at 11:59 PM PST",
        requirements: "Create a 1-minute video clearly explaining your project idea, target problem, solution approach, and value proposition.",
        criteria: "Clarity of idea, problem-solution fit, innovation, presentation quality, and potential market impact.",
        support: "Video creation tips, pitch feedback sessions, and storytelling guidance from mentors.",
      },
    },
    {
      label: "Prototype / MVP",
      status: statuses[3],
      date: "March 9",
      details: {
        deadline: "March 9, 2026 at 11:59 PM PST",
        requirements: "Functional prototype, GitHub repository with code, technical documentation, and product walkthrough video demonstrating key features.",
        criteria: "Technical implementation quality, use of Avalanche technologies, code structure, feature completeness, and UX design.",
        support: "Technical mentorship, code reviews, Avalanche integration help, and development best practices guidance.",
      },
    },
    {
      label: "GTM Plan & Vision",
      status: statuses[4],
      date: "March 19",
      details: {
        deadline: "March 19, 2026 at 11:59 PM PST",
        requirements: "Go-to-market plan, growth strategy, target user personas, competitive analysis, and long-term product vision document.",
        criteria: "Market understanding, growth strategy viability, user acquisition plan, business model clarity, and scalability potential.",
        support: "GTM strategy workshops, market research guidance, business model feedback, and ecosystem partnership introductions.",
      },
    },
    {
      label: "Final Pitch",
      status: statuses[5],
      date: "March 27",
      details: {
        deadline: "March 27, 2026 - Live presentation",
        requirements: "Final pitch deck, live product demo, complete project documentation, and Q&A session with judges.",
        criteria: "Overall project quality, innovation, technical excellence, market potential, presentation skills, and ecosystem fit.",
        support: "Presentation coaching, demo preparation, final pitch refinement, and technical setup assistance for showcase.",
      },
    },
  ];

  const [selectedPhaseIndex, setSelectedPhaseIndex] = useState(0);
  const [currentPhase, setCurrentPhase] = useState<TimelinePhase | null>(null);

  useEffect(() => {
    const current = competitionPhases.find((phase) => phase.status === "current");
    const currentIndex = competitionPhases.findIndex((phase) => phase.status === "current");
    setCurrentPhase(current || null);
    setSelectedPhaseIndex(currentIndex >= 0 ? currentIndex : 0);
  }, []);

  return (
    <section id="submission">
      <h2 className="text-4xl font-bold text-white text-left mb-12 font-['Aeonik:Medium',sans-serif]">
        Program Timeline
      </h2>

      {/* Timeline */}
      <div className="mb-8 rounded-2xl bg-[rgba(21,45,68,0.4)] border border-[#66acd6]/20 overflow-hidden backdrop-blur-sm">
        <DesktopTimeline
          phases={competitionPhases}
          onPhaseClick={setSelectedPhaseIndex}
        />
        <MobileTimeline
          phases={competitionPhases}
          onPhaseClick={setSelectedPhaseIndex}
        />

        {/* Helper text */}
        <div className="px-8 pb-6 text-right">
          <p className="text-xs font-['Aeonik:Regular',sans-serif] text-[#66acd6]/60">
            Click on each stage to view details
          </p>
        </div>
      </div>

      {/* Current Stage Indicator */}
      {currentPhase && (
        <div className="mb-8 p-4 rounded-xl bg-[rgba(21,45,68,0.3)] border border-[#66acd6]/20 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-6 h-6 shrink-0">
              <div className="absolute w-3 h-3 rounded-full bg-[#66acd6] animate-pulse" />
              <div className="absolute w-3 h-3 rounded-full bg-[#66acd6] animate-ping opacity-75" />
            </div>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-['Aeonik:Medium',sans-serif] text-white/70 text-[11px] uppercase tracking-wider">Current Stage</span>
              <span className="font-['Aeonik:Medium',sans-serif] text-[#66acd6] text-sm">{currentPhase.label}</span>
              <span className="font-['Aeonik:Regular',sans-serif] text-white/50 text-xs">· {currentPhase.date}</span>
            </div>
          </div>
        </div>
      )}

      {/* Selected Phase Details */}
      <div className="mb-8">
        <h3 className="text-2xl font-['Aeonik:Medium',sans-serif] font-medium text-white mb-6">
          {competitionPhases[selectedPhaseIndex].label} Details
        </h3>
        <PhaseDetailsCards phase={competitionPhases[selectedPhaseIndex]} />
      </div>

      {/* CTA Button */}
      <div className="flex justify-center">
        <a
          href={hackathon.content.submission_custom_link || `/hackathons/${hackathon.id}/submit`}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative"
        >
          <div className="absolute -inset-0.5 bg-gradient-to-r from-[#66acd6] to-[#38bdf8] rounded-lg blur opacity-30 group-hover:opacity-60 transition duration-300" />
          <div className="relative flex items-center gap-3 px-8 py-4 bg-[#66acd6] rounded-lg font-['Aeonik:Medium',sans-serif] font-medium text-[#152d44] group-hover:bg-[#7fc0e5] transition-all duration-200 shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/40">
            <span className="text-base">Submit Deliverables</span>
            <svg
              className="w-4 h-4 transition-transform group-hover:translate-x-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </a>
      </div>
    </section>
  );
}
