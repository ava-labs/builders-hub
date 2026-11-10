import { sendMail } from "@/server/services/mail";
import { renderAuditEmail, type AuditEmailDetail } from "@/server/services/audits/emails/template";
import { ownerRequestUrl } from "@/server/services/audits/emails/links";
import { GITHUB_ACCESS_LIMITS, GITHUB_PROFILE_WARNING } from "@/lib/audits/constants";
import { formatUtcDeadline, formatUtcTime } from "@/lib/audits/status";
import { githubProfileUrl } from "@/types/audits";
import type { ApprovalNotice } from "@/server/services/audits/visibility";

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

const REPO_BODY =
  "The program team approved your request and sent it to the firms below. If a repository is private, add the firms you want quotes from as collaborators, so they can read the code before they quote.";
const NO_REPO_BODY =
  "The program team approved your request. Quotes appear on your request page as they arrive.";
const NONE_YET =
  "None of these firms has added a GitHub username yet. Any they add while quotes are open appear on your request page.";
const LATER = "Usernames that firms add later appear on your request page while quotes are open.";

/** What the project chose at submit to show every firm the request reaches. */
function sharesLine(notice: ApprovalNotice): string | null {
  if (notice.shared_handle && notice.shared_calendar) {
    return "You shared your Telegram handle and calendar link with the firms: they may message you or book a call before they quote.";
  }
  if (notice.shared_handle) {
    return "You shared your Telegram handle with the firms: they may message you before they quote.";
  }
  if (notice.shared_calendar) {
    return "You shared your calendar link with the firms: they may book a call before they quote.";
  }
  return null;
}

/** Firms with usernames first, one row each; the rest share one row. */
function usernameRows(notice: ApprovalNotice): AuditEmailDetail[] {
  const named = notice.firms.filter((firm) => firm.github_usernames.length > 0);
  const unnamed = notice.firms.filter((firm) => firm.github_usernames.length === 0);
  if (named.length === 0) {
    return [{ label: "Firms", value: notice.firms.map((firm) => firm.firm_name).join(" · ") }];
  }
  return [
    ...named.map((firm) => ({
      label: firm.firm_name,
      value: firm.github_usernames.join(" · "),
      links: firm.github_usernames.map((name) => ({ label: name, href: githubProfileUrl(name) })),
    })),
    ...(unnamed.length > 0
      ? [{ label: "No username yet", value: unnamed.map((firm) => firm.firm_name).join(" · ") }]
      : []),
  ];
}

/** The plain-text twin of the GitHub panel, each username with its profile URL. */
function usernameText(notice: ApprovalNotice): string[] {
  const named = notice.firms.filter((firm) => firm.github_usernames.length > 0);
  const unnamed = notice.firms.filter((firm) => firm.github_usernames.length === 0);
  if (named.length === 0) {
    return [NONE_YET, `Firms: ${notice.firms.map((firm) => firm.firm_name).join(", ")}`];
  }
  return [
    GITHUB_PROFILE_WARNING,
    ...named.map(
      (firm) =>
        `${firm.firm_name}: ${firm.github_usernames.map((name) => `${name} (${githubProfileUrl(name)})`).join(", ")}`,
    ),
    ...(unnamed.length > 0
      ? [`No username yet: ${unnamed.map((firm) => firm.firm_name).join(", ")}`]
      : []),
  ];
}

/**
 * The project's one email at approval (FDE-249 step 2): its request is open
 * for quotes and, when it pins a repository, these are the GitHub usernames
 * of the firms it reached, so the project can add them to private repos
 * before they quote. Sent once, by approveRequestAndFanout, to the account
 * email: the subsidy notice's rule, request input never aims program mail at
 * a third party.
 *
 * The firm notices keep contacts out of mail (a forwarded email leaks
 * nothing). Usernames travel here anyway: a GitHub username is a public
 * handle each person adds so that projects can invite them, and the request
 * page keeps the current list. Escaping lives in the shared template.
 */
export async function sendApprovalNotice(notice: ApprovalNotice): Promise<void> {
  const count = notice.firms.length === 1 ? "1 firm" : `${notice.firms.length} firms`;
  const deadline = notice.quote_deadline;
  const requestUrl = ownerRequestUrl(notice.request_id);
  const shares = sharesLine(notice);
  const anyUsername = notice.firms.some((firm) => firm.github_usernames.length > 0);

  const subject = `«${notice.project_name}» is open for quotes from ${count}`;
  const text = [
    `${notice.project_name} is open for quotes from ${count}.${deadline ? ` Quotes close ${isoDate(deadline)} at ${formatUtcTime(deadline)} UTC.` : ""}`,
    ...(notice.pins_repository
      ? [REPO_BODY, ...usernameText(notice), GITHUB_ACCESS_LIMITS, ...(anyUsername ? [LATER] : [])]
      : [NO_REPO_BODY]),
    ...(shares ? [shares] : []),
    `Your request: ${requestUrl}`,
  ].join("\n");

  const html = renderAuditEmail({
    eyebrow: "Request approved",
    eyebrowColor: "#34D399",
    title: `«${notice.project_name}» is open for quotes.`,
    metaLine: [count, ...(deadline ? [`quotes close ${formatUtcDeadline(deadline)}`] : [])].join(" · "),
    body: notice.pins_repository ? REPO_BODY : NO_REPO_BODY,
    panel: notice.pins_repository
      ? {
          label: "GitHub usernames · for private repos",
          text: anyUsername ? GITHUB_PROFILE_WARNING : NONE_YET,
          rows: usernameRows(notice),
        }
      : undefined,
    cta: { label: "Open your request", href: requestUrl, variant: "primary" },
    footerLines: [
      ...(notice.pins_repository ? [GITHUB_ACCESS_LIMITS, ...(anyUsername ? [LATER] : [])] : []),
      ...(shares ? [shares] : []),
    ],
  });

  await sendMail(notice.email, html, subject, text);
}
