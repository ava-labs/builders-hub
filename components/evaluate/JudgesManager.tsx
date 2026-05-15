"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UserSearchPicker, type SearchUser } from "@/components/common/UserSearchPicker";
import { Check, Loader2, Trash2, X } from "lucide-react";

type Judge = {
  id: string;
  assigned_at: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    user_name: string | null;
    custom_attributes: string[];
  };
};

type Props = {
  hackathonId: string;
  initialJudges: Judge[];
};

function initials(name: string | null, email: string | undefined): string {
  const source = name ?? email ?? "?";
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function JudgesManager({ hackathonId, initialJudges }: Props) {
  const [judges, setJudges] = useState<Judge[]>(initialJudges);
  const [pendingUser, setPendingUser] = useState<SearchUser | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const excludedIds = judges.map((j) => j.user.id);

  async function confirmAssignment() {
    if (!pendingUser) return;
    setError(null);
    setConfirming(true);
    setConfirmed(false);
    const userToAssign = pendingUser;
    try {
      const res = await fetch(`/api/events/${hackathonId}/judges`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: userToAssign.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? `Failed to assign (${res.status})`);
        return;
      }
      const { judge } = (await res.json()) as { judge: Judge };
      setJudges((prev) => {
        if (prev.some((j) => j.user.id === judge.user.id)) return prev;
        return [...prev, judge];
      });
      setConfirmed(true);
      setTimeout(() => {
        setConfirmed(false);
        setPendingUser(null);
      }, 1500);
    } finally {
      setConfirming(false);
    }
  }

  async function removeJudge(userId: string) {
    setError(null);
    const previous = judges;
    setJudges((prev) => prev.filter((j) => j.user.id !== userId));
    const res = await fetch(`/api/events/${hackathonId}/judges/${userId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setJudges(previous);
      const body = await res.json().catch(() => ({}));
      setError(body?.error ?? `Failed to remove (${res.status})`);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Assign a new judge
        </h2>
        <p className="mt-1 mb-3 text-xs text-zinc-600 dark:text-zinc-500">
          Search by name or email. The user must already have a Builder Hub account.
        </p>

        {!pendingUser ? (
          <UserSearchPicker
            scope="admin"
            onSelect={(user) => {
              setError(null);
              setPendingUser(user);
            }}
            excludeUserIds={excludedIds}
            placeholder="Search Builder Hub users…"
          />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-3">
              <Avatar className="size-10">
                {pendingUser.image && (
                  <AvatarImage
                    src={pendingUser.image}
                    alt={pendingUser.name ?? pendingUser.email}
                  />
                )}
                <AvatarFallback>
                  {initials(pendingUser.name, pendingUser.email)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {pendingUser.name ?? pendingUser.user_name ?? pendingUser.email}
                </div>
                <div className="truncate text-xs text-zinc-600 dark:text-zinc-500">
                  {pendingUser.email}
                </div>
              </div>
              {pendingUser.custom_attributes && pendingUser.custom_attributes.length > 0 && (
                <div className="flex shrink-0 gap-1">
                  {pendingUser.custom_attributes.slice(0, 2).map((attr) => (
                    <span
                      key={attr}
                      className="rounded bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-700 dark:text-zinc-400"
                    >
                      {attr}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPendingUser(null);
                  setError(null);
                }}
                disabled={confirming || confirmed}
              >
                <X className="size-4" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => void confirmAssignment()}
                disabled={confirming || confirmed}
                className={confirmed ? "bg-green-600 hover:bg-green-600" : ""}
              >
                {confirming ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : confirmed ? (
                  <Check className="size-4" />
                ) : (
                  <Check className="size-4" />
                )}
                {confirming ? "Assigning..." : confirmed ? "Assigned!" : "Confirm assignment"}
              </Button>
            </div>
          </div>
        )}

        {error && <p className="mt-2 text-xs text-red-500 dark:text-red-400">{error}</p>}
      </Card>

      <Card className="p-6">
        <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Current judges{" "}
          <span className="text-zinc-500 dark:text-zinc-500">({judges.length})</span>
        </h2>
        {judges.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-500">
            No judges assigned yet.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
            {judges.map((judge) => (
              <li
                key={judge.id}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <Avatar className="size-9">
                  {judge.user.image && (
                    <AvatarImage
                      src={judge.user.image}
                      alt={judge.user.name ?? judge.user.email}
                    />
                  )}
                  <AvatarFallback>
                    {initials(judge.user.name, judge.user.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {judge.user.name ?? judge.user.user_name ?? judge.user.email}
                  </div>
                  <div className="truncate text-xs text-zinc-600 dark:text-zinc-500">
                    {judge.user.email}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeJudge(judge.user.id)}
                  aria-label={`Remove ${judge.user.name ?? judge.user.email}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
