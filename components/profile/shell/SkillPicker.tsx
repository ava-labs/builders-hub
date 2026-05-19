"use client";

import * as React from "react";
import { categorizeSkill, SKILL_SUGGESTIONS } from "./data";

interface Props {
  skills: string[];
  onAdd: (skill: string) => void;
  onRemove: (skill: string) => void;
}

interface PopularSkill {
  name: string;
  usageCount: number;
}

const STATIC_FALLBACK: PopularSkill[] = SKILL_SUGGESTIONS.map((s) => ({
  name: s.name,
  usageCount: 0,
}));

export function SkillPicker({ skills, onAdd, onRemove }: Props) {
  const [value, setValue] = React.useState("");
  const [popular, setPopular] = React.useState<PopularSkill[]>(STATIC_FALLBACK);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const inUse = React.useMemo(
    () => new Set(skills.map((s) => s.toLowerCase())),
    [skills],
  );

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/profile/popular-skills")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: PopularSkill[] | null) => {
        if (cancelled || !Array.isArray(data) || data.length === 0) return;
        // Merge popular results with the static seed list so users on a fresh
        // DB still get useful suggestions if the API returns nothing.
        const seen = new Set(data.map((s) => s.name.toLowerCase()));
        const merged = [
          ...data,
          ...STATIC_FALLBACK.filter((s) => !seen.has(s.name.toLowerCase())),
        ];
        setPopular(merged);
      })
      .catch(() => {
        /* keep the static fallback */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tryAdd = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (inUse.has(trimmed.toLowerCase())) return;
    onAdd(trimmed);
    setValue("");
  };

  const suggestions = React.useMemo(() => {
    const query = value.trim().toLowerCase();
    const filtered = popular.filter((s) => !inUse.has(s.name.toLowerCase()));
    if (!query) return filtered.slice(0, 6);
    return filtered
      .filter((s) => s.name.toLowerCase().includes(query))
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(query);
        const bStarts = b.name.toLowerCase().startsWith(query);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
        return b.usageCount - a.usageCount;
      })
      .slice(0, 8);
  }, [popular, value, inUse]);

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
              if (suggestions.length > 0 && value.trim()) {
                tryAdd(suggestions[0].name);
              } else {
                tryAdd(value);
              }
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
