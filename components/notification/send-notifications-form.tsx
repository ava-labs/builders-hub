/**
 * SendNotificationsForm — redesigned notifications composer.
 *
 * Sits inside the redesigned profile page (DevRel-only tab). Two-column
 * layout: compose on the left, live preview on the right. Theme-aware via
 * tailwind `dark:` variants so it tracks the Builder Hub light/dark toggle.
 *
 * No outer card chrome — meant to render flush inside its parent container.
 *
 * Total builder count for the "All" audience comes in as the `totalBuilders`
 * prop (fetched server-side via /api/profile/summary). Falls back to a
 * conservative floor when not provided.
 */

"use client";

import { useMemo, useState } from "react";
import {
  Mail,
  MessageSquare,
  GraduationCap,
  Globe,
  Rocket,
  Search,
  AlertTriangle,
  Check,
  Copy,
  Send,
  Loader2,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { useGetHackathons } from "@/hooks/use-get-hackathons";
import { sendNotifications } from "@/utils/send-notification";
import type { Notification } from "@/types/notifications";

// ──────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────

type NotificationTypeValue = "message" | "courseCompleted";
type ContentTypeValue = "text/plain" | "text/markdown" | "text/html";
type AudienceMode = "all" | "hackathons" | "custom";

const NOTIFICATION_TYPES: {
  value: NotificationTypeValue;
  label: string;
  desc: string;
  icon: typeof Mail;
}[] = [
  {
    value: "message",
    label: "Message",
    desc: "General announcement or update",
    icon: MessageSquare,
  },
  {
    value: "courseCompleted",
    label: "Course completed",
    desc: "Sent when a user finishes a course",
    icon: GraduationCap,
  },
];

const CONTENT_TYPES: { value: ContentTypeValue; label: string }[] = [
  { value: "text/plain", label: "Plain" },
  { value: "text/markdown", label: "Markdown" },
  { value: "text/html", label: "HTML" },
];

const TOTAL_USERS_FALLBACK = 16000;

// Common class fragments — keeps light/dark variants close together so
// future tweaks don't require chasing classes across the file.
const SURFACE_BG = "bg-white dark:bg-zinc-950";
const ELEV_BG = "bg-zinc-50 dark:bg-zinc-900";
const SUNK_BG = "bg-zinc-100 dark:bg-zinc-900";
const LINE = "border-zinc-200 dark:border-zinc-800";
const FG = "text-zinc-900 dark:text-zinc-100";
const FG_MUTED = "text-zinc-500 dark:text-zinc-500";
const FG_DIM = "text-zinc-600 dark:text-zinc-400";

// ──────────────────────────────────────────────────────────────────────────
// Tiny inline markdown renderer (no extra deps).
// ──────────────────────────────────────────────────────────────────────────
function renderMarkdown(src: string): string {
  let html = (src || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^### (.*$)/gm, "<h4>$1</h4>")
    .replace(/^## (.*$)/gm, "<h3>$1</h3>")
    .replace(/^# (.*$)/gm, "<h2>$1</h2>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|\s)\*(.+?)\*/g, "$1<em>$2</em>")
    .replace(/`([^`]+?)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+?)\]\(([^)]+?)\)/g, '<a href="$2">$1</a>')
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => "<ul>" + m + "</ul>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br/>");
  if (!html.startsWith("<")) html = "<p>" + html + "</p>";
  return html;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Draft {
  title: string;
  short_description: string;
  type: NotificationTypeValue | "";
  content_type: ContentTypeValue;
  content: string;
  audience: AudienceMode;
  hackathons: string[];
  customEmailsRaw: string;
}

const INITIAL_DRAFT: Draft = {
  title: "",
  short_description: "",
  type: "message",
  content_type: "text/markdown",
  content: "",
  audience: "custom",
  hackathons: [],
  customEmailsRaw: "",
};

interface SendNotificationsFormProps {
  /** Total builder count for the "All" audience copy. Falls back to a
      conservative floor if not provided. */
  totalBuilders?: number;
}

export default function SendNotificationsForm({
  totalBuilders,
}: SendNotificationsFormProps = {}) {
  const { toast } = useToast();
  const { data: hackathons } = useGetHackathons();
  const TOTAL_BUILDERS =
    typeof totalBuilders === "number" && totalBuilders > 0
      ? totalBuilders
      : TOTAL_USERS_FALLBACK;

  const [draft, setDraft] = useState<Draft>(INITIAL_DRAFT);
  const [hackQ, setHackQ] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (patch: Partial<Draft>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const parsedEmails = useMemo<string[]>(() => {
    return draft.customEmailsRaw
      .split(/[\s,;\n]+/)
      .map((s) => s.trim())
      .filter((s) => EMAIL_RE.test(s));
  }, [draft.customEmailsRaw]);

  const filteredHacks = useMemo(() => {
    const q = hackQ.toLowerCase().trim();
    return (hackathons ?? []).filter((h: { id: string; title: string }) =>
      q ? h.title.toLowerCase().includes(q) : true,
    );
  }, [hackathons, hackQ]);

  const audienceCount =
    draft.audience === "all"
      ? TOTAL_BUILDERS
      : draft.audience === "hackathons"
        ? draft.hackathons.length
        : parsedEmails.length;

  const audienceLabel =
    draft.audience === "all"
      ? `All builders · ${TOTAL_BUILDERS.toLocaleString()}`
      : draft.audience === "hackathons"
        ? `${draft.hackathons.length} hackathon${
            draft.hackathons.length !== 1 ? "s" : ""
          } selected`
        : `${parsedEmails.length} email${parsedEmails.length !== 1 ? "s" : ""}`;

  const validation: { key: string; label: string; ok: boolean }[] = [
    { key: "title", label: "Title", ok: !!draft.title.trim() },
    { key: "desc", label: "Description", ok: !!draft.short_description.trim() },
    { key: "type", label: "Type", ok: !!draft.type },
    { key: "content", label: "Content", ok: !!draft.content.trim() },
    {
      key: "audience",
      label: "Audience",
      ok:
        draft.audience === "all" ||
        (draft.audience === "hackathons" && draft.hackathons.length > 0) ||
        (draft.audience === "custom" && parsedEmails.length > 0),
    },
  ];
  const missing = validation.filter((v) => !v.ok);
  const isValid = missing.length === 0;

  const toggleHackathon = (id: string) =>
    update({
      hackathons: draft.hackathons.includes(id)
        ? draft.hackathons.filter((x) => x !== id)
        : [...draft.hackathons, id],
    });

  const buildPayload = (): Notification[] => [
    {
      audience: {
        all: draft.audience === "all",
        hackathons: draft.audience === "hackathons" ? draft.hackathons : [],
        users: draft.audience === "custom" ? parsedEmails : [],
      },
      type: draft.type || "message",
      title: draft.title,
      short_description: draft.short_description,
      content: draft.content,
      content_type: draft.content_type,
    },
  ];

  const handleSend = async () => {
    if (!isValid) return;
    setLoading(true);
    const res = await sendNotifications(buildPayload());
    setLoading(false);
    toast({
      title: res.success ? "Notification sent" : "Failed to send notification",
      description: res.success
        ? `Delivered to ${audienceCount.toLocaleString()} ${
            draft.audience === "custom" ? "users" : "recipients"
          }.`
        : res.error || "Please try again.",
    });
    if (res.success) setDraft(INITIAL_DRAFT);
  };

  return (
    <>
      <Toaster />
      <div>
        <header
          className={`pb-5 mb-1 border-b ${LINE}`}
          style={{
            position: "relative",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            paddingRight: 110, // reserve room for the absolutely-positioned DevRel pill
          }}
        >
          <span
            aria-hidden
            style={{
              width: 36,
              height: 36,
              flexShrink: 0,
              borderRadius: 10,
              background: "rgba(232, 65, 66, 0.15)",
              color: "#E84142",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Mail size={18} strokeWidth={2} />
          </span>
          <div
            style={{
              minWidth: 0,
              flex: "0 1 auto",
              textAlign: "left",
              display: "block",
            }}
          >
            <h2
              className={`text-base font-medium ${FG}`}
              style={{
                margin: 0,
                padding: 0,
                textAlign: "left",
                textIndent: 0,
                lineHeight: 1.25,
              }}
            >
              Send notifications
            </h2>
            <p
              className={`text-sm ${FG_MUTED}`}
              style={{
                margin: 0,
                marginTop: 2,
                padding: 0,
                textAlign: "left",
                textIndent: 0,
                lineHeight: 1.35,
              }}
            >
              Compose and broadcast to all builders, hackathon cohorts, or a
              custom email list.
            </p>
          </div>
          <span
            className="text-[11px] font-medium"
            style={{
              position: "absolute",
              top: "50%",
              right: 0,
              transform: "translateY(-50%)",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 8px",
              borderRadius: 999,
              background: "rgba(232, 65, 66, 0.12)",
              color: "#E84142",
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#E84142",
              }}
            />
            DevRel only
          </span>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          {/* ─── COMPOSE ─── */}
          <section className={`py-6 pr-6 flex flex-col gap-5 lg:border-r ${LINE} min-w-0`}>
            <SectionLabel>Message</SectionLabel>

            <Field
              label="Title"
              required
              hint="The headline recipients see first."
              counter={`${draft.title.length}/80`}
            >
              <Input
                value={draft.title}
                maxLength={80}
                onChange={(e) => update({ title: e.target.value })}
                placeholder="e.g. New hackathon: LatAm 2026 registration open"
              />
            </Field>

            <Field
              label="Short description"
              hint="Shown under the title in toasts and emails."
              counter={`${draft.short_description.length}/140`}
            >
              <Input
                value={draft.short_description}
                maxLength={140}
                onChange={(e) => update({ short_description: e.target.value })}
                placeholder="One-line subtitle"
              />
            </Field>

            <Field label="Notification type">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {NOTIFICATION_TYPES.map((t) => {
                  const on = draft.type === t.value;
                  const TIcon = t.icon;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => update({ type: t.value })}
                      className={[
                        "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                        on
                          ? "border-[#E84142] bg-[#E84142]/8 dark:bg-[#E84142]/12"
                          : `${LINE} ${ELEV_BG} hover:border-zinc-400 dark:hover:border-zinc-700`,
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "size-7 rounded-md grid place-items-center shrink-0",
                          on
                            ? "bg-[#E84142] text-white"
                            : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300",
                        ].join(" ")}
                      >
                        <TIcon className="size-[14px]" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className={`block text-sm font-medium ${FG}`}>
                          {t.label}
                        </span>
                        <span className={`block text-[11px] ${FG_MUTED} leading-tight mt-0.5`}>
                          {t.desc}
                        </span>
                      </span>
                      <span
                        className={[
                          "size-[18px] rounded-full border-[1.5px] grid place-items-center shrink-0",
                          on
                            ? "bg-[#E84142] border-[#E84142] text-white"
                            : "border-zinc-400 dark:border-zinc-600 text-transparent",
                        ].join(" ")}
                      >
                        <Check className="size-2.5" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field
              label="Content"
              required
              hint={
                draft.content_type === "text/markdown"
                  ? "Markdown supported · **bold**, *italic*, [links](url), - lists"
                  : draft.content_type === "text/html"
                    ? "Raw HTML — sanitized server-side."
                    : "Plain text only."
              }
              counter={`${draft.content.length} chars`}
              header={
                <Segmented
                  value={draft.content_type}
                  onChange={(v) =>
                    update({ content_type: v as ContentTypeValue })
                  }
                  options={CONTENT_TYPES}
                />
              }
            >
              <Textarea
                value={draft.content}
                onChange={(e) => update({ content: e.target.value })}
                placeholder={
                  draft.content_type === "text/markdown"
                    ? "**Hey builder!** We just opened registration for [LatAm 2026](https://…)."
                    : draft.content_type === "text/html"
                      ? "<p><strong>Hey builder!</strong> Registration is open.</p>"
                      : "Hey builder! Registration is open. Sign up before March 1."
                }
                className="min-h-[140px] font-mono text-[13px] leading-relaxed"
              />
            </Field>

            <SectionLabel>Audience</SectionLabel>

            <div>
              <div className={`grid grid-cols-3 gap-1.5 p-1 rounded-lg ${ELEV_BG} border ${LINE} mb-3`}>
                <AudienceTab
                  active={draft.audience === "all"}
                  onClick={() => update({ audience: "all" })}
                  icon={<Globe className="size-[13px]" />}
                  label="All builders"
                  pill={TOTAL_BUILDERS.toLocaleString()}
                />
                <AudienceTab
                  active={draft.audience === "hackathons"}
                  onClick={() => update({ audience: "hackathons" })}
                  icon={<Rocket className="size-[13px]" />}
                  label="Hackathons"
                  pill={
                    draft.hackathons.length > 0
                      ? String(draft.hackathons.length)
                      : undefined
                  }
                />
                <AudienceTab
                  active={draft.audience === "custom"}
                  onClick={() => update({ audience: "custom" })}
                  icon={<MessageSquare className="size-[13px]" />}
                  label="Custom emails"
                  pill={
                    parsedEmails.length > 0
                      ? String(parsedEmails.length)
                      : undefined
                  }
                />
              </div>

              {draft.audience === "all" && (
                <div className={`flex items-center gap-3 rounded-lg border ${LINE} ${ELEV_BG} p-3`}>
                  <Globe className="size-[22px] text-[#E84142] shrink-0" />
                  <div>
                    <div className={`text-sm font-medium ${FG}`}>
                      Broadcast to every builder
                    </div>
                    <div className={`text-[12px] ${FG_MUTED} mt-0.5`}>
                      {TOTAL_BUILDERS.toLocaleString()} active accounts will
                      receive this notification. Use sparingly.
                    </div>
                  </div>
                </div>
              )}

              {draft.audience === "hackathons" && (
                <div className={`flex flex-col gap-2.5 rounded-lg border ${LINE} ${ELEV_BG} p-3`}>
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-md ${SURFACE_BG} border ${LINE}`}>
                    <Search className={`size-[13px] ${FG_MUTED}`} />
                    <input
                      value={hackQ}
                      onChange={(e) => setHackQ(e.target.value)}
                      placeholder="Search hackathons…"
                      className={`flex-1 bg-transparent outline-none text-[13px] ${FG} placeholder:text-zinc-400 dark:placeholder:text-zinc-600`}
                    />
                    <span className={`font-mono text-[10px] ${FG_MUTED}`}>
                      {filteredHacks.length} / {(hackathons ?? []).length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 max-h-[200px] overflow-auto">
                    {filteredHacks.map((h: { id: string; title: string }) => {
                      const on = draft.hackathons.includes(h.id);
                      return (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => toggleHackathon(h.id)}
                          className={[
                            "flex items-center gap-3 px-2.5 py-2 rounded-md text-left transition-colors",
                            on
                              ? "bg-[#E84142]/8 dark:bg-[#E84142]/12"
                              : "hover:bg-zinc-100 dark:hover:bg-zinc-800",
                          ].join(" ")}
                        >
                          <span
                            className={[
                              "size-[18px] rounded-[5px] border-[1.5px] grid place-items-center shrink-0",
                              on
                                ? "bg-[#E84142] border-[#E84142] text-white"
                                : "border-zinc-400 dark:border-zinc-600 text-transparent",
                            ].join(" ")}
                          >
                            <Check className="size-2.5" />
                          </span>
                          <span className={`flex-1 text-[13px] ${FG} truncate`}>
                            {h.title}
                          </span>
                        </button>
                      );
                    })}
                    {filteredHacks.length === 0 && (
                      <div className={`text-center text-[12px] ${FG_MUTED} py-6`}>
                        No hackathons match “{hackQ}”.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {draft.audience === "custom" && (
                <div className={`flex flex-col gap-2.5 rounded-lg border ${LINE} ${ELEV_BG} p-3`}>
                  <Textarea
                    value={draft.customEmailsRaw}
                    onChange={(e) => update({ customEmailsRaw: e.target.value })}
                    placeholder={
                      "alice@example.com, bob@example.com\nor paste a list — commas, spaces, or newlines all work"
                    }
                    className="min-h-[96px] font-mono text-[12px]"
                  />
                  <div className={`flex flex-wrap items-center gap-2.5 text-[12px] ${FG_DIM}`}>
                    <span
                      className={[
                        "size-2 rounded-full",
                        parsedEmails.length > 0
                          ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]"
                          : "bg-zinc-300 dark:bg-zinc-600",
                      ].join(" ")}
                    />
                    <span>
                      <b className={`${FG} font-medium`}>
                        {parsedEmails.length}
                      </b>{" "}
                      valid email{parsedEmails.length !== 1 ? "s" : ""} detected
                    </span>
                    {parsedEmails.length > 0 && (
                      <span className="flex flex-wrap gap-1 ml-auto">
                        {parsedEmails.slice(0, 3).map((e) => (
                          <span
                            key={e}
                            className={`px-2 h-5 inline-flex items-center rounded-full ${SUNK_BG} text-[11px] ${FG_DIM}`}
                          >
                            {e}
                          </span>
                        ))}
                        {parsedEmails.length > 3 && (
                          <span className={`px-2 h-5 inline-flex items-center rounded-full ${SUNK_BG} text-[11px] ${FG_DIM}`}>
                            +{parsedEmails.length - 3} more
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ─── PREVIEW ─── */}
          <NotificationPreview draft={draft} audienceLabel={audienceLabel} />
        </div>

        {/* Footer */}
        <footer className={`flex flex-wrap items-center gap-4 py-4 mt-2 border-t ${LINE}`}>
          <div className="flex-1 min-w-0 flex flex-wrap items-baseline gap-2.5">
            <span className="text-[26px] font-medium text-[#E84142] tabular-nums leading-none tracking-tight">
              {audienceCount.toLocaleString()}
            </span>
            <span className={`text-[12.5px] ${FG_DIM}`}>
              {draft.audience === "all"
                ? "builders will receive this"
                : draft.audience === "hackathons"
                  ? "hackathons selected"
                  : "emails on the list"}
            </span>
            {missing.length > 0 && (
              <div className="basis-full flex items-center gap-1.5 mt-1 text-[11.5px] text-amber-600 dark:text-amber-400 font-mono">
                <AlertTriangle className="size-3" />
                Missing: {missing.map((m) => m.label.toLowerCase()).join(", ")}
              </div>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Copy className="size-[13px]" /> Save draft
            </Button>
            <Button
              onClick={handleSend}
              disabled={!isValid || loading}
              size="sm"
              className="min-w-[140px] gap-1.5 bg-[#E84142] hover:bg-[#E84142]/90 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="size-[14px] animate-spin" /> Sending…
                </>
              ) : (
                <>
                  <Send className="size-[13px]" /> Send notification
                </>
              )}
            </Button>
          </div>
        </footer>
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Subcomponents
// ──────────────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className={`font-mono text-[10px] uppercase tracking-[0.08em] ${FG_MUTED} pb-1.5 border-b ${LINE}`}>
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  counter,
  header,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  counter?: string;
  header?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[13px] font-medium text-zinc-800 dark:text-zinc-200">
          {label}
          {required && <span className="text-[#E84142] ml-0.5">*</span>}
        </label>
        {header}
      </div>
      {children}
      {(hint || counter) && (
        <div className={`flex items-center justify-between text-[11px] ${FG_MUTED}`}>
          <span>{hint}</span>
          {counter && <span className="font-mono">{counter}</span>}
        </div>
      )}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className={`inline-flex p-[3px] rounded-md ${ELEV_BG} border ${LINE}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={[
            "px-2.5 py-1 text-[11.5px] font-medium rounded transition-colors",
            value === o.value
              ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200",
          ].join(" ")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function AudienceTab({
  active,
  onClick,
  icon,
  label,
  pill,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  pill?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-md text-[12.5px] font-medium transition-colors",
        active
          ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm"
          : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200",
      ].join(" ")}
    >
      {icon}
      {label}
      {pill && (
        <span
          className={[
            "font-mono text-[10px] px-1.5 py-px rounded-full ml-0.5",
            active
              ? "bg-[#E84142] text-white"
              : "bg-[#E84142]/15 text-[#E84142]",
          ].join(" ")}
        >
          {pill}
        </span>
      )}
    </button>
  );
}

function NotificationPreview({
  draft,
  audienceLabel,
}: {
  draft: Draft;
  audienceLabel: string;
}) {
  const type = NOTIFICATION_TYPES.find((t) => t.value === draft.type);
  const TIcon = type?.icon ?? MessageSquare;
  const body = draft.content || "";
  const empty = !draft.title && !draft.short_description && !body;

  const bodyHtml =
    draft.content_type === "text/markdown"
      ? renderMarkdown(body)
      : draft.content_type === "text/html"
        ? body
        : "";

  return (
    <aside className="py-6 lg:pl-6 flex flex-col gap-3.5 min-w-0">
      <div className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] ${FG_MUTED}`}>
        <Globe className="size-2.5" /> Preview · in-app
      </div>

      <div className={`rounded-xl border ${LINE} ${SURFACE_BG} overflow-hidden shadow-[0_8px_24px_-12px_rgba(0,0,0,0.18)] dark:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]`}>
        <div className={`flex items-center gap-1.5 px-3 py-2 ${ELEV_BG} border-b ${LINE}`}>
          <span className="size-2 rounded-full bg-zinc-300 dark:bg-zinc-700" />
          <span className="size-2 rounded-full bg-zinc-300 dark:bg-zinc-700" />
          <span className="size-2 rounded-full bg-zinc-300 dark:bg-zinc-700" />
          <span className={`ml-2 font-mono text-[10px] ${FG_MUTED} truncate`}>
            avax.network/dashboard
          </span>
        </div>
        <div className="p-[18px] min-h-[180px] flex items-start">
          {empty ? (
            <div className={`m-auto flex flex-col items-center gap-2.5 text-center text-[12px] ${FG_MUTED} max-w-[220px] leading-snug`}>
              <Mail className="size-7" />
              <div>
                Fill in the form to see how your notification will appear.
              </div>
            </div>
          ) : (
            <div className={`w-full rounded-[10px] border ${LINE} ${ELEV_BG} p-3.5 flex flex-col gap-2`}>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#E84142]/12 dark:bg-[#E84142]/18 text-[#E84142] text-[10.5px] font-medium">
                  <TIcon className="size-2.5" />
                  {type?.label ?? "Notification"}
                </span>
                <span className={`font-mono text-[10px] ${FG_MUTED}`}>
                  just now
                </span>
              </div>
              <div className={`text-[14px] font-medium tracking-[-0.005em] ${FG}`}>
                {draft.title || "Untitled notification"}
              </div>
              {draft.short_description && (
                <div className={`text-[12.5px] ${FG_DIM} leading-snug`}>
                  {draft.short_description}
                </div>
              )}
              <div className="text-[12.5px] text-zinc-800 dark:text-zinc-200 leading-relaxed pt-1 mt-0.5 border-t border-dashed border-zinc-200 dark:border-zinc-800 preview-body">
                {draft.content_type === "text/plain" ? (
                  <pre className="font-mono text-[12px] whitespace-pre-wrap m-0">
                    {body}
                  </pre>
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
                )}
              </div>
              <div className="flex gap-1.5 mt-1">
                <button className="px-2.5 py-1 rounded-md bg-[#E84142] text-white text-[11px] font-medium">
                  View
                </button>
                <button className={`px-2.5 py-1 rounded-md ${FG_MUTED} text-[11px]`}>
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={`rounded-lg border ${LINE} ${SURFACE_BG} px-3.5 py-2.5 flex flex-col gap-1.5`}>
        <PreviewMetaRow k="Audience" v={audienceLabel} />
        <PreviewMetaRow k="Format" v={draft.content_type} />
        <PreviewMetaRow k="Body length" v={`${body.length} chars`} mono />
      </div>

      <style jsx>{`
        .preview-body :global(p) {
          margin: 0 0 6px;
        }
        .preview-body :global(h2) {
          font-size: 14px;
          font-weight: 500;
          margin: 6px 0 4px;
        }
        .preview-body :global(h3) {
          font-size: 13px;
          font-weight: 500;
          margin: 6px 0 4px;
        }
        .preview-body :global(h4) {
          font-size: 12.5px;
          font-weight: 500;
          margin: 4px 0;
        }
        .preview-body :global(strong) {
          font-weight: 600;
        }
        .preview-body :global(em) {
          font-style: italic;
        }
        .preview-body :global(code) {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 11.5px;
          background: rgba(0, 0, 0, 0.06);
          padding: 1px 5px;
          border-radius: 4px;
        }
        :global(.dark) .preview-body :global(code) {
          background: #27272a;
        }
        .preview-body :global(a) {
          color: #e84142;
          text-decoration: underline;
        }
        .preview-body :global(ul) {
          margin: 4px 0 6px;
          padding-left: 18px;
        }
        .preview-body :global(li) {
          margin: 2px 0;
        }
      `}</style>
    </aside>
  );
}

function PreviewMetaRow({
  k,
  v,
  mono,
}: {
  k: string;
  v: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={`font-mono text-[10px] uppercase tracking-[0.06em] ${FG_MUTED}`}>
        {k}
      </span>
      <span
        className={[
          "text-[12px] font-medium text-zinc-900 dark:text-zinc-100 text-right",
          mono ? "font-mono" : "",
        ].join(" ")}
      >
        {v}
      </span>
    </div>
  );
}
