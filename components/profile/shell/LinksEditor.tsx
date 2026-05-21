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
 * URLs (stored in `additional_social_accounts[]`) — hence one button only.
 *
 * Pending blank rows are kept in local state so clicking "Add Site" gives the
 * user an empty input to fill in. Only non-empty URLs are pushed up to the
 * form to keep Zod URL validation happy.
 */
export function LinksEditor({ links, onChange }: Props) {
  const [drafts, setDrafts] = React.useState<ProfileLink[]>(links);

  // When the parent's saved list grows (e.g. initial profile load lands after
  // mount), bring those entries into local state. We only adopt growth so an
  // in-progress blank row the user just added doesn't get clobbered when the
  // parent filters it out on the way back down.
  React.useEffect(() => {
    setDrafts((prev) => {
      const filled = prev.filter((l) => l.url.trim() !== "");
      if (links.length > filled.length) return links;
      return prev;
    });
  }, [links]);

  const commit = (next: ProfileLink[]) => {
    setDrafts(next);
    onChange(next.filter((l) => l.url.trim() !== ""));
  };

  const update = (i: number, link: ProfileLink) => {
    const next = drafts.slice();
    next[i] = link;
    commit(next);
  };

  const remove = (i: number) => {
    commit(drafts.filter((_, j) => j !== i));
  };

  const addSite = () => {
    commit([...drafts, { kind: "website", url: "" }]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {drafts.map((l, i) => (
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
