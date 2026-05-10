"use client";

import * as React from "react";
import { LinkIcon } from "./icons";

interface Props {
  panel: React.ReactNode;
  /** Number of attributed signups credited to the user (any target_type). */
  referralCount: number;
}

/**
 * Themed wrapper for the existing ReferralLinkGenerator. The card head shows
 * the user's referral count (people they've brought into Builder Hub) so it's
 * visible even before they expand the link generator.
 */
export function ReferralPanelShell({ panel, referralCount }: Props) {
  return (
    <div className="pr-card">
      <div className="pr-head">
        <div className="pr-ico">
          <LinkIcon size={18} />
        </div>
        <div>
          <h3>Referrals</h3>
          <div className="pr-desc">
            {referralCount > 0
              ? `${referralCount.toLocaleString()} ${
                  referralCount === 1 ? "person" : "people"
                } have signed up through your links — keep sharing.`
              : "Share trackable links — earn recognition for every builder you bring in."}
          </div>
        </div>
        <div className="pr-right">
          <span
            className="pr-chip pr-chip--avax"
            title="People you've referred"
          >
            <span className="pr-dot" /> {referralCount.toLocaleString()} attributed
          </span>
        </div>
      </div>
      <div className="pr-body">{panel}</div>
    </div>
  );
}
