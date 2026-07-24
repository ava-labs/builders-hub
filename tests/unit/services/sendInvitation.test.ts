import { describe, expect, it, vi, beforeEach } from "vitest";

const { sendMailMock } = vi.hoisted(() => ({ sendMailMock: vi.fn() }));
vi.mock("@/server/services/mail", () => ({ sendMail: sendMailMock }));

import { sendInvitation } from "@/server/services/SendInvitationProjectMember";

const LINK = "https://build.avax.network/grants/team1-mini-grants/apply?project=p1";

// html is the 2nd arg of sendMail(email, html, subject, text)
const htmlOf = () => sendMailMock.mock.calls[0][1] as string;

beforeEach(() => {
  sendMailMock.mockReset();
  sendMailMock.mockResolvedValue(undefined);
});

describe("sendInvitation HTML escaping", () => {
  it("neutralizes markup in a project name", async () => {
    await sendInvitation("victim@example.com", '<a href="https://evil.test">Claim</a>', "Armin", LINK);

    const html = htmlOf();
    expect(html).not.toContain("<a href=\"https://evil.test\">");
    expect(html).toContain("&lt;a href=&quot;https://evil.test&quot;&gt;");
    // The legitimate CTA link survives.
    expect(html).toContain(`href="${LINK}"`);
  });

  it("neutralizes markup in the inviter's display name", async () => {
    await sendInvitation("victim@example.com", "Acme", "<img src=x onerror=alert(1)>", LINK);

    const html = htmlOf();
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("drops a banner that is not an absolute http(s) URL", async () => {
    await sendInvitation("victim@example.com", "Acme", "Armin", LINK, "en", {
      title: "Hack",
      banner: 'javascript:alert(1)" onload="alert(2)',
    });

    expect(htmlOf()).not.toContain("javascript:");
  });

  it("keeps a valid banner and escapes the hackathon title", async () => {
    await sendInvitation("victim@example.com", "Acme", "Armin", LINK, "en", {
      title: '"><script>bad()</script>',
      banner: "https://cdn.example.com/b.png",
    });

    const html = htmlOf();
    expect(html).toContain('src="https://cdn.example.com/b.png"');
    expect(html).not.toContain("<script>");
  });

  // Blob uploads keep the user's raw filename, so "My Banner.png" arrives as
  // %20-encoded. Re-encoding it would 404 the image in every invitation email.
  it("does not double-encode an already-percent-encoded banner URL", async () => {
    await sendInvitation("victim@example.com", "Acme", "Armin", LINK, "en", {
      title: "Hack",
      banner: "https://blob.example.com/My%20Banner.png",
    });

    const html = htmlOf();
    expect(html).toContain('src="https://blob.example.com/My%20Banner.png"');
    expect(html).not.toContain("%2520");
  });

  it("preserves query params in a banner URL", async () => {
    await sendInvitation("victim@example.com", "Acme", "Armin", LINK, "en", {
      title: "Hack",
      banner: "https://cdn.example.com/b.png?w=100&h=50",
    });

    // & is escaped for the attribute; the browser decodes it back to &.
    expect(htmlOf()).toContain('src="https://cdn.example.com/b.png?w=100&amp;h=50"');
  });

  it("neutralizes an invite link that tries to break out of the href attribute", async () => {
    const hostile = 'https://build.avax.network/x"><a href="https://evil.test">Claim your grant</a><a href="';
    await sendInvitation("victim@example.com", "Acme", "Armin", hostile);

    const html = htmlOf();
    expect(html).not.toContain('"><a href="https://evil.test">');
    expect(html).toContain('href="https://build.avax.network/x&quot;&gt;');
  });

  it("replaces a non-http(s) invite link with a dead href", async () => {
    await sendInvitation("victim@example.com", "Acme", "Armin", "javascript:alert(1)");

    const html = htmlOf();
    expect(html).not.toContain("javascript:");
    expect(html).toContain('href="#"');
  });

  it("leaves the plain-text part unescaped", async () => {
    await sendInvitation("victim@example.com", "Tom & Jerry", "Armin", LINK);

    const text = sendMailMock.mock.calls[0][3] as string;
    expect(text).toContain("Tom & Jerry");
  });
});
