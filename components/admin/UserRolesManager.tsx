"use client";

import { useState } from "react";
import { UserSearchPicker, type SearchUser } from "@/components/common/UserSearchPicker";
import { ROLE_PERMISSIONS } from "@/lib/auth/rolePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/lib/toast";

type RoleRow = {
  id: string;
  role: string;
  expires_at: string | null;
  granted_by: string | null;
  active: boolean;
};

type SelectedUser = { id: string; name: string | null; email: string | null };

const ALL_ROLES = Object.keys(ROLE_PERMISSIONS).sort();

/** "event:manage (own), resource:manage, …" — what the role actually grants. */
function describeRole(role: string): string {
  return (ROLE_PERMISSIONS[role] ?? [])
    .map((p) => `${p.resource}:${p.action}${p.scope === "own" ? " (own)" : ""}`)
    .join(", ");
}

function formatExpiry(row: RoleRow): string | null {
  if (!row.expires_at) return null;
  const when = new Date(row.expires_at).toLocaleDateString();
  return row.active ? `expires ${when}` : `expired ${when}`;
}

export function UserRolesManager() {
  const [user, setUser] = useState<SelectedUser | null>(null);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  // "" = no expiry (permanent grant). Applied only when granting.
  const [expiresOn, setExpiresOn] = useState("");

  async function loadRoles(userId: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/user-roles?user_id=${encodeURIComponent(userId)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Could not load roles", body.error ?? `Request failed (${res.status})`);
        setRoles([]);
        return;
      }
      setRoles(body.roles ?? []);
    } catch {
      toast.error("Could not load roles", "Network error — please try again");
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }

  function selectUser(found: SearchUser) {
    setUser({ id: found.id, name: found.name, email: found.email ?? null });
    setRoles([]);
    void loadRoles(found.id);
  }

  async function toggleRole(role: string, grant: boolean) {
    if (!user) return;
    setSaving(role);
    try {
      // The API wants a future ISO instant; a date input gives a day, so the
      // grant runs to the end of that day in the admin's own timezone.
      const expires_at = expiresOn
        ? new Date(`${expiresOn}T23:59:59`).toISOString()
        : null;
      const res = await fetch("/api/admin/user-roles", {
        method: grant ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          grant ? { user_id: user.id, role, expires_at } : { user_id: user.id, role },
        ),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          grant ? "Could not grant role" : "Could not revoke role",
          body.error ?? `Request failed (${res.status})`,
        );
        return;
      }
      toast.success(grant ? `Granted ${role}` : `Revoked ${role}`);
      await loadRoles(user.id);
    } catch {
      toast.error("Request failed", "Network error — please try again");
    } finally {
      setSaving(null);
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
            <Button variant="ghost" size="sm" onClick={() => setUser(null)}>
              Clear
            </Button>
          </div>

          <div className="flex flex-wrap items-end gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div>
              <Label htmlFor="expires-on" className="mb-1.5 block text-xs">
                Expiry for new grants
              </Label>
              <Input
                id="expires-on"
                type="date"
                className="w-44"
                value={expiresOn}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setExpiresOn(e.target.value)}
              />
            </div>
            <p className="pb-2 text-xs text-zinc-600 dark:text-zinc-400">
              {expiresOn
                ? "Roles switched on below expire at the end of this day."
                : "Leave empty to grant permanently."}
            </p>
          </div>

          {loading ? (
            <div className="px-4 py-6 text-sm text-zinc-600 dark:text-zinc-400">
              Loading roles…
            </div>
          ) : (
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {ALL_ROLES.map((role) => {
                const held = roles.find((r) => r.role === role && r.active);
                const expiry = held ? formatExpiry(held) : null;
                return (
                  <li key={role} className="flex items-start gap-3 px-4 py-3">
                    <Switch
                      checked={!!held}
                      disabled={saving !== null}
                      onCheckedChange={(next) => void toggleRole(role, next)}
                      aria-label={role}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-mono text-sm text-zinc-900 dark:text-zinc-100">
                          {role}
                        </span>
                        {expiry && (
                          <span className="text-xs text-amber-700 dark:text-amber-400">
                            {expiry}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                        {describeRole(role)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
