"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, GitBranch, Clock, Lightbulb } from "lucide-react";
import type { StepDefinition, FlowConfig } from "./step-flow";
import { EditOnGitHubButton } from "@/components/console/edit-on-github-button";
import { ReportIssueButton } from "@/components/console/report-issue-button";
import { generateFlowSetupGitHubUrl, generateFlowBasePath } from "@/components/toolbox/utils/github-url";

type FlowIntroductionProps = {
  config: FlowConfig;
  steps: StepDefinition[];
  url: string;
};

export default function FlowIntroduction({
  config,
  steps,
  url,
}: FlowIntroductionProps) {
  // Auto-generate basePath and githubUrl from import.meta.url
  const basePath = generateFlowBasePath(url);
  const githubUrl = generateFlowSetupGitHubUrl(url);
  
  // Calculate first step key from steps
  const firstStepKey = steps[0].type === "single" 
    ? steps[0].key 
    : steps[0].options[0].key;
  return (
    <div className="w-full relative min-h-screen">
      {/* Content with Right Pane */}
      <div className="relative">
        {/* SVG Pattern Background - covers header and right pane */}
        <div className="pointer-events-none absolute -inset-x-6 -top-6 left-0 right-0 h-[300px] overflow-hidden">
          <div className="absolute inset-0 transition duration-300 [mask-image:linear-gradient(white,transparent)]">
            <svg 
              aria-hidden="true" 
              className="absolute inset-x-0 inset-y-[-30%] h-[160%] w-full skew-y-[-18deg] fill-black/[0.02] stroke-black/5 dark:fill-white/[0.02] dark:stroke-white/5"
            >
              <defs>
                <pattern 
                  id="flow-pattern" 
                  width="72" 
                  height="56" 
                  patternUnits="userSpaceOnUse" 
                  x="50%" 
                  y="16"
                >
                  <path d="M.5 56V.5H72" fill="none"></path>
                </pattern>
              </defs>
              <rect width="100%" height="100%" strokeWidth="0" fill="url(#flow-pattern)"></rect>
              <svg x="50%" y="16" className="overflow-visible">
                <rect strokeWidth="0" width="73" height="57" x="0" y="56"></rect>
                <rect strokeWidth="0" width="73" height="57" x="72" y="168"></rect>
              </svg>
            </svg>
          </div>
        </div>
        
        <div className="flex gap-8 pb-12 relative z-10">
          {/* Main Content */}
          <div className="flex-1 space-y-8">
            {/* Header */}
            <div className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tight">{config.title}</h1>
            {config.description && (
              <p className="text-base text-muted-foreground max-w-3xl">{config.description}</p>
            )}
            
            {/* Minimal Learning Resources */}
            {config.resources && config.resources.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-3">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Learning</span>
                {config.resources.map((resource, idx) => (
                  <Link
                    key={idx}
                    href={resource.href}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-card/50 border border-border/50 hover:border-border hover:bg-card transition-all text-xs group"
                  >
                    <BookOpen className="w-3 h-3 text-muted-foreground/70 group-hover:text-foreground transition-colors" />
                    <span className="font-medium text-foreground/80 group-hover:text-foreground transition-colors">{resource.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Timeline View */}
          <TimelineVariant steps={steps} />
        </div>

        {/* Right Pane - Prerequisites Sidebar */}
        {config.metadata && (config.metadata.prerequisites || config.metadata.estimatedTime) && (
          <div className="hidden lg:block w-80 flex-shrink-0">
            <div className="sticky top-0 space-y-4">
              {config.metadata.prerequisites && config.metadata.prerequisites.length > 0 && (
                <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm">
                  <div className="p-6">
                    <h3 className="text-sm font-semibold mb-5 text-foreground">Prerequisites</h3>
                    
                    <div className="space-y-5">
                      {(() => {
                        // Group prerequisites by type
                        const grouped = config.metadata.prerequisites.reduce((acc, prereq) => {
                          const type = prereq.type || "other";
                          if (!acc[type]) acc[type] = [];
                          acc[type].push(prereq);
                          return acc;
                        }, {} as Record<string, typeof config.metadata.prerequisites>);
                        
                        // Define type labels
                        const typeLabels: Record<string, string> = {
                          infrastructure: "Infrastructure",
                          wallet: "Wallet",
                          knowledge: "Knowledge",
                        };
                        
                        return Object.entries(grouped).map(([type, items], groupIdx) => (
                          <div key={type}>
                            {groupIdx > 0 && (
                              <div className="relative h-px my-5">
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-border to-transparent" />
                              </div>
                            )}
                            <div className="space-y-2.5">
                              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                {typeLabels[type] || type.charAt(0).toUpperCase() + type.slice(1)}
                              </p>
                              <ul className="space-y-2">
                                {items.map((prereq, idx) => (
                                  <li key={idx} className="flex items-start gap-2.5 text-[13px] text-foreground/80 leading-relaxed">
                                    <span className="text-muted-foreground/50 select-none mt-0.5">—</span>
                                    <span>{prereq.requirement}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                    
                    {config.metadata.estimatedTime && (
                      <>
                        <div className="relative h-px my-5">
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-border to-transparent" />
                        </div>
                        <div className="flex items-center gap-2.5">
                          <Clock className="w-4 h-4 text-muted-foreground/70" />
                          <p className="text-[13px]">
                            <span className="font-medium text-foreground">{config.metadata.estimatedTime}</span>
                            <span className="text-muted-foreground ml-1">to complete</span>
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
              
              {/* Common Use Cases */}
              {config.metadata.useCases && config.metadata.useCases.length > 0 && (
                <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm">
                  <div className="p-6">
                    <h3 className="text-sm font-semibold mb-4 text-foreground">Common Use Cases</h3>
                    <ul className="space-y-2.5">
                      {config.metadata.useCases.map((useCase, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-[13px] text-foreground/80 leading-relaxed">
                          <span className="text-muted-foreground/50 select-none mt-0.5">—</span>
                          <span>{useCase}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              
              {/* Action Buttons */}
              <EditOnGitHubButton 
                githubUrl={githubUrl} 
                toolTitle={config.title}
                className="w-full justify-start"
              />
              <ReportIssueButton 
                toolTitle={config.title}
                className="w-full justify-start"
              />
            </div>
          </div>
        )}
      </div>

      {/* Floating CTA Button - Centered in Component */}
      <Link
        href={`${basePath}/${firstStepKey}`}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 inline-flex items-center gap-3 px-6 py-3 text-base font-semibold bg-primary text-primary-foreground rounded-full hover:bg-primary/90 hover:gap-4 transition-all group shadow-lg hover:shadow-xl max-w-7xl"
      >
        Get Started
        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform animate-[bounce-x_1s_ease-in-out_infinite]" />
      </Link>
      <style jsx>{`
        @keyframes bounce-x {
          0%, 100% {
            transform: translateX(0);
          }
          50% {
            transform: translateX(4px);
          }
        }
      `}</style>
      </div>
    </div>
  );
}

// Timeline View Component
function TimelineVariant({ steps }: { steps: StepDefinition[] }) {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-semibold">Understanding the Flow</h2>
      
      <div className="relative">
        {/* Enhanced Timeline line */}
        <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-primary/30 via-primary/20 to-transparent" />
        
        <div className="space-y-12">
          {steps.map((step, stepIdx) => {
            if (step.type === "single") {
              // Calculate the step number (counting both single and branch steps)
              const stepNumber = stepIdx + 1;
              
              return (
                <div key={step.key} className="flex gap-8 relative group items-start">
                  {/* Enhanced Timeline dot with improved step number */}
                  <div className="relative z-10 flex-shrink-0 pt-1">
                    <div className="w-16 h-16 rounded-2xl border-2 border-background bg-primary shadow-lg flex items-center justify-center">
                      <span className="text-xl font-bold text-primary-foreground tabular-nums">
                        {String(stepNumber).padStart(2, "0")}
                      </span>
                    </div>
                    {/* Connecting line to content */}
                    <div className="absolute top-8 left-16 w-8 h-px bg-gradient-to-r from-primary/30 to-transparent" />
                  </div>
                  
                  {/* Enhanced Content */}
                  <div className="flex-1 pb-4">
                    <div className={`p-6 rounded-xl ${step.optional ? 'border-2 border-dashed border-border/50' : 'border border-border/50'} bg-card`}>
                      <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                      {step.description && (
                        <p className="text-sm text-muted-foreground leading-relaxed mb-4">{step.description}</p>
                      )}
                      {step.outcomes && step.outcomes.length > 0 && (
                        <div className="space-y-3 pt-3 border-t border-border/50">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">What You'll Achieve</p>
                          <div className="grid gap-2">
                            {step.outcomes.slice(0, 2).map((outcome, idx) => (
                              <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                                <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                                <span className="text-sm font-medium">{outcome}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            } else {
              // Branch step
              const stepNumber = stepIdx + 1;
              
              return (
                <div key={step.key} className="relative group">
                  <div className="flex gap-8 items-start">
                    {/* Branch Timeline dot with improved styling */}
                    <div className="relative z-10 flex-shrink-0 pt-1">
                      <div className={`w-16 h-16 rounded-2xl border-2 border-background bg-amber-500 shadow-lg flex items-center justify-center`}>
                        <GitBranch className="w-8 h-8 text-white" />
                      </div>
                      {/* Connecting line to content */}
                      <div className="absolute top-8 left-16 w-8 h-px bg-gradient-to-r from-amber-500/30 to-transparent" />
                    </div>
                    
                    <div className="flex-1">
                      <div className="mb-6">
                        <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                        {step.description && (
                          <p className="text-sm text-muted-foreground">{step.description}</p>
                        )}
                      </div>
                      
                      {/* Branch Options */}
                      <div className="grid md:grid-cols-2 gap-4">
                        {step.options.map((option, optionIdx) => {
                          const subLetter = String.fromCharCode(97 + optionIdx);
                          const numberLabel = `${String(stepNumber).padStart(2, "0")}.${subLetter}`;
                          
                          return (
                            <div key={option.key} className={`p-5 rounded-xl ${step.optional ? 'border border-dashed border-amber-500/30' : 'border border-amber-500/20'} bg-gradient-to-br from-amber-500/[0.02] to-amber-500/[0.04]`}>
                              <div className="flex items-center gap-2 mb-3">
                                <div className="px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/20">
                                  <span className="text-sm font-bold text-amber-700 dark:text-amber-500 tabular-nums">
                                    {numberLabel}
                                  </span>
                                </div>
                              </div>
                              <h4 className="text-base font-semibold mb-3">{option.label}</h4>
                              {option.outcomes && option.outcomes.length > 0 && (
                                <div className="space-y-2">
                                  {option.outcomes.slice(0, 2).map((outcome, idx) => (
                                    <div key={idx} className="flex items-start gap-2 text-sm">
                                      <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
                                      <span className="text-foreground font-medium">{outcome}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
          })}
        </div>
      </div>
    </div>
  );
}
