"use client";

import * as React from "react";
import { Bell } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast as sonnerToast } from "sonner";

type ConsentField = "notifications" | "consent_sharing";

interface ConsentDef {
  field: ConsentField;
  title: string;
  description: string;
}

const CONSENTS: ReadonlyArray<ConsentDef> = [
  {
    field: "notifications",
    title: "Receive Avalanche news and updates",
    description:
      "Subscribe to Avalanche Foundation newsletters and promotional materials. You can opt out anytime.",
  },
  {
    field: "consent_sharing",
    title: "Allow Team1 to contact me",
    description:
      "Share your contact info with Avalanche Team1 so they can reach out for local support or invite you to regional initiatives.",
  },
];

export function SettingsCard() {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;

  const [loading, setLoading] = React.useState(true);
  const [savingField, setSavingField] = React.useState<ConsentField | null>(null);
  const [values, setValues] = React.useState<Record<ConsentField, boolean>>({
    notifications: false,
    consent_sharing: false,
  });

  React.useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setLoading(false);
      return;
    }
    fetch(`/api/profile/extended/${userId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((profile) => {
        if (cancelled) return;
        setValues({
          notifications: Boolean(profile.notifications),
          consent_sharing: Boolean(profile.consent_sharing),
        });
      })
      .catch((err) => console.error("[SettingsCard] load failed:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleToggle = async (field: ConsentField, next: boolean) => {
    if (!userId) return;
    const previous = values[field];
    setValues((prev) => ({ ...prev, [field]: next }));
    setSavingField(field);
    try {
      const res = await fetch(`/api/profile/extended/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      sonnerToast.success("Preferences saved");
    } catch (err) {
      console.error("[SettingsCard] save failed:", err);
      sonnerToast.error("Could not save preferences");
      setValues((prev) => ({ ...prev, [field]: previous }));
    } finally {
      setSavingField(null);
    }
  };

  return (
    <div className="pr-card">
      <div className="pr-head">
        <div className="pr-ico">
          <Bell size={18} />
        </div>
        <div>
          <h3>Privacy &amp; Communications</h3>
          <div className="pr-desc">
            Control how Avalanche communicates with you and what we can share.
          </div>
        </div>
      </div>

      <div className="pr-body pr-consent-list">
        {CONSENTS.map((consent) => {
          const checked = values[consent.field];
          const isSaving = savingField === consent.field;
          return (
            <div className="pr-consent-row" key={consent.field}>
              <div className="pr-consent-row__text">
                <strong>{consent.title}</strong>
                <p>{consent.description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={consent.title}
                disabled={loading || isSaving}
                onClick={() => handleToggle(consent.field, !checked)}
                className={`pr-switch${checked ? " pr-switch--on" : ""}${
                  loading || isSaving ? " pr-switch--disabled" : ""
                }`}
              >
                <span className="pr-switch__thumb" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
