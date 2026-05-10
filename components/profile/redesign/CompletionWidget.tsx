"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { GiftIcon } from "./icons";
import {
  COMPLETION_STEPS,
  type CompletionResult,
  type CompletionStepKey,
} from "@/lib/profile/completion";

interface Props {
  completion: CompletionResult;
  onJump?: (key: CompletionStepKey) => void;
}

export function CompletionWidget({ completion, onJump }: Props) {
  const stepsRemaining = completion.total - completion.completed;

  return (
    <div className="pr-card">
      <div className="pr-head">
        <div
          className="pr-ico"
          style={{ background: "var(--pr-primary-light)", color: "var(--pr-accent-main)" }}
        >
          <GiftIcon size={18} />
        </div>
        <div>
          <h3>Profile completion</h3>
          <div className="pr-desc">
            {completion.completed} of {completion.total} steps complete
            {stepsRemaining > 0 ? ` · ${stepsRemaining} remaining` : ""}
          </div>
        </div>
      </div>
      <div className="pr-body" style={{ paddingTop: 18 }}>
        <div className="pr-checklist">
          {COMPLETION_STEPS.map((step) => {
            const done = completion.status[step.key];
            return (
              <button
                type="button"
                key={step.key}
                className={`pr-item${done ? " pr-done" : ""}`}
                onClick={() => onJump?.(step.key)}
                aria-label={done ? `${step.label} - completed` : step.label}
              >
                <span className="pr-check-circ" aria-hidden>
                  <Check />
                </span>
                <div className="pr-meta">
                  <span className="pr-lbl">{step.label}</span>
                  <span className="pr-desc">{step.description}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
