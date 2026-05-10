"use client";

import * as React from "react";
import { LinkIcon } from "./icons";

interface Props {
  panel: React.ReactNode;
}

/**
 * Themed wrapper for the existing ReferralLinkGenerator component.
 * The redesigned UX matches the prototype's `ReferralPanel` skeleton
 * (header + chip), but the inner widget is the production implementation
 * so analytics, target validation, and link creation keep working.
 *
 * TODO(profile-redesign): port the inner widget to match the prototype's
 * referrals tab styling (target picker, generated URL preview, stats list).
 */
export function ReferralPanelShell({ panel }: Props) {
  return (
    <div className="pr-card">
      <div className="pr-head">
        <div className="pr-ico">
          <LinkIcon size={18} />
        </div>
        <div>
          <h3>Referral links</h3>
          <div className="pr-desc">
            Share trackable links — earn rewards for every builder you bring in.
          </div>
        </div>
        <div className="pr-right">
          <span className="pr-chip pr-chip--accent">
            <span className="pr-dot" /> Active
          </span>
        </div>
      </div>
      <div className="pr-body">{panel}</div>
    </div>
  );
}
