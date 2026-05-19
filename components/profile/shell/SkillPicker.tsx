"use client";

import * as React from "react";
import { categorizeSkill, SKILL_SUGGESTIONS } from "./data";

interface Props {
  skills: string[];
  onAdd: (skill: string) => void;
  onRemove: (skill: string) => void;
}

export function SkillPicker({ skills, onAdd, onRemove }: Props) {
  const [value, setValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const inUse = new Set(skills.map((s) => s.toLowerCase()));

  const tryAdd = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (inUse.has(trimmed.toLowerCase())) return;
    onAdd(trimmed);
    setValue("");
  };

  const suggestions = SKILL_SUGGESTIONS.filter(
    (s) => !inUse.has(s.name.toLowerCase()),
  ).slice(0, 6);

  return (
    <div>
      <div
        className="pr-skill-input-wrap"
        onClick={() => inputRef.current?.focus()}
        role="group"
        aria-label="Skills"
      >
        {skills.map((skill) => {
          const cat = categorizeSkill(skill);
          return (
            <span key={skill} className={`pr-skill-tag pr-cat-${cat}`}>
              {skill}
              <button
                type="button"
                className="pr-x"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(skill);
                }}
                aria-label={`Remove ${skill}`}
              >
                ×
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          className="pr-skill-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              tryAdd(value);
            } else if (e.key === "Backspace" && value === "" && skills.length > 0) {
              onRemove(skills[skills.length - 1]);
            }
          }}
          placeholder={skills.length ? "Add another..." : "Type a skill and press Enter"}
          aria-label="Add a skill"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="pr-skill-suggest">
          {suggestions.map((s) => (
            <button
              key={s.name}
              type="button"
              className="pr-sgst"
              onClick={() => tryAdd(s.name)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
