"use client";

import * as React from "react";
import { X } from "lucide-react";
import { WebsiteIcon } from "./icons";
import type { ProfileLink } from "./types";

interface Props {
  links: ProfileLink[];
  onChange: (links: ProfileLink[]) => void;
}

/**
 * Personal-site editor. X and LinkedIn now have their own dedicated form rows
 * inside `PersonalCard`, so this component only manages residual personal-site
 * URLs (stored in `additional_social_media[]`) — hence one button only.
 */
export function LinksEditor({ links, onChange }: Props) {
  const update = (i: number, link: ProfileLink) => {
    const next = links.slice();
    next[i] = link;
    onChange(next);
  };

  const remove = (i: number) => {
    onChange(links.filter((_, j) => j !== i));
  };

  const addSite = () => {
    onChange([...links, { kind: "website", url: "" }]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {links.map((l, i) => (
        <div className="pr-input-group" key={`site-${i}`}>
          <span
            className="pr-pre"
            style={{ width: 46, justifyContent: "center" }}
            aria-hidden
          >
            <WebsiteIcon size={13} />
          </span>
          <input
            value={l.url}
            onChange={(e) => update(i, { ...l, url: e.target.value })}
            placeholder="https://..."
            aria-label="Personal site URL"
          />
          <span className="pr-post">
            <button
              type="button"
              className="pr-btn pr-btn--icon pr-btn--ghost"
              onClick={() => remove(i)}
              aria-label="Remove link"
            >
              <X size={14} />
            </button>
          </span>
        </div>
      ))}
      <div>
        <button
          type="button"
          className="pr-btn pr-btn--outline pr-btn--sm"
          onClick={addSite}
        >
          <WebsiteIcon size={12} /> Add Site
        </button>
      </div>
    </div>
  );
}
