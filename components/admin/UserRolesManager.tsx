"use client";

import { useMemo, useRef, useState } from "react";
import { UserSearchPicker, type SearchUser } from "@/components/common/UserSearchPicker";
import { ROLE_PERMISSIONS } from "@/lib/auth/rolePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, History } from "lucide-react";
import { toast } from "@/lib/toast";

type Actor = { id: string; name: string | null; email: string | null } | null;

/** One grant episode. Rows are never deleted, so a role can have several. */
type RoleRow = {
  id: string;
  role: string;
  expires_at: string | null;
  granted_by: string | null;
  granted_by_user: Actor;
  granted_at: string;
  granted_comment: string | null;
  revoked_by: string | null;
  revoked_by_user: Actor;
  revoked_at: string | null;
  revoked_comment: string | null;
  active: boolean;
};

type SelectedUser = { id: string; name: string | null; email: string | null };

/** One row's editable state: held or not, and when it lapses ("" = never). */
type Draft = { granted: boolean; expiresOn: string };

const ALL_ROLES = Object.keys(ROLE_PERMISSIONS).sort();
const TODAY = () => new Date().toISOString().slice(0, 10);

/**
 * A role carrying resource "*" is full platform access (today: devrel).
 * Detected from the permission map rather than the name, so a second
 * wildcard role added later warns without touching this file.
 */
const isFullAccessRole = (role: string) =>
  (ROLE_PERMISSIONS[role] ?? []).some((p) => p.resource === "*");

/** "event:manage (own), resource:manage, …" — what the role actually grants. */
function describeRole(role: string): string {
  return (ROLE_PERMISSIONS[role] ?? [])
    .map((p) => `${p.resource}:${p.action}${p.scope === "own" ? " (own)" : ""}`)
    .join(", ");
}

/** "Armin (armin@team1.network)", falling back to whichever half exists. */
function actorName(actor: Actor, rawId: string | null): string {
  if (!actor) return rawId ?? "unknown";
  if (actor.name && actor.email) return `${actor.name} (${actor.email})`;
  return actor.name ?? actor.email ?? actor.id;
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/** How an episode ended — drives the table line, its colour and the timeline. */
type Outcome = "held" | "revoked" | "expired" | "replaced";

/**
 * Computed here rather than read from the server's `active` flag: that flag is
 * evaluated once when the page loads and goes stale as soon as an expiry passes
 * while the page sits open, which showed lapsed grants as still held.
 */
function isActive(episode: RoleRow, now = new Date()): boolean {
  if (episode.revoked_at) return false;
  return !episode.expires_at || new Date(episode.expires_at) > now;
}

function outcomeOf(episode: RoleRow, now = new Date()): Outcome {
  // revoked_by, not revoked_at: a closed row with no revoker simply ran out.
  if (episode.revoked_by) return "revoked";
  // Expiry beats closure: a lapsed grant that was later superseded still ended
  // by running out, not by being replaced.
  if (episode.expires_at && new Date(episode.expires_at) <= now) return "expired";
  if (episode.revoked_at) return "replaced";
  return "held";
}

/** The API wants a future ISO instant; a date input gives a day, so the grant
 *  runs to the end of that day in the admin's own timezone. */
const endOfDayIso = (day: string) => new Date(`${day}T23:59:59`).toISOString();

function draftsFromRows(rows: RoleRow[]): Record<string, Draft> {
  const drafts: Record<string, Draft> = {};
  for (const role of ALL_ROLES) {
    // rows arrive newest-first, so this is the current open episode if any.
    const held = rows.find((r) => r.role === role && isActive(r));
    drafts[role] = {
      granted: !!held,
      expiresOn: held?.expires_at ? held.expires_at.slice(0, 10) : "",
    };
  }
  return drafts;
}

/** "+ Armin · 5 Sep 2026" / "− Dana · 12 Sep" / "expired 1 Aug" — newest only. */
function latestLine(episode: RoleRow): string {
  switch (outcomeOf(episode)) {
    case "revoked":
      return `− ${actorName(episode.revoked_by_user, episode.revoked_by)} · ${shortDate(episode.revoked_at!)}`;
    case "expired":
      return `expired ${shortDate(episode.expires_at!)}`;
    case "replaced":
      return `replaced ${shortDate(episode.revoked_at!)}`;
    default:
      return `+ ${actorName(episode.granted_by_user, episode.granted_by)} · ${shortDate(episode.granted_at)}`;
  }
}

const OUTCOME_LABEL: Record<Outcome, string> = {
  held: "Currently held",
  revoked: "Revoked",
  expired: "Expired",
  replaced: "Replaced",
};

function latestClass(episode: RoleRow): string {
  switch (outcomeOf(episode)) {
    case "revoked":
      return "text-red-600/80 dark:text-red-400/80";
    case "expired":
      return "text-amber-700/80 dark:text-amber-400/80";
    case "replaced":
      return "text-zinc-500 dark:text-zinc-500";
    default:
      return "text-zinc-600 dark:text-zinc-400";
  }
}

function HistoryDialog({
  role,
  episodes,
  userLabel,
  onClose,
}: {
  role: string | null;
  episodes: RoleRow[];
  userLabel: string;
  onClose: () => void;
}) {
  return (
    <Dialog open={role !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono text-base">{role}</DialogTitle>
          <DialogDescription>
            Every time {userLabel} was granted or lost this role. Rows are never
            deleted, so this is the complete record.
          </DialogDescription>
        </DialogHeader>

        <ol className="max-h-96 space-y-3 overflow-y-auto">
          {episodes.map((episode) => {
            const outcome = outcomeOf(episode);
            return (
              <li
                key={episode.id}
                className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {OUTCOME_LABEL[outcome]}
                  </span>
                  {episode.expires_at && (
                    <span className="text-xs text-zinc-500 dark:text-zinc-500">
                      expiry {dateTime(episode.expires_at)}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  granted by {actorName(episode.granted_by_user, episode.granted_by)}
                  {" · "}
                  {dateTime(episode.granted_at)}
                </div>
                {episode.granted_comment && (
                  <div className="mt-0.5 text-xs italic text-zinc-500 dark:text-zinc-500">
                    “{episode.granted_comment}”
                  </div>
                )}
                {episode.revoked_by && episode.revoked_at && (
                  <div className="text-xs text-red-600/90 dark:text-red-400/90">
                    revoked by {actorName(episode.revoked_by_user, episode.revoked_by)}
                    {" · "}
                    {dateTime(episode.revoked_at)}
                  </div>
                )}
                {episode.revoked_comment && (
                  <div className="mt-0.5 text-xs italic text-red-600/70 dark:text-red-400/70">
                    “{episode.revoked_comment}”
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </DialogContent>
    </Dialog>
  );
}

export function UserRolesManager() {
  const rolesRequest = useRef(0);
  const [user, setUser] = useState<SelectedUser | null>(null);
  const [rows, setRows] = useState<RoleRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [historyRole, setHistoryRole] = useState<string | null>(null);
  // One reason for the whole save. Per-role reasons would be more precise, but
  // a save is normally one decision ("onboarding Dana"), so a single field
  // keeps the table from growing a text input on every row.
  const [reason, setReason] = useState("");

  const saved = useMemo(() => draftsFromRows(rows), [rows]);
  const changed = useMemo(
    () =>
      ALL_ROLES.filter((role) => {
        const before = saved[role];
        const after = drafts[role];
        if (!before || !after) return false;
        if (before.granted !== after.granted) return true;
        // An expiry edit only matters while the role is actually held.
        return after.granted && before.expiresOn !== after.expiresOn;
      }),
    [saved, drafts],
  );

  const fullAccessChanges = changed.filter(isFullAccessRole);

  async function loadRoles(userId: string) {
    const requestId = ++rolesRequest.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/user-roles?user_id=${encodeURIComponent(userId)}`);
      const body = await res.json().catch(() => ({}));
      if (requestId !== rolesRequest.current) return;
      if (!res.ok) {
        toast.error("Could not load roles", body.error ?? `Request failed (${res.status})`);
        setRows([]);
        setDrafts(draftsFromRows([]));
        return;
      }
      const loaded: RoleRow[] = body.roles ?? [];
      setRows(loaded);
      setDrafts(draftsFromRows(loaded));
    } catch {
      if (requestId !== rolesRequest.current) return;
      toast.error("Could not load roles", "Network error — please try again");
      setRows([]);
      setDrafts(draftsFromRows([]));
    } finally {
      if (requestId === rolesRequest.current) setLoading(false);
    }
  }

  function selectUser(found: SearchUser) {
    if (saving) return;
    setHistoryRole(null);
    setReason("");
    setUser({ id: found.id, name: found.name, email: found.email ?? null });
    setRows([]);
    setDrafts({});
    void loadRoles(found.id);
  }

  function editDraft(role: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [role]: { ...prev[role], ...patch } }));
  }

  async function save() {
    if (!user || loading || saving || changed.length === 0) return;
    setSaving(true);
    const failed: string[] = [];
    try {
      // Sequential, not Promise.all: the API is per-role and a partial failure
      // must be reportable role by role.
      for (const role of changed) {
        const draft = drafts[role];
        const res = await fetch("/api/admin/user-roles", {
          method: draft.granted ? "POST" : "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            draft.granted
              ? {
                  user_id: user.id,
                  role,
                  expires_at: draft.expiresOn ? endOfDayIso(draft.expiresOn) : null,
                  comment: reason.trim() || null,
                }
              : { user_id: user.id, role, comment: reason.trim() || null },
          ),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          failed.push(`${role}: ${body.error ?? `failed (${res.status})`}`);
        }
      }
      const applied = changed.length - failed.length;
      if (failed.length === 0) {
        toast.success(`Saved ${applied} role ${applied === 1 ? "change" : "changes"}`);
      } else {
        toast.error(
          `${failed.length} of ${changed.length} changes failed`,
          failed.join(" · "),
        );
      }
      // Reload either way: the server decides what actually stuck.
      if (failed.length === 0) setReason("");
      await loadRoles(user.id);
    } catch {
      toast.error("Save failed", "Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Label className="mb-1.5 block">Find a user</Label>
        <UserSearchPicker
          scope="admin"
          placeholder="Search by name or email…"
          onSelect={selectUser}
          disabled={saving}
          autoFocus
        />
      </div>

      {user && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {user.name ?? "Unnamed user"}
              </div>
              <div className="truncate text-xs text-zinc-600 dark:text-zinc-400">
                {user.email ?? user.id}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { ++rolesRequest.current; setUser(null); setHistoryRole(null); }} disabled={saving}>
              Clear
            </Button>
          </div>

          {loading ? (
            <div className="px-4 py-6 text-sm text-zinc-600 dark:text-zinc-400">
              Loading roles…
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Held</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-48">Expires</TableHead>
                  <TableHead>Granted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ALL_ROLES.map((role) => {
                  const draft = drafts[role] ?? { granted: false, expiresOn: "" };
                  // Newest first, so [0] is the current or most recent episode.
                  const history = rows.filter((r) => r.role === role);
                  const row = history[0];
                  const isDirty = changed.includes(role);
                  return (
                    <TableRow
                      key={role}
                      className={isDirty ? "bg-amber-500/5" : undefined}
                    >
                      <TableCell className="align-top">
                        <Switch
                          checked={draft.granted}
                          disabled={saving}
                          onCheckedChange={(next) => editDraft(role, { granted: next })}
                          aria-label={role}
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="font-mono text-sm text-zinc-900 dark:text-zinc-100">
                          {role}
                        </div>
                        {/* team1_admin carries 7 grants — clamped to two lines
                            so one role cannot set the height of every row. */}
                        <div
                          className="mt-0.5 line-clamp-2 max-w-xl text-xs text-zinc-600 dark:text-zinc-400"
                          title={describeRole(role)}
                        >
                          {describeRole(role)}
                        </div>
                        {isFullAccessRole(role) && isDirty && (
                          <div className="mt-1 flex items-start gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                            {draft.granted
                              ? "Full platform access — every page, every event, every user's data."
                              : "Removing full platform access. They lose every admin area at once."}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          type="date"
                          className="w-40"
                          value={draft.expiresOn}
                          min={TODAY()}
                          disabled={!draft.granted || saving}
                          onChange={(e) => editDraft(role, { expiresOn: e.target.value })}
                          aria-label={`${role} expiry`}
                        />
                        {/* Only what the picker cannot show: an empty input is
                            ambiguous, a filled one already states the date, and
                            a lapsed grant is reported in the Granted column. */}
                        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                          {draft.granted && !draft.expiresOn && "Never expires"}
                        </div>
                      </TableCell>
                      <TableCell className="align-top text-xs text-zinc-500 dark:text-zinc-500">
                        {!row ? (
                          "—"
                        ) : (
                          <div className="flex items-start gap-1.5">
                            <span className={latestClass(row)}>{latestLine(row)}</span>
                            <button
                              type="button"
                              onClick={() => setHistoryRole(role)}
                              title={`Full history for ${role}`}
                              aria-label={`Full history for ${role}`}
                              className="mt-px rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                            >
                              <History className="size-3.5" />
                            </button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {fullAccessChanges.length > 0 && (
            <div className="flex items-start gap-2 border-t border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>
                <div className="font-medium">
                  {fullAccessChanges.join(", ")} grants unrestricted access
                </div>
                <div className="text-xs opacity-90">
                  Saving this changes who can administer the whole platform —
                  including granting roles on this page. Double-check the user
                  above before saving.
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <span className="text-xs text-zinc-600 dark:text-zinc-400">
              {changed.length === 0
                ? "No unsaved changes"
                : `${changed.length} unsaved ${changed.length === 1 ? "change" : "changes"}: ${changed.join(", ")}`}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={changed.length === 0 || saving}
                maxLength={500}
                placeholder="Reason (optional)"
                aria-label="Reason for these role changes"
                className="w-64"
              />
              <Button
                variant="ghost"
                size="sm"
                disabled={changed.length === 0 || saving}
                onClick={() => setDrafts(saved)}
              >
                Discard
              </Button>
              <Button size="sm" disabled={changed.length === 0 || loading || saving} onClick={() => void save()}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <HistoryDialog
        role={historyRole}
        episodes={historyRole ? rows.filter((r) => r.role === historyRole) : []}
        userLabel={user?.name ?? user?.email ?? "this user"}
        onClose={() => setHistoryRole(null)}
      />
    </div>
  );
}
