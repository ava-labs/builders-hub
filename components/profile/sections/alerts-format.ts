import type {
  AlertLogResponse,
  CreateAlertRequest,
  UpdateAlertRequest,
  ValidatorAlertResponse,
} from "@/types/validator-alerts";
import { formatMoment } from "./format";

/* Pure helpers for the Alerts section: names, summaries, the recent-alert
   feed, and the request bodies. The ranges match the checks in
   app/api/validator-alerts/route.ts and [id]/route.ts, so a body built here
   passes the server. */

export const PRIMARY_SUBNET = "primary";

/** the server's NodeID check */
export const NODE_ID_PATTERN = /^NodeID-[A-HJ-NP-Za-km-z1-9]{33,}$/;

/** a CB58 id: base58 characters only */
const SUBNET_ID_PATTERN = /^[A-HJ-NP-Za-km-z1-9]{40,60}$/;

/** the server accepts 0 to 100; below 50 is noise, so the form starts at 50 */
export const UPTIME_RANGE = { min: 50, max: 100 } as const;
export const EXPIRY_DAYS_RANGE = { min: 1, max: 365 } as const;
export const BALANCE_DAYS_RANGE = { min: 1, max: 365 } as const;

type AlertLike = Pick<
  ValidatorAlertResponse,
  | "subnet_id"
  | "uptime_alert"
  | "uptime_threshold"
  | "version_alert"
  | "expiry_alert"
  | "expiry_days"
  | "balance_alert"
  | "balance_threshold_days"
  | "security_alert"
>;

export function isL1Alert(alert: Pick<ValidatorAlertResponse, "subnet_id">): boolean {
  return alert.subnet_id !== PRIMARY_SUBNET;
}

/** keeps the start and the end of a long id: NodeID-7Xhw2m...St3Lg */
export function truncateMiddle(value: string, head = 13, tail = 5): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/** 95 is "95", 97.5 is "97.5" */
export function formatPercent(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/** the checks that are on, in one mono line */
export function checksSummary(alert: AlertLike): string {
  const l1 = isL1Alert(alert);
  const parts: string[] = [];
  if (!l1 && alert.uptime_alert) parts.push(`Uptime below ${formatPercent(alert.uptime_threshold)}%`);
  if (alert.version_alert) parts.push("Version");
  if (!l1 && alert.expiry_alert) {
    parts.push(`Stake ends in ${alert.expiry_days} ${alert.expiry_days === 1 ? "day" : "days"}`);
  }
  if (l1 && alert.balance_alert) {
    const days = alert.balance_threshold_days;
    parts.push(`Balance ${days} ${days === 1 ? "day" : "days"}`);
  }
  if (!l1 && alert.security_alert) parts.push("Security");
  return parts.length > 0 ? parts.join(" · ") : "No checks on";
}

/* ------------------------------------------------------------------ */
/* Alert log types (AlertType in types/validator-alerts.ts)             */

const TYPE_LABELS: Record<string, string> = {
  uptime: "Low uptime",
  version_mandatory: "New version required",
  version_mandatory_urgent: "New version required, urgent",
  version_mandatory_critical: "New version required, critical",
  version_optional: "New version available",
  expiry: "Stake ends soon",
  expiry_urgent: "Stake ends soon, urgent",
  expiry_critical: "Stake ends soon, critical",
  balance_low: "Low balance",
  balance_low_urgent: "Low balance, urgent",
  balance_critical: "Low balance, critical",
  balance_low_critical: "Low balance, critical",
  security_port_exposed: "Port 9650 is open",
  security_ip_changed: "IP address changed",
  check_failed: "Check failed",
  welcome: "Welcome",
};

/** a stored log text without the dashes of the email templates: "available \u2014 this" reads "available, this" */
export function alertMessageText(message: string): string {
  return message.replace(/\s*\u2014\s*/g, ", ");
}

/** the alert type in plain words; an unknown type reads as its own words */
export function alertTypeLabel(type: string): string {
  const known = TYPE_LABELS[type];
  if (known) return known;
  const words = type.replace(/_/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Alert";
}

export type AlertTone = "ok" | "error" | "warn" | "idle";

/** the status mark of a log entry: red for action now, amber for action soon */
export function alertTypeTone(type: string): AlertTone {
  if (type === "welcome") return "ok";
  if (type === "version_optional" || type === "check_failed") return "idle";
  if (type === "uptime" || type === "security_port_exposed" || type.endsWith("_urgent") || type.endsWith("_critical")) {
    return "error";
  }
  if (type in TYPE_LABELS) return "warn";
  return "idle";
}

/* ------------------------------------------------------------------ */
/* Feeds                                                                */

export type RecentAlert = AlertLogResponse & { alertId: string; nodeName: string };

/** the name a person gave the node, else its shortened id */
export function nodeName(alert: Pick<ValidatorAlertResponse, "label" | "node_id">): string {
  return alert.label?.trim() || truncateMiddle(alert.node_id);
}

/** the newest log entries across all alerts */
export function recentAlerts(
  alerts: ReadonlyArray<Pick<ValidatorAlertResponse, "id" | "label" | "node_id" | "alert_logs">>,
  limit = 10,
): RecentAlert[] {
  return alerts
    .flatMap((a) => (a.alert_logs ?? []).map((log) => ({ ...log, alertId: a.id, nodeName: nodeName(a) })))
    .sort((x, y) => Date.parse(y.sent_at) - Date.parse(x.sent_at))
    .slice(0, limit);
}

/** where alerts go: each address the alerts hold, else the account email */
export function deliveryEmails(
  alerts: ReadonlyArray<Pick<ValidatorAlertResponse, "email">>,
  accountEmail: string,
): string[] {
  const seen = [...new Set(alerts.map((a) => a.email?.trim()).filter((e): e is string => Boolean(e)))];
  if (seen.length > 0) return seen;
  return accountEmail.trim() ? [accountEmail.trim()] : [];
}

/** a log time, in the viewer's time zone, as every profile section writes it */
export function formatAlertDate(iso: string, timeZone?: string): string {
  return formatMoment(iso, timeZone);
}

/* ------------------------------------------------------------------ */
/* Request bodies                                                       */

export type NewAlertInput = { nodeId: string; label: string; subnetId: string };

/** the POST body, or the reason the form cannot send it */
export function buildCreateRequest(input: NewAlertInput): { request: CreateAlertRequest } | { error: string } {
  const nodeId = input.nodeId.trim();
  if (!NODE_ID_PATTERN.test(nodeId)) {
    return { error: "Enter a valid node ID. It starts with NodeID-." };
  }
  const subnetId = input.subnetId.trim();
  if (subnetId && !SUBNET_ID_PATTERN.test(subnetId)) {
    return { error: "Enter a valid L1 ID, or leave the field empty." };
  }
  const label = input.label.trim();
  return {
    request: {
      node_id: nodeId,
      // an explicit "primary" skips the server's slow search of every L1
      subnet_id: subnetId || PRIMARY_SUBNET,
      ...(label ? { label } : {}),
    },
  };
}

/** the settings form: numbers stay text while the person types */
export type AlertDraft = {
  uptime_alert: boolean;
  uptime_threshold: string;
  version_alert: boolean;
  expiry_alert: boolean;
  expiry_days: string;
  balance_alert: boolean;
  balance_threshold_days: string;
  security_alert: boolean;
};

export function draftFromAlert(alert: AlertLike): AlertDraft {
  return {
    uptime_alert: alert.uptime_alert,
    uptime_threshold: formatPercent(alert.uptime_threshold),
    version_alert: alert.version_alert,
    expiry_alert: alert.expiry_alert,
    expiry_days: String(alert.expiry_days),
    balance_alert: alert.balance_alert,
    balance_threshold_days: String(alert.balance_threshold_days),
    security_alert: alert.security_alert,
  };
}

function parseNumber(raw: string): number {
  return raw.trim() === "" ? Number.NaN : Number(raw);
}

function inRange(value: number, range: { min: number; max: number }, integer: boolean): boolean {
  return Number.isFinite(value) && value >= range.min && value <= range.max && (!integer || Number.isInteger(value));
}

export type DraftNumberField = "uptime_threshold" | "expiry_days" | "balance_threshold_days";
export type DraftError = { field: DraftNumberField; message: string };

/**
 * The PUT body with only the fields that changed. It holds only the fields
 * the server accepts for the alert's network: uptime, expiry and security
 * for the Primary Network, balance for an L1. The number of a check that is
 * off is skipped: the form disables its input, so a bad value there could
 * not be corrected.
 */
export function buildAlertUpdate(
  alert: AlertLike,
  draft: AlertDraft,
): { update: UpdateAlertRequest; error: DraftError | null } {
  const update: UpdateAlertRequest = {};
  const l1 = isL1Alert(alert);
  const daysError = (field: DraftNumberField, range: { min: number; max: number }): DraftError => ({
    field,
    message: `Enter a whole number of days from ${range.min} to ${range.max}.`,
  });

  if (draft.version_alert !== alert.version_alert) update.version_alert = draft.version_alert;

  if (!l1) {
    if (draft.uptime_alert !== alert.uptime_alert) update.uptime_alert = draft.uptime_alert;
    const uptime = parseNumber(draft.uptime_threshold);
    // compare with the value as the form shows it, so an untouched field never counts as a change
    if (draft.uptime_alert && uptime !== Number(formatPercent(alert.uptime_threshold))) {
      if (!inRange(uptime, UPTIME_RANGE, false)) {
        return {
          update,
          error: {
            field: "uptime_threshold",
            message: `Enter an uptime from ${UPTIME_RANGE.min} to ${UPTIME_RANGE.max}.`,
          },
        };
      }
      update.uptime_threshold = uptime;
    }
    if (draft.expiry_alert !== alert.expiry_alert) update.expiry_alert = draft.expiry_alert;
    const expiry = parseNumber(draft.expiry_days);
    if (draft.expiry_alert && expiry !== alert.expiry_days) {
      if (!inRange(expiry, EXPIRY_DAYS_RANGE, true))
        return { update, error: daysError("expiry_days", EXPIRY_DAYS_RANGE) };
      update.expiry_days = expiry;
    }
    if (draft.security_alert !== alert.security_alert) update.security_alert = draft.security_alert;
  } else {
    if (draft.balance_alert !== alert.balance_alert) update.balance_alert = draft.balance_alert;
    const days = parseNumber(draft.balance_threshold_days);
    if (draft.balance_alert && days !== alert.balance_threshold_days) {
      if (!inRange(days, BALANCE_DAYS_RANGE, true)) {
        return { update, error: daysError("balance_threshold_days", BALANCE_DAYS_RANGE) };
      }
      update.balance_threshold_days = days;
    }
  }

  return { update, error: null };
}
