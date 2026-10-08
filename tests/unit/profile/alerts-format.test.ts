import { describe, expect, it } from "vitest";
import type { ValidatorAlertResponse } from "@/types/validator-alerts";
import {
  alertMessageText,
  alertTypeLabel,
  alertTypeTone,
  buildAlertUpdate,
  buildCreateRequest,
  checksSummary,
  deliveryEmails,
  draftFromAlert,
  formatAlertDate,
  formatPercent,
  nodeName,
  recentAlerts,
  truncateMiddle,
} from "@/components/profile/sections/alerts-format";

const NODE = "NodeID-7Xhw2mDxuDS44j42TCB6U5579esbSt3Lg";
const SUBNET = "2uoDdh9FZi4HFDKQMYAztVXSYEwYkknvo9EZJfnQbYrVw8k75n";

function alert(over: Partial<ValidatorAlertResponse> = {}): ValidatorAlertResponse {
  return {
    id: "a1",
    user_id: "u1",
    node_id: NODE,
    subnet_id: "primary",
    label: null,
    uptime_alert: true,
    uptime_threshold: 95,
    version_alert: true,
    expiry_alert: true,
    expiry_days: 7,
    balance_alert: false,
    balance_threshold: 5_000_000_000,
    balance_threshold_days: 30,
    security_alert: false,
    last_known_ip: null,
    email: "ada@example.com",
    active: true,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
    alert_logs: [],
    ...over,
  };
}

const l1 = (over: Partial<ValidatorAlertResponse> = {}) =>
  alert({ subnet_id: SUBNET, uptime_alert: false, expiry_alert: false, balance_alert: true, ...over });

describe("truncateMiddle", () => {
  it("keeps the start and the end of a node id", () => {
    expect(truncateMiddle(NODE)).toBe("NodeID-7Xhw2m…St3Lg");
  });
  it("leaves a short value as it is", () => {
    expect(truncateMiddle("NodeID-abc")).toBe("NodeID-abc");
  });
});

describe("checksSummary", () => {
  it("lists the Primary Network checks that are on", () => {
    expect(checksSummary(alert({ security_alert: true }))).toBe(
      "Uptime below 95% · Version · Stake ends in 7 days · Security",
    );
  });
  it("shows a decimal threshold and a single day", () => {
    expect(checksSummary(alert({ uptime_threshold: 97.5, expiry_days: 1, version_alert: false }))).toBe(
      "Uptime below 97.5% · Stake ends in 1 day",
    );
  });
  it("lists only version and balance for an L1, whatever the other flags hold", () => {
    expect(checksSummary(l1({ uptime_alert: true, security_alert: true }))).toBe("Version · Balance 30 days");
  });
  it("says so when no check is on", () => {
    expect(checksSummary(alert({ uptime_alert: false, version_alert: false, expiry_alert: false }))).toBe(
      "No checks on",
    );
  });
});

describe("alert types", () => {
  it("names each known type in plain words", () => {
    expect(alertTypeLabel("uptime")).toBe("Low uptime");
    expect(alertTypeLabel("version_mandatory")).toBe("New version required");
    expect(alertTypeLabel("version_mandatory_critical")).toBe("New version required, critical");
    expect(alertTypeLabel("version_optional")).toBe("New version available");
    expect(alertTypeLabel("expiry_urgent")).toBe("Stake ends soon, urgent");
    expect(alertTypeLabel("balance_low_critical")).toBe("Low balance, critical");
    expect(alertTypeLabel("security_port_exposed")).toBe("Port 9650 is open");
  });
  it("reads an unknown type as its own words", () => {
    expect(alertTypeLabel("node_offline")).toBe("Node offline");
    expect(alertTypeLabel("")).toBe("Alert");
  });
  it("gives each type a tone", () => {
    expect(alertTypeTone("welcome")).toBe("ok");
    expect(alertTypeTone("expiry_critical")).toBe("error");
    expect(alertTypeTone("uptime")).toBe("error");
    expect(alertTypeTone("balance_low")).toBe("warn");
    expect(alertTypeTone("version_optional")).toBe("idle");
    expect(alertTypeTone("something_new")).toBe("idle");
  });
});

describe("alertMessageText", () => {
  // the stored log text is the email text of server/templates/validator-alerts.ts
  it("reads each dash of the templates as a comma", () => {
    expect(
      alertMessageText(
        "AvalancheGo v1.14.1 is available \u2014 this release may be mandatory, check release notes for details",
      ),
    ).toBe("AvalancheGo v1.14.1 is available, this release may be mandatory, check release notes for details");
    expect(alertMessageText("Deadline not yet announced \u2014 monitor release notes")).toBe(
      "Deadline not yet announced, monitor release notes",
    );
    expect(alertMessageText("A\u2014B")).toBe("A, B");
  });
  it("leaves a text with no dash as it is", () => {
    const text = "Validator Primary validator has uptime 87.2%, below your threshold of 90%.";
    expect(alertMessageText(text)).toBe(text);
    expect(alertMessageText("NodeID-7Xhw2m-x 5-10 days")).toBe("NodeID-7Xhw2m-x 5-10 days");
  });
});

describe("recentAlerts", () => {
  it("merges the logs of all alerts, newest first, up to the limit", () => {
    const a = alert({
      id: "a",
      label: "Main",
      alert_logs: [
        { id: "1", alert_type: "uptime", message: "m1", sent_at: "2026-10-03T10:00:00.000Z" },
        { id: "2", alert_type: "welcome", message: "m2", sent_at: "2026-10-01T10:00:00.000Z" },
      ],
    });
    const b = alert({
      id: "b",
      label: "  ",
      alert_logs: [{ id: "3", alert_type: "expiry", message: "m3", sent_at: "2026-10-02T10:00:00.000Z" }],
    });
    const out = recentAlerts([a, b], 2);
    expect(out.map((l) => l.id)).toEqual(["1", "3"]);
    expect(out[0].nodeName).toBe("Main");
    // a blank label falls back to the short node id
    expect(out[1].nodeName).toBe(truncateMiddle(NODE));
  });
  it("returns nothing when no alert has a log", () => {
    expect(recentAlerts([alert()])).toEqual([]);
  });
  it("names a node by its label", () => {
    expect(nodeName({ label: "Backup", node_id: NODE })).toBe("Backup");
  });
});

describe("deliveryEmails", () => {
  it("lists each address the alerts hold once", () => {
    expect(
      deliveryEmails([alert(), alert({ email: "ada@example.com" }), alert({ email: "old@example.com" })], "x@y.z"),
    ).toEqual(["ada@example.com", "old@example.com"]);
  });
  it("falls back to the account email", () => {
    expect(deliveryEmails([], " ada@example.com ")).toEqual(["ada@example.com"]);
    expect(deliveryEmails([], "")).toEqual([]);
  });
});

describe("formatAlertDate", () => {
  it("writes the date and time as the other profile sections do", () => {
    expect(formatAlertDate("2026-10-04T14:05:00.000Z", "UTC")).toBe("Oct 4, 2026, 2:05 PM");
    expect(formatAlertDate("2026-10-04T00:30:00.000Z", "UTC")).toBe("Oct 4, 2026, 12:30 AM");
  });
  it("returns nothing for a bad date", () => {
    expect(formatAlertDate("not a date")).toBe("");
  });
});

describe("buildCreateRequest", () => {
  it("sends the Primary Network when no L1 is given", () => {
    expect(buildCreateRequest({ nodeId: ` ${NODE} `, label: "", subnetId: "" })).toEqual({
      request: { node_id: NODE, subnet_id: "primary" },
    });
  });
  it("sends the L1 and the label", () => {
    expect(buildCreateRequest({ nodeId: NODE, label: " Main ", subnetId: SUBNET })).toEqual({
      request: { node_id: NODE, subnet_id: SUBNET, label: "Main" },
    });
  });
  it("rejects a bad node id or L1 id before the request", () => {
    expect(buildCreateRequest({ nodeId: "7Xhw2mDxuDS44j42TCB6U5579esbSt3Lg", label: "", subnetId: "" })).toHaveProperty(
      "error",
    );
    expect(buildCreateRequest({ nodeId: NODE, label: "", subnetId: "not-an-id" })).toEqual({
      error: "Enter a valid L1 ID, or leave the field empty.",
    });
  });
});

describe("buildAlertUpdate", () => {
  it("sends nothing when nothing changed", () => {
    const a = alert({ uptime_threshold: 97.55 });
    expect(buildAlertUpdate(a, draftFromAlert(a))).toEqual({ update: {}, error: null });
  });
  it("sends only the changed Primary Network fields", () => {
    const a = alert();
    const draft = { ...draftFromAlert(a), uptime_threshold: "97.5", security_alert: true, expiry_days: "14" };
    expect(buildAlertUpdate(a, draft)).toEqual({
      update: { uptime_threshold: 97.5, security_alert: true, expiry_days: 14 },
      error: null,
    });
  });
  it("never sends balance fields for the Primary Network", () => {
    const a = alert();
    const draft = { ...draftFromAlert(a), balance_alert: true, balance_threshold_days: "10" };
    expect(buildAlertUpdate(a, draft).update).toEqual({});
  });
  it("sends only balance and version for an L1", () => {
    const a = l1();
    const draft = {
      ...draftFromAlert(a),
      uptime_alert: true,
      expiry_alert: true,
      security_alert: true,
      version_alert: false,
      balance_threshold_days: "45",
    };
    expect(buildAlertUpdate(a, draft)).toEqual({
      update: { version_alert: false, balance_threshold_days: 45 },
      error: null,
    });
  });
  it("names the field that is out of range", () => {
    const a = alert();
    expect(buildAlertUpdate(a, { ...draftFromAlert(a), uptime_threshold: "40" }).error?.field).toBe("uptime_threshold");
    expect(buildAlertUpdate(a, { ...draftFromAlert(a), uptime_threshold: "" }).error?.field).toBe("uptime_threshold");
    expect(buildAlertUpdate(a, { ...draftFromAlert(a), expiry_days: "366" }).error?.field).toBe("expiry_days");
    expect(buildAlertUpdate(a, { ...draftFromAlert(a), expiry_days: "2.5" }).error?.field).toBe("expiry_days");
    const b = l1();
    expect(buildAlertUpdate(b, { ...draftFromAlert(b), balance_threshold_days: "0" }).error).toEqual({
      field: "balance_threshold_days",
      message: "Enter a whole number of days from 1 to 365.",
    });
  });
  it("skips the number of a check that is off", () => {
    const a = alert();
    // the input is disabled while the check is off, so its value cannot block a save
    expect(buildAlertUpdate(a, { ...draftFromAlert(a), uptime_alert: false, uptime_threshold: "" })).toEqual({
      update: { uptime_alert: false },
      error: null,
    });
    expect(buildAlertUpdate(a, { ...draftFromAlert(a), expiry_alert: false, expiry_days: "999" })).toEqual({
      update: { expiry_alert: false },
      error: null,
    });
    const b = l1();
    expect(buildAlertUpdate(b, { ...draftFromAlert(b), balance_alert: false, balance_threshold_days: "0" })).toEqual({
      update: { balance_alert: false },
      error: null,
    });
  });
  it("accepts the ends of each range", () => {
    const a = alert();
    expect(buildAlertUpdate(a, { ...draftFromAlert(a), uptime_threshold: "100", expiry_days: "365" })).toEqual({
      update: { uptime_threshold: 100, expiry_days: 365 },
      error: null,
    });
  });
});

describe("formatPercent", () => {
  it("drops a zero fraction", () => {
    expect(formatPercent(95)).toBe("95");
    expect(formatPercent(97.5)).toBe("97.5");
  });
});
