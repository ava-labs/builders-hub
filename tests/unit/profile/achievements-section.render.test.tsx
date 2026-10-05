import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AchievementsSection, type AchievementBadge } from "@/components/profile/sections/AchievementsSection";

const badge = (id: string, group: AchievementBadge["group"], isUnlocked: boolean): AchievementBadge => ({
  id,
  badgeId: id,
  name: `Badge ${id}`,
  description: `About ${id}`,
  imagePath: `https://example.com/${id}.png`,
  category: group,
  group,
  isUnlocked,
  awardedAt: isUnlocked ? "2026-09-04T00:00:00.000Z" : null,
  requirements: [],
});

const render = (props: Partial<Parameters<typeof AchievementsSection>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(AchievementsSection, {
      badges: [],
      academy: { completed: 0, total: 13 },
      loading: false,
      failed: false,
      onRetry: () => undefined,
      ...props,
    }),
  );

/** The markup's text, one entry per text run. */
const runs = (html: string) =>
  html
    .replace(/<[^>]+>/g, "|")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

describe("AchievementsSection", () => {
  it("shows the Academy progress as text and as a progress bar", () => {
    const html = render({ academy: { completed: 4, total: 13 } });
    expect(runs(html)).toContain("4 of 13 courses");
    expect(html).toMatch(/role="progressbar"[^>]*aria-valuemin="0"[^>]*aria-valuemax="13"[^>]*aria-valuenow="4"/);
  });

  it("names each badge tile by its badge and its state, not by color alone", () => {
    const html = render({ badges: [badge("a1", "academy", true), badge("a2", "academy", false)] });
    expect(html).toContain('aria-label="Badge a1, earned"');
    expect(html).toContain('aria-label="Badge a2, not yet earned"');
    expect(runs(html)).toEqual(expect.arrayContaining(["Earned", "Not yet"]));
  });

  it("shows the hackathon badges the user earned, and the empty line without one", () => {
    const won = render({ badges: [badge("h1", "hackathon", true)] });
    expect(won).toContain('aria-label="Hackathon badges"');
    expect(won).not.toContain("No hackathon badges yet.");

    const none = render({ badges: [badge("a1", "academy", false)] });
    expect(none).not.toContain('aria-label="Hackathon badges"');
    expect(none).toContain("No hackathon badges yet. Win a prize at a hackathon to earn one.");
    expect(none).toContain('href="/hackathons"');
  });

  it("shows a retry line when the summary fails, and no badge", () => {
    const html = render({ failed: true, badges: [badge("a1", "academy", true)] });
    expect(html).toContain('role="alert"');
    expect(runs(html)).toContain("Could not load your badges.");
    expect(html).not.toContain("Badge a1");
  });

  it("links to the Academy from the header", () => {
    expect(render()).toContain('href="/academy"');
  });
});
