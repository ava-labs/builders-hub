"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import ReferralButton from "./ReferralButton";
import { ApplyButton } from "./ApplyButton";

interface ApplicationData {
  id: string;
  firstName: string;
  projectName: string;
  createdAt: string;
}

interface TimelineStep {
  label: string;
  status: "completed" | "current" | "upcoming";
  date?: string;
}

const timelineSteps: TimelineStep[] = [
  { label: "Application Complete", status: "completed" },
  { label: "Review in Progress", status: "current" },
  { label: "Decision", status: "upcoming" },
  { label: "Competition Begins", status: "upcoming", date: "Feb 2026" },
];

function TimelineStepIcon({ status }: { status: TimelineStep["status"] }) {
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

function DesktopTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div className="hidden md:flex items-center justify-center w-full gap-0">
      {steps.map((step, index) => (
        <div key={step.label} className="flex items-center">
          <div className="flex flex-col items-center gap-2">
            <TimelineStepIcon status={step.status} />
            <div className="flex flex-col items-center">
              <span
                className={`font-['Aeonik:Medium',sans-serif] text-[14px] text-center whitespace-nowrap ${
                  step.status === "completed" || step.status === "current" ? "text-white" : "text-[rgba(255,255,255,0.5)]"
                }`}
              >
                {step.label}
              </span>
              {step.date && (
                <span className="font-['Aeonik:Regular',sans-serif] text-[12px] text-[rgba(255,255,255,0.5)]">
                  {step.date}
                </span>
              )}
            </div>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`w-[60px] h-[2px] mx-3 mt-[-24px] ${
                steps[index + 1].status === "completed" || steps[index + 1].status === "current" ? "bg-[#66acd6]" : "bg-[rgba(102,172,214,0.3)]"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function MobileTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div className="flex md:hidden flex-col items-start w-full gap-4 px-4">
      {steps.map((step, index) => (
        <div key={step.label} className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <TimelineStepIcon status={step.status} />
            {index < steps.length - 1 && (
              <div
                className={`w-[2px] h-[32px] ${
                  steps[index + 1].status === "completed" || steps[index + 1].status === "current" ? "bg-[#66acd6]" : "bg-[rgba(102,172,214,0.3)]"
                }`}
              />
            )}
          </div>
          <div className="flex flex-col pt-1">
            <span
              className={`font-['Aeonik:Medium',sans-serif] text-[14px] ${
                step.status === "completed" || step.status === "current" ? "text-white" : "text-[rgba(255,255,255,0.5)]"
              }`}
            >
              {step.label}
            </span>
            {step.date && (
              <span className="font-['Aeonik:Regular',sans-serif] text-[12px] text-[rgba(255,255,255,0.5)]">
                {step.date}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusTracker({ application }: { application: ApplicationData }) {
  const formattedDate = new Date(application.createdAt).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );

  return (
    <div className="get-involved-cta relative shrink-0 w-full py-[40px]" data-name="GetInvolvedCTA">
      <div className="flex flex-col items-center justify-center gap-[24px] px-[16px]">
        <div className="font-['Aeonik:Medium',sans-serif] font-medium text-[48px] md:text-[64px] text-nowrap text-white leading-[1.2]">
          Application Status
        </div>

        <div className="gradient-border-card w-full max-w-[800px] p-[24px] md:p-[32px]">
          <div className="flex flex-col gap-[24px]">
            <DesktopTimeline steps={timelineSteps} />
            <MobileTimeline steps={timelineSteps} />

            <div className="border-t border-[rgba(102,172,214,0.3)] pt-[16px] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="font-['Aeonik:Regular',sans-serif] text-[14px] text-[rgba(255,255,255,0.6)]">
                  Project
                </span>
                <span className="font-['Aeonik:Medium',sans-serif] text-[16px] text-white">
                  {application.projectName}
                </span>
              </div>
              <div className="flex flex-col gap-1 md:items-end">
                <span className="font-['Aeonik:Regular',sans-serif] text-[14px] text-[rgba(255,255,255,0.6)]">
                  Submitted
                </span>
                <span className="font-['Aeonik:Medium',sans-serif] text-[16px] text-white">
                  {formattedDate}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 mt-2">
          <span className="font-['Aeonik:Regular',sans-serif] text-[16px] text-[rgba(255,255,255,0.8)]">
            Know someone who should apply?
          </span>
          <ReferralButton />
        </div>
      </div>
    </div>
  );
}

function OriginalCTA() {
  return (
    <div className="get-involved-cta relative shrink-0 w-full py-[40px]" data-name="GetInvolvedCTA">
      <div className="flex flex-row flex-nowrap items-center justify-center gap-[16px] px-[16px]">
        <div className="font-['Aeonik:Medium',sans-serif] font-medium text-[64px] text-nowrap text-white leading-[80px]">
          Get Involved
        </div>
        <div className="flex flex-row flex-nowrap gap-[10px] items-center">
          <ReferralButton />
          <ApplyButton className="shrink-0 bg-[#66acd6] flex h-[52px] items-center justify-center px-[36px] py-[12px] rounded-[3.35544e+07px] cursor-pointer hover:bg-[#7bbde3] transition-colors shadow-[0px_0px_20px_4px_rgba(102,172,214,0.5)]">
            <span className="font-['Aeonik:Medium',sans-serif] font-medium text-[#152d44] text-[18px] text-center text-nowrap leading-[28px]">
              Apply
            </span>
          </ApplyButton>
        </div>
      </div>
    </div>
  );
}

export default function ApplicationStatusTracker() {
  const { status } = useSession();
  const [application, setApplication] = useState<ApplicationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Only fetch when authenticated
    if (status !== "authenticated") {
      return;
    }

    setIsLoading(true);
    fetch("/api/build-games/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.hasApplied && data.application) {
          setApplication(data.application);
        }
      })
      .catch((error) => {
        console.error("Error fetching application status:", error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [status]);

  if (status === "loading" || status === "unauthenticated" || isLoading) {
    return <OriginalCTA />;
  }

  if (!application) {
    return <OriginalCTA />;
  }

  return <StatusTracker application={application} />;
}
