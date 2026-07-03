/**
 * Team1Card — profile tab content for the Team One organisational tree.
 *
 * Renders the full hierarchy of regions → admins → members, and (for users
 * with edit rights) a search-and-assign panel for unaffiliated Builder Hub
 * accounts.
 *
 * The tab visibility is enforced by `ProfilePage.tsx` via
 * `canSeeTeam1Tab(custom_attributes)`. This component is rendered only when
 * that gate passes; it does not re-check view rights. Write actions are
 * still re-checked server-side regardless of the `canWrite` prop.
 */

"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { Users, Lock, ChevronDown, Check } from "lucide-react";

import { canEditTeam1 } from "@/lib/auth/roles";

type AssignableRole = "team1-admin" | "team1-member" | "team1-technical";

const ROLE_LABELS: Record<AssignableRole, string> = {
  "team1-admin": "Admin",
  "team1-technical": "Technical",
  "team1-member": "Member",
};

const ROLES_FOR_DEVREL: ReadonlyArray<AssignableRole> = [
  "team1-admin",
  "team1-technical",
  "team1-member",
];
const ROLES_FOR_ADMIN: ReadonlyArray<AssignableRole> = [
  "team1-technical",
  "team1-member",
];

interface OrgMember {
  id: string;
  name: string;
  handle: string;
  email: string;
  country: string | null;
  joined: string;
  role: "team1-member" | "team1-technical";
}

interface OrgAdmin {
  id: string;
  name: string;
  handle: string;
  email: string;
  country: string | null;
  members: OrgMember[];
}

interface OrgRegion {
  teamId: string;
  label: string;
  admins: OrgAdmin[];
  unassignedMembers: OrgMember[];
  counts: {
    admins: number;
    technical: number;
    members: number;
  };
}

interface PoolBuilder {
  id: string;
  name: string;
  handle: string;
  email: string;
  country: string | null;
  team1Role: string | null;
}

type Toast = (msg: string, kind?: "success" | "error") => void;

interface Props {
  onToast?: Toast;
}

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();

const pluralize = (n: number, word: string) =>
  `${n} ${word}${n === 1 ? "" : "s"}`;

export function Team1Card({ onToast = () => {} }: Props) {
  const { data: session } = useSession();
  const canWrite = canEditTeam1(session?.user?.custom_attributes);
  const isDevRel = (session?.user?.custom_attributes ?? []).includes("devrel");
  const allowedRoles = isDevRel ? ROLES_FOR_DEVREL : ROLES_FOR_ADMIN;

  const [regions, setRegions] = React.useState<OrgRegion[]>([]);
  const [orgLoading, setOrgLoading] = React.useState(true);
  const [orgError, setOrgError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const [query, setQuery] = React.useState("");
  const [pool, setPool] = React.useState<PoolBuilder[]>([]);
  const [poolLoading, setPoolLoading] = React.useState(false);

  const loadOrg = React.useCallback(async () => {
    setOrgLoading(true);
    setOrgError(null);
    try {
      const res = await fetch("/api/team1/org");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { regions: OrgRegion[] };
      setRegions(data.regions);
      setExpanded(new Set(data.regions.map((r) => r.teamId)));
    } catch (err) {
      console.error("[Team1Card] failed to load org:", err);
      setOrgError("Could not load Team 1 members right now.");
    } finally {
      setOrgLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadOrg();
  }, [loadOrg]);

  // Debounced pool search.
  React.useEffect(() => {
    if (!canWrite) return;
    const q = query.trim();
    if (q.length < 2) {
      setPool([]);
      return;
    }
    let cancelled = false;
    setPoolLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/team1/pool?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((data: { pool: PoolBuilder[] }) => {
          if (cancelled) return;
          setPool(data.pool);
        })
        .catch((err) => {
          if (cancelled) return;
          console.error("[Team1Card] pool search failed:", err);
          setPool([]);
        })
        .finally(() => {
          if (!cancelled) setPoolLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, canWrite]);

  const toggleRegion = (teamId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  const stats = React.useMemo(() => {
    return regions.reduce(
      (acc, r) => ({
        regions: acc.regions + 1,
        admins: acc.admins + r.counts.admins,
        technical: acc.technical + r.counts.technical,
        members: acc.members + r.counts.members,
      }),
      { regions: 0, admins: 0, technical: 0, members: 0 },
    );
  }, [regions]);

  const handleAssign = async (
    builder: PoolBuilder,
    teamId: string,
    role: AssignableRole,
  ) => {
    if (!canWrite) return;
    try {
      const res = await fetch("/api/team1/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ builderId: builder.id, teamId, role }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      onToast(`Assigned ${builder.name} as ${ROLE_LABELS[role]}`);
      setPool((prev) => prev.filter((p) => p.id !== builder.id));
      void loadOrg();
    } catch (err) {
      console.error("[Team1Card] assign failed:", err);
      onToast(
        err instanceof Error
          ? `Couldn't assign: ${err.message}`
          : `Couldn't assign ${builder.name}`,
        "error",
      );
    }
  };

  const handleRemove = async (member: OrgMember) => {
    if (!canWrite) return;
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        `Remove ${member.name} from Team 1? This clears their team_id and revokes the team1-member role.`,
      );
      if (!ok) return;
    }
    try {
      const res = await fetch("/api/team1/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.id }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      onToast(`Removed ${member.name} from Team 1`);
      void loadOrg();
    } catch (err) {
      console.error("[Team1Card] remove failed:", err);
      onToast(
        err instanceof Error
          ? `Couldn't remove: ${err.message}`
          : `Couldn't remove ${member.name}`,
        "error",
      );
    }
  };

  return (
    <div className="pr-card">
      <div className="pr-head">
        <div
          className="pr-ico"
          style={{
            background: "var(--pr-primary-light)",
            color: "var(--pr-accent-main)",
          }}
        >
          <Users size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>Team 1</h3>
          <div className="pr-desc">
            {orgLoading
              ? "Loading the Team 1 organisation…"
              : `${pluralize(stats.admins, "admin")} · ${stats.technical} technical · ${pluralize(stats.members, "member")} across ${pluralize(stats.regions, "region")}`}
            {!canWrite && (
              <span style={{ marginLeft: 10, fontFamily: "var(--pr-mono, ui-monospace)", fontSize: 11, color: "var(--pr-g-650)" }}>
                · READ ONLY
              </span>
            )}
          </div>
        </div>
        <span className="pr-insights__devrel-pill">
          {canWrite ? "Admin" : "Viewer"}
        </span>
      </div>

      <div className="pr-body">
        {orgError ? (
          <div className="pr-empty">{orgError}</div>
        ) : (
          <>
            {canWrite && (
              <AssignPanel
                query={query}
                onQuery={setQuery}
                pool={pool}
                poolLoading={poolLoading}
                regions={regions}
                allowedRoles={allowedRoles}
                onAssign={handleAssign}
              />
            )}

            <OrgTree
              regions={regions}
              loading={orgLoading}
              expanded={expanded}
              onToggle={toggleRegion}
              canWrite={canWrite}
              onRemove={handleRemove}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Subviews ──────────────────────────────────────────────────────────

interface AssignPanelProps {
  query: string;
  onQuery: (next: string) => void;
  pool: PoolBuilder[];
  poolLoading: boolean;
  regions: OrgRegion[];
  allowedRoles: ReadonlyArray<AssignableRole>;
  onAssign: (builder: PoolBuilder, teamId: string, role: AssignableRole) => void;
}

function AssignPanel({
  query,
  onQuery,
  pool,
  poolLoading,
  regions,
  allowedRoles,
  onAssign,
}: AssignPanelProps) {
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        paddingBottom: 18,
        borderBottom: "1px solid var(--pr-hairline)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span
          style={{
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            fontWeight: 600,
            color: "var(--pr-g-900)",
          }}
        >
          Assign Team 1 member
        </span>
        <span style={{ fontSize: 12, color: "var(--pr-g-650)" }}>
          Search any Builder Hub account by name, handle, or email — then pick
          the region.
        </span>
      </div>

      <input
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Type at least 2 characters…"
        style={{
          height: 38,
          padding: "0 14px",
          border: "1px solid var(--pr-hairline)",
          borderRadius: 10,
          background: "var(--pr-g-100)",
          fontSize: 14,
          color: "var(--pr-g-1000)",
          outline: "none",
        }}
      />

      {query.trim().length < 2 ? null : poolLoading ? (
        <div style={{ fontSize: 12, color: "var(--pr-g-650)", padding: "8px 4px" }}>
          Searching…
        </div>
      ) : pool.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--pr-g-650)", padding: "8px 4px" }}>
          No unaffiliated Builder Hub accounts match {`"${query.trim()}"`}.
        </div>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {pool.map((b) => (
            <li
              key={b.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 14,
                padding: "10px 12px",
                border: "1px solid var(--pr-hairline)",
                borderRadius: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                <Avatar text={initials(b.name)} />
                <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--pr-g-1000)" }}>
                    {b.name}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--pr-g-650)",
                      fontFamily: "var(--pr-mono, ui-monospace)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    @{b.handle} · {b.country ?? "—"} · {b.email}
                  </span>
                </div>
              </div>
              <AssignPopover
                regions={regions}
                allowedRoles={allowedRoles}
                onConfirm={(teamId, role) => onAssign(b, teamId, role)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AssignPopover({
  regions,
  allowedRoles,
  onConfirm,
}: {
  regions: OrgRegion[];
  allowedRoles: ReadonlyArray<AssignableRole>;
  onConfirm: (teamId: string, role: AssignableRole) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [teamId, setTeamId] = React.useState<string>(regions[0]?.teamId ?? "");
  const [role, setRole] = React.useState<AssignableRole>(
    allowedRoles.includes("team1-member") ? "team1-member" : allowedRoles[0],
  );
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  // Reset selection whenever the popover opens (or the upstream region
  // list changes), so each row starts from a clean default.
  React.useEffect(() => {
    if (!open) return;
    setTeamId(regions[0]?.teamId ?? "");
  }, [open, regions]);

  React.useEffect(() => {
    if (!open) return;
    function onDocMouse(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (regions.length === 0) {
    return (
      <span style={{ fontSize: 12, color: "var(--pr-g-650)" }}>
        No regions available
      </span>
    );
  }

  const canConfirm = !!teamId && !!role;
  const singleRegion = regions.length === 1;
  const triggerLabel = singleRegion ? `Assign to ${regions[0].label}` : "Assign";

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 32,
          padding: "0 12px",
          border: "1px solid var(--pr-hairline)",
          borderRadius: 8,
          background: open ? "var(--pr-g-200)" : "var(--pr-g-100)",
          fontSize: 12,
          fontWeight: 500,
          color: "var(--pr-g-1000)",
          cursor: "pointer",
        }}
      >
        {triggerLabel}
        <ChevronDown
          size={14}
          style={{
            color: "var(--pr-g-650)",
            transition: "transform 120ms ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Assign to Team 1"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 30,
            minWidth: 260,
            padding: 14,
            background: "var(--pr-g-100)",
            border: "1px solid var(--pr-hairline)",
            borderRadius: 12,
            boxShadow:
              "0 1px 2px rgba(0,0,0,0.04), 0 12px 28px rgba(0,0,0,0.10)",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {!singleRegion && (
            <PopoverGroup label="Region">
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                }}
              >
                {regions.map((r) => (
                  <PillButton
                    key={r.teamId}
                    selected={r.teamId === teamId}
                    onClick={() => setTeamId(r.teamId)}
                  >
                    {r.teamId === teamId && (
                      <Check size={12} strokeWidth={2.5} />
                    )}
                    {r.label}
                  </PillButton>
                ))}
              </div>
            </PopoverGroup>
          )}

          <PopoverGroup label="Role">
            <div style={{ display: "flex", gap: 6 }}>
              {allowedRoles.map((r) => (
                <PillButton
                  key={r}
                  selected={r === role}
                  onClick={() => setRole(r)}
                >
                  {r === role && <Check size={12} strokeWidth={2.5} />}
                  {ROLE_LABELS[r]}
                </PillButton>
              ))}
            </div>
          </PopoverGroup>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              paddingTop: 4,
              borderTop: "1px solid var(--pr-hairline)",
            }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                height: 30,
                padding: "0 12px",
                border: "1px solid var(--pr-hairline)",
                borderRadius: 8,
                background: "transparent",
                fontSize: 12,
                color: "var(--pr-g-700)",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canConfirm}
              onClick={() => {
                if (!canConfirm) return;
                setOpen(false);
                onConfirm(teamId, role);
              }}
              style={{
                height: 30,
                padding: "0 14px",
                border: "1px solid var(--pr-accent-main)",
                borderRadius: 8,
                background: "var(--pr-accent-main)",
                fontSize: 12,
                fontWeight: 600,
                color: "white",
                cursor: canConfirm ? "pointer" : "not-allowed",
                opacity: canConfirm ? 1 : 0.6,
              }}
            >
              Assign
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PopoverGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--pr-g-650)",
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function PillButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        height: 28,
        padding: "0 10px",
        border: `1px solid ${selected ? "var(--pr-g-1000)" : "var(--pr-hairline)"}`,
        borderRadius: 999,
        background: selected ? "var(--pr-g-1000)" : "transparent",
        fontSize: 12,
        fontWeight: 500,
        color: selected ? "var(--pr-g-100)" : "var(--pr-g-800)",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

interface OrgTreeProps {
  regions: OrgRegion[];
  loading: boolean;
  expanded: Set<string>;
  onToggle: (teamId: string) => void;
  canWrite: boolean;
  onRemove: (member: OrgMember) => void;
}

function OrgTree({
  regions,
  loading,
  expanded,
  onToggle,
  canWrite,
  onRemove,
}: OrgTreeProps) {
  if (loading) {
    return (
      <div style={{ fontSize: 12, color: "var(--pr-g-650)", padding: "8px 4px" }}>
        Loading the organisation…
      </div>
    );
  }
  if (regions.length === 0) {
    return (
      <div className="pr-empty">
        <Lock size={18} />
        <span style={{ marginLeft: 8 }}>
          No Team 1 regions to show. Once an admin is assigned a `team1-admin`
          role and a `team_id`, their region will appear here.
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {regions.map((r) => {
        const isOpen = expanded.has(r.teamId);
        return (
          <div
            key={r.teamId}
            style={{
              border: "1px solid var(--pr-hairline)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => onToggle(r.teamId)}
              style={{
                width: "100%",
                display: "grid",
                gridTemplateColumns: "1fr auto auto",
                alignItems: "center",
                gap: 14,
                padding: "12px 16px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                color: "var(--pr-g-1000)",
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 600 }}>{r.label}</span>
              <RegionCounts counts={r.counts} />
              <span
                style={{
                  display: "grid",
                  placeItems: "center",
                  width: 20,
                  height: 20,
                  color: "var(--pr-g-650)",
                  fontFamily: "var(--pr-mono, ui-monospace)",
                  fontSize: 16,
                }}
              >
                {isOpen ? "–" : "+"}
              </span>
            </button>
            {isOpen && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  padding: "8px 16px 14px",
                  borderTop: "1px solid var(--pr-hairline)",
                }}
              >
                {r.admins.length === 0 && r.unassignedMembers.length === 0 ? (
                  <div
                    style={{
                      padding: "10px 12px",
                      border: "1px dashed var(--pr-hairline)",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "var(--pr-g-650)",
                      fontFamily: "var(--pr-mono, ui-monospace)",
                    }}
                  >
                    No admins or members yet in this region.
                  </div>
                ) : (
                  <>
                    {r.admins.map((a) => (
                      <AdminBlock
                        key={a.id}
                        admin={a}
                        canWrite={canWrite}
                        onRemove={onRemove}
                      />
                    ))}
                    {r.unassignedMembers.length > 0 && (
                      <UnassignedMembers
                        members={r.unassignedMembers}
                        canWrite={canWrite}
                        onRemove={onRemove}
                      />
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RegionCounts({ counts }: { counts: OrgRegion["counts"] }) {
  return (
    <span
      style={{
        display: "flex",
        gap: 8,
        fontSize: 11,
        color: "var(--pr-g-650)",
        fontFamily: "var(--pr-mono, ui-monospace)",
        whiteSpace: "nowrap",
      }}
    >
      <span>{pluralize(counts.admins, "admin")}</span>
      <span style={{ opacity: 0.5 }}>·</span>
      <span>{counts.technical} technical</span>
      <span style={{ opacity: 0.5 }}>·</span>
      <span>{pluralize(counts.members, "member")}</span>
    </span>
  );
}

function AdminBlock({
  admin,
  canWrite,
  onRemove,
}: {
  admin: OrgAdmin;
  canWrite: boolean;
  onRemove: (member: OrgMember) => void;
}) {
  const technicalCount = admin.members.filter((m) => m.role === "team1-technical").length;
  const memberCount = admin.members.filter((m) => m.role === "team1-member").length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 4px" }}>
        <Avatar text={initials(admin.name)} variant="admin" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--pr-g-1000)" }}>
            {admin.name}
            <span
              style={{
                marginLeft: 8,
                padding: "2px 7px",
                background: "var(--pr-primary-light)",
                color: "var(--pr-accent-main)",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                borderRadius: 4,
                verticalAlign: "middle",
              }}
            >
              admin
            </span>
          </span>
          <div
            style={{
              fontSize: 11,
              color: "var(--pr-g-650)",
              fontFamily: "var(--pr-mono, ui-monospace)",
              marginTop: 2,
            }}
          >
            @{admin.handle} · {admin.email}
          </div>
        </div>
        <span
          style={{
            fontSize: 11,
            color: "var(--pr-g-650)",
            fontFamily: "var(--pr-mono, ui-monospace)",
            whiteSpace: "nowrap",
          }}
        >
          {technicalCount > 0 ? `${technicalCount} technical · ` : ""}
          {pluralize(memberCount, "member")}
        </span>
      </div>
      {admin.members.length > 0 ? (
        <MemberList
          members={admin.members}
          canWrite={canWrite}
          onRemove={onRemove}
        />
      ) : (
        <div
          style={{
            marginLeft: 18,
            padding: "8px 12px",
            border: "1px dashed var(--pr-hairline)",
            borderRadius: 8,
            background: "var(--pr-g-100)",
            fontSize: 11.5,
            color: "var(--pr-g-650)",
            fontFamily: "var(--pr-mono, ui-monospace)",
          }}
        >
          No members assigned yet.
        </div>
      )}
    </div>
  );
}

function UnassignedMembers({
  members,
  canWrite,
  onRemove,
}: {
  members: OrgMember[];
  canWrite: boolean;
  onRemove: (member: OrgMember) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--pr-g-650)",
          padding: "4px 4px 0",
          fontWeight: 600,
        }}
      >
        Members without an admin
      </div>
      <MemberList
        members={members}
        canWrite={canWrite}
        onRemove={onRemove}
      />
    </div>
  );
}

function MemberList({
  members,
  canWrite,
  onRemove,
}: {
  members: OrgMember[];
  canWrite: boolean;
  onRemove: (member: OrgMember) => void;
}) {
  return (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        paddingLeft: 18,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {members.map((m, idx) => {
        const isLast = idx === members.length - 1;
        return (
          <li
            key={m.id}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "6px 4px 6px 22px",
              minHeight: 36,
            }}
          >
            {/* Vertical trunk — full height except the last row, which
                stops half-way so the L turns into the row's centre. */}
            <span
              aria-hidden
              style={{
                position: "absolute",
                left: 6,
                top: 0,
                bottom: isLast ? "50%" : 0,
                width: 1,
                background: "var(--pr-hairline)",
              }}
            />
            {/* Horizontal stub from trunk into the row centre. */}
            <span
              aria-hidden
              style={{
                position: "absolute",
                left: 6,
                top: "50%",
                width: 12,
                height: 1,
                background: "var(--pr-hairline)",
              }}
            />
            <Avatar text={initials(m.name)} size="sm" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--pr-g-1000)" }}>
                {m.name}
                {m.role === "team1-technical" && (
                  <span
                    style={{
                      marginLeft: 8,
                      padding: "1px 6px",
                      background: "var(--pr-g-200)",
                      color: "var(--pr-g-800)",
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      borderRadius: 4,
                      verticalAlign: "middle",
                    }}
                  >
                    tech
                  </span>
                )}
              </span>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--pr-g-650)",
                  fontFamily: "var(--pr-mono, ui-monospace)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  marginTop: 1,
                }}
              >
                @{m.handle} · joined {m.joined}
              </div>
            </div>
            {canWrite && (
              <button
                type="button"
                onClick={() => onRemove(m)}
                title="Remove from Team 1"
                style={{
                  padding: "5px 12px",
                  border: "1px solid var(--pr-hairline)",
                  borderRadius: 6,
                  background: "transparent",
                  fontSize: 11.5,
                  color: "var(--pr-g-700)",
                  cursor: "pointer",
                  fontFamily: "var(--pr-mono, ui-monospace)",
                }}
              >
                Remove
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Avatar({
  text,
  variant,
  size = "md",
}: {
  text: string;
  variant?: "admin";
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? 24 : 30;
  return (
    <span
      style={{
        width: dim,
        height: dim,
        borderRadius: size === "sm" ? 6 : 8,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        background:
          variant === "admin" ? "var(--pr-primary-light)" : "var(--pr-g-200)",
        color: variant === "admin" ? "var(--pr-accent-main)" : "var(--pr-g-900)",
        fontFamily: "var(--pr-mono, ui-monospace)",
        fontWeight: 600,
        fontSize: size === "sm" ? 10 : 11,
        letterSpacing: "0.04em",
      }}
    >
      {text}
    </span>
  );
}
