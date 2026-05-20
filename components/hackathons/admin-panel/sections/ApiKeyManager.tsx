"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ApiKeyRow {
  id: string;
  label: string;
  prefix: string;
  created_at: string;
  created_by: string;
  revoked_at: string | null;
  last_used_at: string | null;
}

interface ApiKeyManagerProps {
  hackathonId: string;
}

export default function ApiKeyManager({ hackathonId }: ApiKeyManagerProps) {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);
  // Set once after a successful create. Shows the plaintext secret exactly once.
  const [justCreated, setJustCreated] = useState<{ id: string; label: string; secret: string } | null>(null);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`/api/admin/api-keys?hackathon_id=${hackathonId}`);
      setKeys(res.data.keys ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? "Failed to load keys");
    } finally {
      setLoading(false);
    }
  }, [hackathonId]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async () => {
    if (!newLabel.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await axios.post("/api/admin/api-keys", {
        label: newLabel.trim(),
        hackathon_id: hackathonId,
      });
      const key = res.data.key;
      setJustCreated({ id: key.id, label: key.label, secret: key.secret });
      setNewLabel("");
      await fetchKeys();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? "Failed to create key");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Revoke this key? Existing callers will start receiving 401.")) return;
    try {
      await axios.delete(`/api/admin/api-keys/${id}`);
      await fetchKeys();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? "Failed to revoke key");
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2 rounded-md border border-zinc-200 dark:border-zinc-800 p-4">
        <h3 className="font-medium">Create a new key</h3>
        <p className="text-sm text-zinc-500">
          Scoped to this hackathon. The secret will be shown exactly once.
        </p>
        <div className="flex gap-2">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Partner / Judge name (e.g. Team1 India)"
            className="max-w-md"
          />
          <Button
            type="button"
            variant="red"
            onClick={handleCreate}
            disabled={creating || !newLabel.trim()}
          >
            {creating ? "Creating…" : "Create key"}
          </Button>
        </div>
        {justCreated && (
          <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="text-sm font-medium mb-1">
              New key for "{justCreated.label}" — copy this now, it won't be shown again:
            </p>
            <code className="block break-all text-sm bg-zinc-900 text-amber-200 px-3 py-2 rounded">
              {justCreated.secret}
            </code>
            <Button
              type="button"
              variant="outline"
              className="mt-2"
              onClick={() => setJustCreated(null)}
            >
              Dismiss
            </Button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-zinc-400">Loading…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-zinc-800">
            <thead className="bg-zinc-900">
              <tr>
                <th className="px-3 py-2 text-left">Label</th>
                <th className="px-3 py-2 text-left">Prefix</th>
                <th className="px-3 py-2 text-left">Created</th>
                <th className="px-3 py-2 text-left">Last used</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-zinc-500">
                    No keys yet.
                  </td>
                </tr>
              )}
              {keys.map((k) => {
                const revoked = !!k.revoked_at;
                return (
                  <tr key={k.id} className="border-t border-zinc-800">
                    <td className="px-3 py-2">{k.label}</td>
                    <td className="px-3 py-2 font-mono text-xs">{k.prefix}…</td>
                    <td className="px-3 py-2 text-zinc-400">
                      {new Date(k.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">
                      {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {revoked ? (
                        <span className="text-zinc-500">Revoked</span>
                      ) : (
                        <span className="text-green-500">Active</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!revoked && (
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-red-500"
                          onClick={() => handleRevoke(k.id)}
                        >
                          Revoke
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
