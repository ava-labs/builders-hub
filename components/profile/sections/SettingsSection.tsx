"use client";

import * as React from "react";
import { toast as sonnerToast } from "sonner";
import { Button, ErrorLine, Group, Row, SectionHeader, Stack, Switch } from "../ui";

type ConsentField = "notifications" | "consent_sharing";

const CONSENTS: ReadonlyArray<{ field: ConsentField; title: string; description: string }> = [
  {
    field: "notifications",
    title: "Avalanche news",
    description: "Get newsletters and promotional email from the Avalanche Foundation. You can stop them at any time.",
  },
  {
    field: "consent_sharing",
    title: "Contact from Team1",
    description:
      "Share your contact details with Avalanche Team1. Team1 can then contact you about local events, mentorship and regional programs.",
  },
];

/* Each switch saves at once (PATCH), as account settings do: there is no
   form to submit here. The Personal info form never sends these fields, so
   a later save there cannot undo a change made here. */
export function SettingsSection({ userId, email, onSignOut }: { userId: string | null; email: string; onSignOut: () => void }) {
  const [values, setValues] = React.useState<Record<ConsentField, boolean> | null>(null);
  const [failed, setFailed] = React.useState(false);
  // a ref, not a disabled switch: disabling the focused switch drops the keyboard focus
  const busy = React.useRef<ConsentField | null>(null);

  const load = React.useCallback(() => {
    if (!userId) return;
    setFailed(false);
    fetch(`/api/profile/extended/${userId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((p) => setValues({ notifications: Boolean(p.notifications), consent_sharing: Boolean(p.consent_sharing) }))
      .catch(() => setFailed(true));
  }, [userId]);

  React.useEffect(load, [load]);

  const toggle = async (field: ConsentField, next: boolean) => {
    if (!userId || !values || busy.current) return;
    busy.current = field;
    const before = values[field];
    setValues({ ...values, [field]: next });
    try {
      const res = await fetch(`/api/profile/extended/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      sonnerToast.success("Setting saved");
    } catch {
      sonnerToast.error("Could not save the setting");
      setValues((v) => (v ? { ...v, [field]: before } : v));
    } finally {
      busy.current = null;
    }
  };

  return (
    <>
      <SectionHeader eyebrow="Account" title="Settings" id="section-title" />
      <Stack>
        <Group label="Sign-in">
          <Row label="Email">
            <span className="font-mono text-[13px] text-zinc-900 [overflow-wrap:anywhere] dark:text-zinc-100">{email}</span>
          </Row>
          <Row label="Session">
            <Button variant="danger" onClick={onSignOut}>
              Sign out
            </Button>
          </Row>
        </Group>

        <Group label="Email preferences">
          {failed ? (
            <ErrorLine onRetry={load}>Could not load your settings.</ErrorLine>
          ) : (
            CONSENTS.map((c) => {
              const id = `pr-consent-${c.field}`;
              return (
                <div key={c.field} className="flex items-center justify-between gap-6 px-4 py-4 sm:px-5">
                  <label htmlFor={id} className="min-w-0 cursor-pointer">
                    <span className="block text-[14px] font-medium text-zinc-900 dark:text-zinc-100">{c.title}</span>
                    <span className="mt-0.5 block text-[13px] text-zinc-500 dark:text-zinc-400">{c.description}</span>
                  </label>
                  <Switch
                    id={id}
                    checked={values?.[c.field] ?? false}
                    disabled={!values}
                    onChange={(next) => void toggle(c.field, next)}
                  />
                </div>
              );
            })
          )}
        </Group>
      </Stack>
    </>
  );
}
