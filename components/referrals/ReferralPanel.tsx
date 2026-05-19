"use client";

/**
 * ReferralPanel — compact, list-first referrals card.
 *
 * Reusable across the profile shell and Builder Insights. Self
 * contained: renders its own card chrome (header + body), uses scoped CSS via
 * the `referral-panel` class so it picks up the same dark/light tokens as the
 * profile shell. Falls back to the avax dark theme when used outside the
 * `.profile` scope.
 *
 * QR code is a per-link add-on: each row has a QR button that toggles an
 * inline panel showing the QR + a copy-to-clipboard.
 */

import * as React from "react";
import {
  Copy,
  Plus,
  X,
  Rocket,
  Code,
  Gift,
  Trophy,
  Link2,
  QrCode,
  Check,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import "./referral-panel.css";

export type ReferralTargetIcon = "rocket" | "trophy" | "code" | "gift";

export interface ReferralPanelTarget {
  /** Stable key — used for React lists and dedupe against existing links. */
  key: string;
  /** UI label, e.g. "Builder Hub Sign Up". */
  label: string;
  /** Optional helper text shown next to the label in the picker. */
  detail?: string;
  /** Backend `target_type` for `createReferralLink`. */
  targetType: string;
  /** Backend `target_id` for `createReferralLink`. */
  targetId: string | null;
  /** Backend `destination_url` for `createReferralLink`. */
  destinationUrl: string;
  /** Lucide-style icon to render in the chip. */
  icon: ReferralTargetIcon;
}

export interface ReferralPanelLink {
  id: string;
  /** Already-built share URL, e.g. `https://build.avax.network/?ref=ABC`. */
  shareUrl: string;
  signups: number;
  /** The `target_type` of this link — used to match against the catalog. */
  targetType: string;
  targetId: string | null;
  /** Display name for the link, taken from the matching catalog target. */
  targetLabel: string;
  /** Icon kind, taken from the matching catalog target. */
  targetIcon: ReferralTargetIcon;
}

export interface ReferralPanelProps {
  /** Existing referral links the user owns. */
  links: ReferralPanelLink[];
  /** Available targets the user can mint a new link for. */
  targets: ReferralPanelTarget[];
  /**
   * Total signups attributed to the user (across all link targets). Shown in
   * the header next to the title. Defaults to sum of `links[i].signups`.
   */
  totalSignups?: number;
  /** Called when a user picks a target to create a new link for. */
  onCreate: (target: ReferralPanelTarget) => Promise<void> | void;
  /** Optional copy callback fired alongside the built-in clipboard write. */
  onCopy?: (link: ReferralPanelLink) => void;
  /** Loading flag — render skeleton state. */
  loading?: boolean;
}

function TargetIcon({
  kind,
  size = 12,
}: {
  kind: ReferralTargetIcon;
  size?: number;
}) {
  switch (kind) {
    case "rocket":
      return <Rocket size={size} />;
    case "trophy":
      return <Trophy size={size} />;
    case "code":
      return <Code size={size} />;
    case "gift":
      return <Gift size={size} />;
  }
}

function formatHostPath(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

const TARGET_TYPE_RANK: Record<string, number> = {
  bh_signup: 0,
  hackathon_registration: 1,
  grant_application: 2,
};
function rankForTargetType(t: string): number {
  return TARGET_TYPE_RANK[t] ?? 99;
}

export function ReferralPanel({
  links,
  targets,
  totalSignups,
  onCreate,
  onCopy,
  loading = false,
}: ReferralPanelProps) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [creatingKey, setCreatingKey] = React.useState<string | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [qrLinkId, setQrLinkId] = React.useState<string | null>(null);

  // Only surface link types we currently market — drops legacy types like
  // build_games_application from the user-facing list. Also hide links whose
  // specific target is no longer in the active catalog (e.g., a referral
  // link for a hackathon that has ended). `bh_signup` has `targetId: null`
  // and is always in the catalog, so it survives this check. Sorted so
  // Builder Hub Sign Up always appears first.
  const catalogSignatures = React.useMemo(
    () => new Set(targets.map((t) => `${t.targetType}|${t.targetId ?? ""}`)),
    [targets],
  );
  const visibleLinks = React.useMemo(
    () =>
      links
        .filter((l) => {
          if (!(l.targetType in TARGET_TYPE_RANK)) return false;
          return catalogSignatures.has(`${l.targetType}|${l.targetId ?? ""}`);
        })
        .slice()
        .sort((a, b) => rankForTargetType(a.targetType) - rankForTargetType(b.targetType)),
    [links, catalogSignatures],
  );

  const usedTargetSignatures = new Set(
    visibleLinks.map((l) => `${l.targetType}|${l.targetId ?? ""}`),
  );
  const availableTargets = targets
    .filter(
      (t) =>
        t.targetType in TARGET_TYPE_RANK &&
        !usedTargetSignatures.has(`${t.targetType}|${t.targetId ?? ""}`),
    )
    .slice()
    .sort((a, b) => rankForTargetType(a.targetType) - rankForTargetType(b.targetType));

  const computedTotal = React.useMemo(
    () =>
      typeof totalSignups === "number"
        ? totalSignups
        : visibleLinks.reduce((sum, l) => sum + (l.signups ?? 0), 0),
    [totalSignups, visibleLinks],
  );

  const handleCopy = (link: ReferralPanelLink) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(link.shareUrl);
    }
    setCopiedId(link.id);
    onCopy?.(link);
    window.setTimeout(() => {
      setCopiedId((prev) => (prev === link.id ? null : prev));
    }, 1800);
  };

  const handlePick = async (target: ReferralPanelTarget) => {
    setCreatingKey(target.key);
    try {
      await onCreate(target);
      setPickerOpen(false);
    } finally {
      setCreatingKey(null);
    }
  };

  const qrLink = qrLinkId ? links.find((l) => l.id === qrLinkId) ?? null : null;

  return (
    <div className="referral-panel">
      <header className="rp-head">
        <span className="rp-head-ico" aria-hidden>
          <Link2 size={18} />
        </span>
        <h3 className="rp-head-title">Referrals</h3>
        <div className="rp-head-stat" aria-label="Total signups">
          <b>{loading ? "—" : computedTotal.toLocaleString()}</b>
          <span>signups</span>
        </div>
      </header>

      <div className="rp-body">
        {loading ? (
          <div className="rp-row rp-skeleton" aria-hidden>
            <span className="rp-em" />
            <div className="rp-row-meta">
              <span className="rp-skel" style={{ width: "40%" }} />
              <span className="rp-skel" style={{ width: "70%" }} />
            </div>
          </div>
        ) : visibleLinks.length === 0 ? (
          <div className="rp-empty">
            <span className="rp-empty-em">
              <Link2 size={18} />
            </span>
            <div>
              <div className="rp-empty-title">No referral links yet</div>
              <div className="rp-empty-sub">
                Generate one to start tracking signups.
              </div>
            </div>
          </div>
        ) : (
          <ul className="rp-list">
            {visibleLinks.map((l) => {
              const isCopied = copiedId === l.id;
              const isQrOpen = qrLinkId === l.id;
              return (
                <li key={l.id}>
                  <div className="rp-row">
                    <span className="rp-em">
                      <TargetIcon kind={l.targetIcon} size={12} />
                    </span>
                    <div className="rp-row-meta">
                      <span className="rp-row-title">{l.targetLabel}</span>
                    </div>
                    <div className="rp-row-stat" aria-label="Signups">
                      <b>{l.signups.toLocaleString()}</b>
                      <span>signups</span>
                    </div>
                    <div className="rp-row-actions">
                      <button
                        type="button"
                        className="rp-icon-btn"
                        aria-pressed={isQrOpen}
                        aria-label={`Show QR code for ${l.targetLabel}`}
                        onClick={() =>
                          setQrLinkId((prev) => (prev === l.id ? null : l.id))
                        }
                      >
                        <QrCode size={13} />
                      </button>
                      <button
                        type="button"
                        className="rp-icon-btn"
                        aria-label={`Copy ${l.targetLabel} link`}
                        onClick={() => handleCopy(l)}
                      >
                        {isCopied ? <Check size={13} /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>
                  {isQrOpen && (
                    <div className="rp-qr">
                      <div className="rp-qr-canvas">
                        <QRCodeSVG value={l.shareUrl} size={132} />
                      </div>
                      <div className="rp-qr-meta">
                        <div className="rp-qr-label">Scan to share</div>
                        <div className="rp-qr-url" title={l.shareUrl}>
                          {formatHostPath(l.shareUrl)}
                        </div>
                        <button
                          type="button"
                          className="rp-text-btn"
                          onClick={() => handleCopy(l)}
                        >
                          <Copy size={12} />
                          {isCopied ? "Copied" : "Copy link"}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {!loading && availableTargets.length > 0 && (
          <div className="rp-add">
            {pickerOpen ? (
              <div className="rp-picker">
                <div className="rp-picker-head">
                  <span>Pick a destination</span>
                  <button
                    type="button"
                    className="rp-icon-btn"
                    onClick={() => setPickerOpen(false)}
                    aria-label="Close picker"
                  >
                    <X size={13} />
                  </button>
                </div>
                <ul>
                  {availableTargets.map((t) => {
                    const isCreating = creatingKey === t.key;
                    return (
                      <li key={t.key}>
                        <button
                          type="button"
                          className="rp-picker-item"
                          disabled={isCreating}
                          onClick={() => void handlePick(t)}
                          title={t.detail}
                        >
                          <span className="rp-em">
                            <TargetIcon kind={t.icon} size={12} />
                          </span>
                          <span className="rp-picker-label">{t.label}</span>
                          {isCreating ? (
                            <span className="rp-picker-detail">Creating…</span>
                          ) : t.detail ? (
                            <span className="rp-picker-detail">{t.detail}</span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <button
                type="button"
                className="rp-add-btn"
                onClick={() => setPickerOpen(true)}
              >
                <Plus size={13} />
                New referral link
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
