"use client";

import * as React from "react";
import Link from "next/link";
import { LineChart, Plus } from "lucide-react";
import { PlaygroundRow } from "./PlaygroundRow";

/**
 * Shape returned by `GET /api/playground` (the user's own dashboards). The
 * `charts` column is the raw stored JSON — an object
 * `{ charts, globalStartTime, globalEndTime }` or a legacy bare array — and is
 * normalized lazily by each row when expanded.
 */
export interface PlaygroundListItem {
  id: string;
  name: string | null;
  is_public: boolean;
  charts: unknown;
  created_at: string | null;
  updated_at: string | null;
  favorite_count: number;
  view_count: number;
  user_id: string;
}

interface Props {
  playgrounds: PlaygroundListItem[];
  loading?: boolean;
}

export function PlaygroundsCard({ playgrounds, loading = false }: Props) {
  return (
    <div className="pr-card">
      <div className="pr-head" style={{ alignItems: "flex-start" }}>
        <div className="pr-ico">
          <LineChart size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>Playground</h3>
          <div className="pr-desc">
            {loading
              ? "Loading your dashboards..."
              : playgrounds.length === 0
                ? "Build custom metric dashboards in the Stats Playground."
                : "Your saved dashboards — expand to preview, open to edit."}
          </div>
        </div>
        <Link
          href="/stats/playground"
          className="pr-btn pr-btn--sm pr-btn--outline"
          style={{ flexShrink: 0, textDecoration: "none" }}
        >
          <Plus size={14} />
          New dashboard
        </Link>
      </div>
      <div className="pr-body" style={{ gap: 12 }}>
        {loading ? (
          <>
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="pr-pg-row" style={{ opacity: 0.4 }} aria-hidden>
                <div className="pr-pg-row__head">
                  <div
                    className="pr-pg-row__toggle"
                    style={{ background: "var(--pr-g-300)" }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        width: "35%",
                        height: 14,
                        background: "var(--pr-g-300)",
                        borderRadius: 4,
                      }}
                    />
                    <div
                      style={{
                        width: "55%",
                        height: 12,
                        background: "var(--pr-g-300)",
                        borderRadius: 4,
                        marginTop: 6,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : playgrounds.length === 0 ? (
          <div className="pr-empty">
            No dashboards yet.{" "}
            <Link
              href="/stats/playground"
              style={{ color: "var(--pr-avax)", fontWeight: 600 }}
            >
              Create your first dashboard
            </Link>
            .
          </div>
        ) : (
          playgrounds.map((p) => <PlaygroundRow key={p.id} dashboard={p} />)
        )}
      </div>
    </div>
  );
}
