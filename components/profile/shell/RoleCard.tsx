"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { RoleIconRender } from "./IconRender";
import type { RoleSpec } from "./data";

interface Props {
  role: RoleSpec;
  selected: boolean;
  onToggle: (id: RoleSpec["id"]) => void;
}

export function RoleCard({ role, selected, onToggle }: Props) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      className={`pr-role-card${selected ? " pr-on" : ""}`}
      onClick={() => onToggle(role.id)}
    >
      <span className="pr-role-ico">
        <RoleIconRender kind={role.icon} />
      </span>
      <span>
        <span className="pr-nm">{role.name}</span>
        <div className="pr-dsc">{role.description}</div>
      </span>
      <span className="pr-check" aria-hidden>
        <Check />
      </span>
    </button>
  );
}
