"use client";

import React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStepFlowNavStore } from "./stores/stepFlowNavStore";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";

export function StepFlowNav() {
  const useV2 = useFeatureFlag("console-step-flow-v2", false);
  const data = useStepFlowNavStore((s) => s.data);

  const show = useV2 && data !== null;

  return (
    <AnimatePresence>
      {show && data && (
        <motion.nav
          key="step-flow-nav"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="hidden md:block overflow-hidden border-b border-border bg-white dark:bg-zinc-900"
        >
          <ol className="flex items-center justify-center gap-2 px-4 py-2 text-sm lg:gap-3 lg:px-6 overflow-x-auto scrollbar-hide md:flex-wrap md:overflow-visible">
            {data.steps.map((s, stepIdx) => {
              const isDone = stepIdx < data.currentIndex;
              const isActive = stepIdx === data.currentIndex;

              if (s.type === "single") {
                return (
                  <li key={s.key} className="flex items-center gap-2 flex-shrink-0 lg:gap-3">
                    <Link
                      href={`${data.basePath}/${s.key}`}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 border transition-colors text-xs lg:text-sm lg:px-3 lg:py-1.5 lg:gap-2",
                        isActive
                          ? "border-primary bg-primary/5 text-primary dark:bg-primary/10"
                          : isDone
                            ? "border-green-300 dark:border-green-700 text-green-600 dark:text-green-400"
                            : "border-border text-muted-foreground",
                        s.optional ? "border-dashed" : "",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-full text-[10px] lg:h-6 lg:w-6 lg:text-xs",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : isDone
                              ? "bg-green-500 text-white"
                              : "bg-muted text-muted-foreground",
                        )}
                      >
                        {isDone ? <Check className="h-3 w-3" /> : stepIdx + 1}
                      </span>
                      <span className="whitespace-nowrap">{s.title}</span>
                    </Link>
                    {stepIdx < data.steps.length - 1 && (
                      <span className="text-muted-foreground/40 flex-shrink-0">&rarr;</span>
                    )}
                  </li>
                );
              }

              // Branch step
              return (
                <li key={s.key} className="flex items-center gap-2 flex-shrink-0 lg:gap-3">
                  <div className="flex flex-col items-center gap-1">
                    {s.options.map((opt, optIdx) => {
                      const isOptionActive = isActive && data.selectedBranchOptionKey === opt.key;
                      return (
                        <React.Fragment key={opt.key}>
                          <Link
                            href={`${data.basePath}/${opt.key}`}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 border transition-colors text-xs lg:text-sm lg:px-3 lg:py-1.5 lg:gap-2",
                              isOptionActive
                                ? "border-primary bg-primary/5 text-primary dark:bg-primary/10"
                                : isDone
                                  ? "border-green-300 dark:border-green-700 text-green-600 dark:text-green-400"
                                  : "border-border text-muted-foreground",
                              s.optional ? "border-dashed" : "",
                            )}
                          >
                            <span
                              className={cn(
                                "flex h-5 w-5 items-center justify-center rounded-full text-[10px] lg:h-6 lg:w-6 lg:text-xs",
                                isOptionActive
                                  ? "bg-primary text-primary-foreground"
                                  : isDone
                                    ? "bg-green-500 text-white"
                                    : "bg-muted text-muted-foreground",
                              )}
                            >
                              {isDone ? <Check className="h-3 w-3" /> : stepIdx + 1}
                            </span>
                            <span className="whitespace-nowrap">{opt.label}</span>
                          </Link>
                          {optIdx < s.options.length - 1 && (
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              or
                            </span>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                  {stepIdx < data.steps.length - 1 && (
                    <span className="text-muted-foreground/40 flex-shrink-0">&rarr;</span>
                  )}
                </li>
              );
            })}
          </ol>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
