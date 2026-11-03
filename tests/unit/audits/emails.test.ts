import { describe, expect, it, vi, beforeEach } from "vitest";

const { sendMailMock } = vi.hoisted(() => ({ sendMailMock: vi.fn() }));
vi.mock("@/server/services/mail", () => ({ sendMail: sendMailMock }));

import { sendFanoutNotification } from "@/server/services/audits/emails/sendFanoutNotification";
import { sendAuditorInvite } from "@/server/services/audits/emails/sendAuditorInvite";
import { sendNotSelectedNotice } from "@/server/services/audits/emails/sendNotSelectedNotice";
import { sendQuoteAcceptedNotice } from "@/server/services/audits/emails/sendQuoteAcceptedNotice";
import { sendSubsidyDecisionNotice } from "@/server/services/audits/emails/sendSubsidyDecisionNotice";
import { sendTeamChangeNotice } from "@/server/services/audits/emails/sendTeamChangeNotice";
import { renderAuditEmail, type AuditEmailDetail } from "@/server/services/audits/emails/template";
import { sendApprovalNotice } from "@/server/services/audits/emails/sendApprovalNotice";
import { ownerRequestUrl } from "@/server/services/audits/emails/links";
import type { ApprovalNotice } from "@/server/services/audits/visibility";

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

  it("tells the firm how long its quote is held, to the minute: the project picks within a week", async () => {
    await sendFanoutNotification(AUDITOR, {
      ...REQUEST,
      quote_deadline: new Date("2026-11-10T23:59:59.999Z"),
    });

    expect(htmlOf()).toContain("closes 2026-11-10 23:59 UTC · project picks by 2026-11-17");
    expect(sendMailMock.mock.calls[0][3]).toContain("quotes close 2026-11-10 23:59 UTC");
  });

  it("names the grace day for a window that closes before 2026-10-23, at its stored time", async () => {
    await sendFanoutNotification(AUDITOR, REQUEST);

    expect(htmlOf()).toContain("closes 2026-08-09 12:00 UTC · project picks by 2026-10-30");
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

describe("sendTeamChangeNotice", () => {
  const base = {
    quoteEmail: "quotes@nordlicht.example",
    firmName: "Nordlicht Security",
    changedEmail: "bob@nordlicht.example",
    actorEmail: "alice@nordlicht.example",
  };

  it("notifies the quote email of an add, naming the address and the actor, no em dashes", async () => {
    await sendTeamChangeNotice({ ...base, change: "added" });

    const [to, html, subject, text] = sendMailMock.mock.calls[0] as [
      string,
      string,
      string,
      string,
    ];
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(to).toBe("quotes@nordlicht.example");
    expect(subject).toContain("added");
    for (const part of [html, text]) {
      expect(part).toContain("bob@nordlicht.example");
      expect(part).toContain("alice@nordlicht.example");
    }
    for (const part of [subject, html, text]) {
      expect(part).not.toContain("—");
    }
  });

  it("notifies the quote email of a removal in the removed variant", async () => {
    await sendTeamChangeNotice({ ...base, change: "removed" });

    const [to, , subject, text] = sendMailMock.mock.calls[0] as [string, string, string, string];
    expect(to).toBe("quotes@nordlicht.example");
    expect(subject).toContain("removed");
    expect(text).toContain("can no longer sign in");
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

  // Good news only (2026-10-20): the approval is the only variant left, and
  // it keeps every word.
  it("reads word for word for the project", async () => {
    await sendSubsidyDecisionNotice("owner@glacierswap.example", APPROVED);

    const [, html, subject, text] = sendMailMock.mock.calls[0] as string[];
    expect(subject).toBe("The audit program is covering $12,000 of «Glacierswap»");
    expect(text).toBe(
      [
        "The Ava Labs audit program approved a subsidy for Glacierswap.",
        "Program pays $12,000 (50% of the accepted quote). You pay $12,000.",
        "Payment is handled off-platform.",
        "Your request: https://build.avax.network/audits/req-1",
      ].join("\n"),
    );
    for (const line of [
      "Subsidy approved",
      "The program is covering $12,000.",
      "Payment is handled off-platform, on the terms in the accepted quote.",
      "Subsidy · Glacierswap",
      "Program pays",
      "50% of the accepted quote",
      "You pay",
      "Open your request",
      "Sent by the Ava Labs audit program · the full decision is on the request page.",
    ]) {
      expect(html).toContain(line);
    }
  });

  it("sends nothing for a decision that pays nothing, whatever the caller", async () => {
    await sendSubsidyDecisionNotice("owner@glacierswap.example", {
      ...APPROVED,
      program_amount_usd: 0,
      project_amount_usd: 24000,
      pct: 0,
    });

    expect(sendMailMock).not.toHaveBeenCalled();
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

  it("reads word for word for the firm", async () => {
    await sendSubsidyDecisionNotice("quotes@nordlicht.example", APPROVED, "auditor");

    const [, html, subject, text] = sendMailMock.mock.calls[0] as string[];
    expect(subject).toBe("The audit program is covering $12,000 of «Glacierswap»");
    expect(text).toBe(
      [
        "The Ava Labs audit program approved a subsidy toward your engagement with Glacierswap.",
        "Program covers $12,000 (50% of your accepted quote). The project covers $12,000.",
        "Payment is handled off-platform.",
        "Your request: https://build.avax.network/audits/portal/requests/req-1",
      ].join("\n"),
    );
    for (const line of [
      "Subsidy approved",
      "The program is covering $12,000.",
      "Payment is handled off-platform, on the terms in the accepted quote.",
      "Program covers",
      "Project covers",
      "Open the request",
      "Sent by the Ava Labs audit program · the full decision is on the request page.",
    ]) {
      expect(html).toContain(line);
    }
  });

  it("still sends the project wording when no audience is given", async () => {
    await sendSubsidyDecisionNotice("owner@glacierswap.example", APPROVED);

    const [, html] = sendMailMock.mock.calls[0] as string[];
    expect(html).toContain("You pay");
    expect(html).not.toContain("audits/portal");
  });
});

describe("renderAuditEmail · row links", () => {
  const withRows = (rows: AuditEmailDetail[]) =>
    renderAuditEmail({
      eyebrow: "Request approved",
      title: "Title",
      panel: { label: "GitHub usernames", rows },
      cta: { label: "Open", href: "https://build.avax.network/audits/req-1", variant: "primary" },
    });

  it("renders row links escaped once, splitting a username only when it cannot fit a line", () => {
    const html = withRows([
      {
        label: "Firm",
        value: "a",
        links: [{ label: "<b>a</b>", href: "https://github.com/a?b=1&c=2" }],
      },
    ]);

    expect(html).toMatch(
      /<a href="https:\/\/github\.com\/a\?b=1&amp;c=2" target="_blank" style="[^"]*display: inline-block; max-width: 100%; overflow-wrap: anywhere;[^"]*">&lt;b&gt;a&lt;\/b&gt;<\/a>/,
    );
    expect(html).not.toContain("white-space: nowrap");
    expect(html).not.toContain("<b>a</b>");
  });

  it("joins several links with a middle dot", () => {
    const html = withRows([
      {
        label: "Firm",
        value: "a · b",
        links: [
          { label: "a", href: "https://github.com/a" },
          { label: "b", href: "https://github.com/b" },
        ],
      },
    ]);

    expect(html).toContain(">a</a> · <a ");
  });

  it("renders the plain value of a row with no links, as before", () => {
    const html = withRows([
      { label: "Size", value: "~4,200 nSLOC" },
      { label: "Firm", value: "Nordlicht Security", links: [] },
    ]);

    expect(html).toContain("~4,200 nSLOC");
    expect(html).toContain("Nordlicht Security");
    expect(html).not.toContain('<a href="https://github.com');
  });
});

describe("sendApprovalNotice", () => {
  const notice = (over: Partial<ApprovalNotice> = {}): ApprovalNotice => ({
    email: "owner@glacierswap.example",
    request_id: "req-1",
    project_name: "Glacierswap",
    quote_deadline: new Date("2026-10-29T23:59:59.999Z"),
    pins_repository: true,
    shared_handle: false,
    shared_calendar: false,
    firms: [
      { id: "f", firm_name: "Foxline Security", github_usernames: [] },
      { id: "l", firm_name: "Ledgerproof Labs", github_usernames: ["ledgerproof-ops", "mira-lp"] },
      { id: "n", firm_name: "Nordlicht Security", github_usernames: ["nordlicht-sec", "alice-kv"] },
    ],
    ...over,
  });
  const sent = () => {
    const [to, html, subject, text] = sendMailMock.mock.calls[0] as string[];
    return { to, html, subject, text };
  };
  const WARNING =
    "Open each profile before you invite it: each person types their own username, and a typo would give a stranger access.";
  const LIMITS =
    "On a repository owned by your personal account, GitHub gives every collaborator write access. Read-only access needs a repository owned by an organization, where each outside collaborator takes a paid seat unless the organization is on the free plan. Invitations expire after 7 days.";
  const NONE_YET =
    "None of these firms has added a GitHub username yet. Any they add while quotes are open appear on your request page.";

  it("sends one email to the account address it is given", async () => {
    await sendApprovalNotice(notice());

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sent().to).toBe("owner@glacierswap.example");
  });

  it("announces the approval and asks for collaborators, in both repository variants", async () => {
    for (const firms of [
      notice().firms,
      notice().firms.map((firm) => ({ ...firm, github_usernames: [] })),
    ]) {
      sendMailMock.mockClear();
      await sendApprovalNotice(notice({ firms }));
      const { html } = sent();

      expect(html).toMatch(/color: #34D399;[^>]*>Request approved<\/p>/);
      expect(html).toContain(">«Glacierswap» is open for quotes.</h2>");
      expect(html).toContain(">GitHub usernames · for private repos</p>");
      expect(html).toContain(
        "The program team approved your request and sent it to the firms below. If a repository is private, add the firms you want quotes from as collaborators, so they can read the code before they quote.",
      );
    }
  });

  it("names the count in the subject and the meta line, singular and plural", async () => {
    await sendApprovalNotice(notice());
    expect(sent().subject).toBe("«Glacierswap» is open for quotes from 3 firms");
    expect(sent().html).toContain("3 firms · quotes close 2026-10-29 23:59 UTC");
    expect(sent().text).toContain("Quotes close 2026-10-29 at 23:59 UTC.");

    sendMailMock.mockClear();
    await sendApprovalNotice(notice({ firms: [notice().firms[1]] }));
    expect(sent().subject).toBe("«Glacierswap» is open for quotes from 1 firm");
    expect(sent().html).toContain("1 firm · quotes close 2026-10-29 23:59 UTC");
  });

  it("lists firms with usernames first, each linked to its profile, then the firms without one", async () => {
    await sendApprovalNotice(notice());
    const { html } = sent();

    expect(html).toContain(WARNING);
    expect(html).toContain('href="https://github.com/mira-lp"');
    expect(html).toContain('href="https://github.com/alice-kv"');
    const order = ["Ledgerproof Labs", "Nordlicht Security", "No username yet", "Foxline Security"].map(
      (part) => html.indexOf(part),
    );
    expect(order.every((index) => index > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toContain(LIMITS);
    expect(html).toContain(
      "Usernames that firms add later appear on your request page while quotes are open.",
    );
  });

  it("says so when no firm has a username yet (C14)", async () => {
    await sendApprovalNotice(
      notice({ firms: notice().firms.map((firm) => ({ ...firm, github_usernames: [] })) }),
    );
    const { html } = sent();

    expect(html).toContain(NONE_YET);
    expect(html).toMatch(
      />Firms<\/td><td[^>]*>Foxline Security · Ledgerproof Labs · Nordlicht Security</,
    );
    expect(html).not.toContain(WARNING);
    expect(html).not.toContain("github.com/");
    expect(html).toContain(LIMITS);
    expect(html).not.toContain("Usernames that firms add later");
  });

  it("sends the short version when the request pins no repository (decision g)", async () => {
    await sendApprovalNotice(notice({ pins_repository: false }));
    const { html, text } = sent();

    expect(html).toContain(
      "The program team approved your request. Quotes appear on your request page as they arrive.",
    );
    expect(html).not.toContain("GitHub usernames");
    expect(html).not.toContain("Ledgerproof Labs");
    expect(html).not.toContain(LIMITS);
    expect(text).not.toContain("github.com");
  });

  it("adds the shares line only when shared, in its three wordings", async () => {
    const cases: [Partial<ApprovalNotice>, string | null][] = [
      [
        { shared_handle: true },
        "You shared your Telegram handle with the firms: they may message you before they quote.",
      ],
      [
        { shared_calendar: true },
        "You shared your calendar link with the firms: they may book a call before they quote.",
      ],
      [
        { shared_handle: true, shared_calendar: true },
        "You shared your Telegram handle and calendar link with the firms: they may message you or book a call before they quote.",
      ],
      [{}, null],
    ];
    for (const [over, line] of cases) {
      for (const pins_repository of [true, false]) {
        sendMailMock.mockClear();
        await sendApprovalNotice(notice({ ...over, pins_repository }));
        const { html, text } = sent();
        if (line) {
          expect(html).toContain(line);
          expect(text).toContain(line);
        } else {
          expect(html).not.toContain("You shared your");
          expect(text).not.toContain("You shared your");
        }
      }
    }
  });

  it("points the CTA at the project's own request page", async () => {
    await sendApprovalNotice(notice());
    const { html, text } = sent();

    expect(html).toContain(`href="${ownerRequestUrl("req-1")}"`);
    expect(html).toContain(">Open your request</a>");
    expect(text).toContain(`Your request: ${ownerRequestUrl("req-1")}`);
  });

  it("neutralizes markup in the project and firm names", async () => {
    await sendApprovalNotice(
      notice({
        project_name: "<img src=x onerror=alert(1)>",
        firms: [{ id: "x", firm_name: "<b>Bad</b>", github_usernames: ["bad-firm"] }],
      }),
    );
    const { html } = sent();

    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<b>Bad</b>");
    expect(html).toContain("&lt;b&gt;Bad&lt;/b&gt;");
  });

  it("carries no email address and no em dash", async () => {
    for (const over of [{}, { pins_repository: false }, { shared_handle: true, shared_calendar: true }]) {
      sendMailMock.mockClear();
      await sendApprovalNotice(notice(over));
      const { html, subject, text } = sent();
      expect(html).not.toContain("@");
      expect(text).not.toContain("@");
      expect(`${subject}${html}${text}`).not.toMatch(/[—–]/);
    }
  });

  it("says the request was approved in the plain text too, in every variant (D3: the same facts)", async () => {
    const cases: [Partial<ApprovalNotice>, string][] = [
      [
        {},
        "The program team approved your request and sent it to the firms below. If a repository is private, add the firms you want quotes from as collaborators, so they can read the code before they quote.",
      ],
      [
        { firms: notice().firms.map((firm) => ({ ...firm, github_usernames: [] })) },
        "The program team approved your request and sent it to the firms below. If a repository is private, add the firms you want quotes from as collaborators, so they can read the code before they quote.",
      ],
      [
        { pins_repository: false },
        "The program team approved your request. Quotes appear on your request page as they arrive.",
      ],
    ];
    for (const [over, sentence] of cases) {
      sendMailMock.mockClear();
      await sendApprovalNotice(notice(over));
      expect(sent().text).toContain(sentence);
    }
  });

  it("puts every profile URL in the plain text", async () => {
    await sendApprovalNotice(notice());
    const { text } = sent();

    expect(text).toContain(
      "Ledgerproof Labs: ledgerproof-ops (https://github.com/ledgerproof-ops), mira-lp (https://github.com/mira-lp)",
    );
    expect(text).toContain("No username yet: Foxline Security");
  });
});

describe("sendFanoutNotification · private repos (step 2)", () => {
  it("says in the Repositories row that the project may add the firm's team", async () => {
    await sendFanoutNotification(AUDITOR, { ...REQUEST, repo_count: 2 });
    const html = htmlOf();

    expect(html).toContain("2 pinned · private ones: the project may add your team by GitHub username");
    expect(html).not.toContain("read access on acceptance");
  });
});
