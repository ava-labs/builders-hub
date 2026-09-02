import { describe, expect, it, vi, beforeEach } from "vitest";

const { sendMailMock } = vi.hoisted(() => ({ sendMailMock: vi.fn() }));
vi.mock("@/server/services/mail", () => ({ sendMail: sendMailMock }));

import { sendFanoutNotification } from "@/server/services/audits/emails/sendFanoutNotification";
import { sendAuditorInvite } from "@/server/services/audits/emails/sendAuditorInvite";
import { sendNotSelectedNotice } from "@/server/services/audits/emails/sendNotSelectedNotice";
import { sendQuoteAcceptedNotice } from "@/server/services/audits/emails/sendQuoteAcceptedNotice";
import { sendSubsidyDecisionNotice } from "@/server/services/audits/emails/sendSubsidyDecisionNotice";

const AUDITOR = { firm_name: "Nordlicht Security", quote_email: "quotes@nordlicht.example" };
const REQUEST = {
  id: "req-1",
  project_name: "Glacierswap",
  quote_deadline: new Date("2026-08-09T12:00:00Z"),
  services: ["Smart contract audit (Solidity / Vyper)"],
  nsloc: 4200,
};

// html is the 2nd arg of sendMail(email, html, subject, text)
const htmlOf = () => sendMailMock.mock.calls[0][1] as string;

beforeEach(() => {
  sendMailMock.mockReset();
  sendMailMock.mockResolvedValue(undefined);
});

describe("sendFanoutNotification", () => {
  it("sends to the quote email and every approved teammate", async () => {
    await sendFanoutNotification(
      { ...AUDITOR, members: [{ email: "alice@nordlicht.example" }] },
      REQUEST,
    );

    expect(sendMailMock).toHaveBeenCalledTimes(2);
    expect(sendMailMock.mock.calls.map((call) => call[0])).toEqual([
      "quotes@nordlicht.example",
      "alice@nordlicht.example",
    ]);
  });

  it("still reaches a firm loaded without members at its quote email only", async () => {
    await sendFanoutNotification(AUDITOR, REQUEST);

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock.mock.calls[0][0]).toBe("quotes@nordlicht.example");
  });

  it("neutralizes markup in the project name", async () => {
    await sendFanoutNotification(AUDITOR, {
      ...REQUEST,
      project_name: '<img src=x onerror=alert(1)>',
    });

    const html = htmlOf();
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("links to the auditor portal with a fixed https CTA", async () => {
    await sendFanoutNotification(AUDITOR, REQUEST);

    expect(htmlOf()).toContain('href="https://build.avax.network/audits/portal"');
  });

  it("carries the project name in subject and plain text, with no em dashes anywhere", async () => {
    await sendFanoutNotification(AUDITOR, REQUEST);

    const [, html, subject, text] = sendMailMock.mock.calls[0] as [string, string, string, string];
    expect(subject).toContain("Glacierswap");
    expect(text).toContain("Glacierswap");
    expect(subject).not.toContain("—");
    expect(html).not.toContain("—");
    expect(text).not.toContain("—");
  });
});

describe("sendNotSelectedNotice", () => {
  it("tells the losing firm plainly: no reason, no competitor info, no prices", async () => {
    await sendNotSelectedNotice(AUDITOR, { project_name: "Glacierswap" });

    const [to, html, subject, text] = sendMailMock.mock.calls[0] as [
      string,
      string,
      string,
      string,
    ];
    expect(to).toBe("quotes@nordlicht.example");
    expect(subject).toContain("Glacierswap");
    // No amounts, no winner identity, no em dashes.
    for (const part of [subject, html, text]) {
      expect(part).not.toContain("$");
      expect(part).not.toContain("—");
    }
  });

  it("neutralizes markup in the project name", async () => {
    await sendNotSelectedNotice(AUDITOR, { project_name: "<script>x()</script>" });

    expect(htmlOf()).not.toContain("<script>");
    expect(htmlOf()).toContain("&lt;script&gt;");
  });
});

describe("sendAuditorInvite", () => {
  it("sends the sign-in instruction to the exact address being invited", async () => {
    await sendAuditorInvite({ firm_name: AUDITOR.firm_name, email: AUDITOR.quote_email });

    expect(sendMailMock.mock.calls[0][0]).toBe("quotes@nordlicht.example");
    expect(htmlOf()).toContain('href="https://build.avax.network/audits/portal"');
  });

  it("neutralizes markup in the firm name and avoids em dashes", async () => {
    await sendAuditorInvite({ firm_name: "<b>Evil</b> Firm", email: AUDITOR.quote_email });

    const [, html, subject, text] = sendMailMock.mock.calls[0] as [string, string, string, string];
    expect(html).not.toContain("<b>Evil</b>");
    expect(html).toContain("&lt;b&gt;Evil&lt;/b&gt;");
    expect(subject).not.toContain("—");
    expect(html).not.toContain("—");
    expect(text).not.toContain("—");
  });
});

describe("sendQuoteAcceptedNotice", () => {
  it("sends to the winning firm with a deep link into the portal request", async () => {
    await sendQuoteAcceptedNotice(AUDITOR, { id: "req-1", project_name: "Glacierswap" });

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock.mock.calls[0][0]).toBe("quotes@nordlicht.example");
    expect(htmlOf()).toContain('href="https://build.avax.network/audits/portal/requests/req-1"');
  });

  it("neutralizes markup in the project name and avoids em dashes", async () => {
    await sendQuoteAcceptedNotice(AUDITOR, {
      id: "req-1",
      project_name: "<b>Pwn</b> Markets",
    });

    const [, html, subject, text] = sendMailMock.mock.calls[0] as string[];
    expect(html).not.toContain("<b>Pwn</b>");
    expect(html).toContain("&lt;b&gt;Pwn&lt;/b&gt;");
    for (const part of [subject, html, text]) {
      expect(part).not.toContain("—");
    }
  });

  it("carries no contact data, only the portal pointer", async () => {
    await sendQuoteAcceptedNotice(AUDITOR, { id: "req-1", project_name: "Glacierswap" });

    const [, html, , text] = sendMailMock.mock.calls[0] as string[];
    for (const part of [html, text]) {
      expect(part).toContain("audits/portal");
      expect(part).not.toContain("@glacierswap");
    }
  });
});

describe("sendSubsidyDecisionNotice", () => {
  const APPROVED = {
    request_id: "req-1",
    project_name: "Glacierswap",
    state: "approved" as const,
    program_amount_usd: 12000,
    project_amount_usd: 12000,
    pct: 50,
  };

  it("goes to the address the caller resolved, never to request input", async () => {
    await sendSubsidyDecisionNotice("owner@glacierswap.example", APPROVED);

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock.mock.calls[0][0]).toBe("owner@glacierswap.example");
  });

  it("states the split and points at the project's OWN request page", async () => {
    await sendSubsidyDecisionNotice("owner@glacierswap.example", APPROVED);

    const [, html, subject, text] = sendMailMock.mock.calls[0] as string[];
    expect(subject).toContain("$12,000");
    for (const part of [html, text]) {
      expect(part).toContain("$12,000");
      expect(part).toContain("50%");
      expect(part).toContain("/audits/req-1");
      // The requester never lands in the auditor portal.
      expect(part).not.toContain("audits/portal");
    }
  });

  it("carries NO amounts when the subsidy was declined", async () => {
    await sendSubsidyDecisionNotice("owner@glacierswap.example", {
      ...APPROVED,
      state: "declined",
      program_amount_usd: 0,
      project_amount_usd: 24000,
      pct: 0,
    });

    const [, html, subject, text] = sendMailMock.mock.calls[0] as string[];
    for (const part of [subject, html, text]) {
      expect(part).not.toContain("$");
      expect(part).not.toContain("—");
    }
    // It must still say the engagement is unaffected, which is the whole point.
    expect(text).toContain("the audit goes ahead");
  });

  it("never names the deciding admin", async () => {
    await sendSubsidyDecisionNotice("owner@glacierswap.example", APPROVED);

    const [, html, , text] = sendMailMock.mock.calls[0] as string[];
    for (const part of [html, text]) {
      expect(part).not.toContain("Federico");
      expect(part).not.toContain("decided_by");
    }
  });

  it("neutralizes markup in the project name", async () => {
    await sendSubsidyDecisionNotice("owner@glacierswap.example", {
      ...APPROVED,
      project_name: "<b>Pwn</b> Markets",
    });

    const [, html] = sendMailMock.mock.calls[0] as string[];
    expect(html).not.toContain("<b>Pwn</b>");
    expect(html).toContain("&lt;b&gt;Pwn&lt;/b&gt;");
  });
});

describe("sendSubsidyDecisionNotice · auditor audience", () => {
  const APPROVED = {
    request_id: "req-1",
    project_name: "Glacierswap",
    state: "approved" as const,
    program_amount_usd: 12000,
    project_amount_usd: 12000,
    pct: 50,
  };

  it("carries the same figures as the project's copy", async () => {
    await sendSubsidyDecisionNotice("quotes@nordlicht.example", APPROVED, "auditor");

    const [to, html, subject, text] = sendMailMock.mock.calls[0] as string[];
    expect(to).toBe("quotes@nordlicht.example");
    expect(subject).toContain("$12,000");
    for (const part of [html, text]) {
      expect(part).toContain("$12,000");
      expect(part).toContain("50%");
    }
  });

  it("never tells a firm that IT pays, and links to the portal not the requester page", async () => {
    await sendSubsidyDecisionNotice("quotes@nordlicht.example", APPROVED, "auditor");

    const [, html, , text] = sendMailMock.mock.calls[0] as string[];
    for (const part of [html, text]) {
      expect(part).not.toContain("You pay");
      expect(part).toContain("audits/portal/requests/req-1");
    }
  });

  it("reassures the firm on a decline, with no amounts", async () => {
    await sendSubsidyDecisionNotice(
      "quotes@nordlicht.example",
      { ...APPROVED, state: "declined", program_amount_usd: 0, project_amount_usd: 24000, pct: 0 },
      "auditor",
    );

    const [, html, subject, text] = sendMailMock.mock.calls[0] as string[];
    for (const part of [subject, html, text]) {
      expect(part).not.toContain("$");
    }
    expect(text).toContain("payment terms with the project stand");
  });

  it("still sends the project wording when no audience is given", async () => {
    await sendSubsidyDecisionNotice("owner@glacierswap.example", APPROVED);

    const [, html] = sendMailMock.mock.calls[0] as string[];
    expect(html).toContain("You pay");
    expect(html).not.toContain("audits/portal");
  });
});
