import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

import { FirmDetails } from "@/components/audits/portal/FirmDetails";
import type { OwnFirm } from "@/server/services/audits/visibility";

const QUOTE_EMAIL = "quotes@nordlicht.example";
const ALICE = "alice@nordlicht.example";
const BOB = "bob@nordlicht.example";

type Member = OwnFirm["members"][number];
const member = (over: Partial<Member>): Member => ({
  id: "mem-1",
  email: ALICE,
  invited_at: new Date("2026-09-06"),
  first_login_at: null,
  github_username: null,
  ...over,
});

const firm = (over: Partial<OwnFirm> = {}): OwnFirm => ({
  id: "aud-1",
  firm_name: "Nordlicht Security",
  quote_email: QUOTE_EMAIL,
  github_username: null,
  services: ["OpSec"],
  website: "https://nordlicht.example",
  logo_url: null,
  active: true,
  invited_at: new Date("2026-09-04"),
  first_login_at: new Date("2026-09-05"),
  deactivated_at: null,
  members: [member({})],
  ...over,
});

// Every person on the list: the quote email and Alice with a username, Bob without.
const team = (over: Partial<OwnFirm> = {}) =>
  firm({
    github_username: "nordlicht-sec",
    members: [
      member({ github_username: "alice-audits", first_login_at: new Date("2026-09-07") }),
      member({ id: "mem-2", email: BOB, invited_at: new Date("2026-09-08") }),
    ],
    ...over,
  });

// A teammate viewer is Alice unless a test names someone else.
const render = (props: {
  isOwner: boolean;
  readOnly: boolean;
  firm?: OwnFirm;
  viewerEmail?: string;
}) =>
  renderToStaticMarkup(
    createElement(FirmDetails, {
      firm: props.firm ?? firm(),
      isOwner: props.isOwner,
      readOnly: props.readOnly,
      viewerEmail: props.viewerEmail ?? (props.isOwner ? QUOTE_EMAIL : ALICE),
    }),
  );

const count = (html: string, text: string) => html.split(text).length - 1;

describe("FirmDetails", () => {
  it("the owner sees the add form and a Remove control", () => {
    const html = render({ isOwner: true, readOnly: false });
    expect(html).toContain("Add and invite");
    expect(html).toContain("Remove");
    expect(html).not.toContain("can add or remove teammates");
  });

  it("a teammate sees neither, and the pointer names the quote email", () => {
    const html = render({ isOwner: false, readOnly: false });
    expect(html).not.toContain("Add and invite");
    expect(html).toContain("Only quotes@nordlicht.example can add or remove teammates.");
  });

  it("a deactivated firm shows the banner and disables the controls", () => {
    const html = render({ isOwner: true, readOnly: true });
    expect(html).toContain("Deactivated · read-only");
    const disabledCount = (html.match(/disabled=""/g) ?? []).length;
    expect(disabledCount).toBeGreaterThanOrEqual(2);
  });

  const LOGO = "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/audits/firms/aud-1/mark.png";

  it("the tile itself replaces a stored logo, with a Remove logo link beside the identity", () => {
    const html = render({ isOwner: true, readOnly: false, firm: firm({ logo_url: LOGO }) });
    expect(html).toContain(`src="${LOGO}"`);
    expect(html).toContain('aria-label="Replace logo"');
    expect(html).toContain("Remove logo");
    expect(html).not.toContain("Choose file");
  });

  it("the tile falls back to the monogram and uploads when there is no logo", () => {
    const html = render({ isOwner: true, readOnly: false });
    expect(html).toContain(">NS<");
    expect(html).toContain('aria-label="Upload logo"');
    expect(html).not.toContain("Remove logo");
    expect(html).not.toContain("<img");
  });

  it("a deactivated firm sees the logo tile read-only", () => {
    const html = render({ isOwner: true, readOnly: true, firm: firm({ logo_url: LOGO }) });
    expect(html).toContain(`src="${LOGO}"`);
    expect(html).not.toContain('aria-label="Replace logo"');
    expect(html).not.toContain('aria-label="Upload logo"');
    expect(html).not.toContain("Remove logo");
  });

  it("a logo off our store never renders as an image", () => {
    const html = render({
      isOwner: true,
      readOnly: false,
      firm: firm({ logo_url: "https://evil.example/x.png" }),
    });
    expect(html).not.toContain("evil.example");
    expect(html).toContain(">NS<");
  });

  it("renders the services and website helpers and the teammate-grant sentence (S-12)", () => {
    const html = render({ isOwner: true, readOnly: false });
    expect(html).toContain("Shown on the vetted firms page and on your quotes.");
    expect(html).toContain("Shown on the vetted firms page");
    expect(html).toContain(
      "Teammates receive every request this firm receives and can read its full history",
    );
  });
});

describe("FirmDetails · GitHub usernames (D2.5)", () => {
  const HINT =
    "Each person adds their own GitHub username. Projects whose requests reach your firm see it, so they can add you to their private repos before you quote.";

  it("the quote-email person edits their own under the quote email; teammates' read only", () => {
    const html = render({ isOwner: true, readOnly: false, firm: team() });

    expect(count(html, ">Edit<")).toBe(1);
    const edit = html.indexOf(">Edit<");
    expect(html.indexOf("nordlicht-sec")).toBeLessThan(edit);
    expect(html.indexOf(QUOTE_EMAIL)).toBeLessThan(html.indexOf("nordlicht-sec"));
    expect(edit).toBeLessThan(html.indexOf("Team emails"));
    expect(html).not.toContain("Add your GitHub username");
  });

  it("offers the quote-email person an add link when they have none yet", () => {
    const html = render({ isOwner: true, readOnly: false, firm: team({ github_username: null }) });

    expect(count(html, ">Add your GitHub username<")).toBe(1);
    expect(html).not.toContain(">Edit<");
  });

  it("a teammate edits only their own entry, in their own row", () => {
    const html = render({ isOwner: false, readOnly: false, firm: team(), viewerEmail: BOB });

    expect(count(html, "Add your GitHub username")).toBe(1);
    expect(html.indexOf("Add your GitHub username")).toBeGreaterThan(html.indexOf(BOB));
    expect(html).not.toContain(">Edit<");
    expect(html).toContain("nordlicht-sec");
  });

  it("a teammate with a username gets one Edit, beside it", () => {
    const html = render({ isOwner: false, readOnly: false, firm: team(), viewerEmail: ALICE });

    expect(count(html, ">Edit<")).toBe(1);
    expect(html.indexOf(">Edit<")).toBeGreaterThan(html.indexOf("alice-audits"));
    expect(html.indexOf(">Edit<")).toBeLessThan(html.indexOf(BOB));
  });

  it("shows each username once, next to its person, and the hint once", () => {
    const html = render({ isOwner: true, readOnly: false, firm: team() });

    expect(count(html, "nordlicht-sec")).toBe(1);
    expect(count(html, "alice-audits")).toBe(1);
    expect(html.indexOf(ALICE)).toBeLessThan(html.indexOf("alice-audits"));
    expect(html.indexOf("alice-audits")).toBeLessThan(html.indexOf(BOB));
    expect(html.indexOf(BOB)).toBeLessThan(html.indexOf("No GitHub username yet"));
    expect(count(html, HINT)).toBe(1);
  });

  it("a deactivated firm edits nobody's", () => {
    const html = render({ isOwner: true, readOnly: true, firm: team({ github_username: null }) });

    expect(html).not.toContain("Add your GitHub username");
    expect(html).not.toContain(">Edit<");
  });

  it("a viewer who is nobody on the page gets no edit control", () => {
    const html = render({
      isOwner: false,
      readOnly: false,
      firm: team(),
      viewerEmail: "carol@nordlicht.example",
    });

    expect(html).not.toContain("Add your GitHub username");
    expect(html).not.toContain(">Edit<");
  });

  it("a teammate just added on the page reads as having no username yet", () => {
    // The add route answers without the field; FirmDetails appends it as is.
    const { github_username: _none, ...added } = member({
      id: "mem-3",
      email: "dave@nordlicht.example",
    });
    const html = render({
      isOwner: true,
      readOnly: false,
      firm: team({ members: [added as Member] }),
    });

    expect(html).toContain("No GitHub username yet");
    expect(html).not.toContain("undefined");
  });
});
