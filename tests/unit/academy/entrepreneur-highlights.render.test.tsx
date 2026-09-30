import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// The header's track tabs read the session.
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null, status: "unauthenticated" }) }));

import EntrepreneurAcademyPage from "@/app/(home)/academy/entrepreneur/page";
import { entrepreneurAcademyLandingPageConfig } from "@/app/(home)/academy/entrepreneur/config";

/** The keyboard focus ring: 2 px of ink, 2 px outside the control. */
const FOCUS_RING = ["focus-visible:outline-2", "focus-visible:outline-offset-2", "focus-visible:outline-ac-ink"];
const blogs = entrepreneurAcademyLandingPageConfig.features?.highlights?.blogs ?? [];

describe("Entrepreneur highlights", () => {
  it("draws the 2 px ink focus ring on every highlight link", () => {
    const tags = renderToStaticMarkup(createElement(EntrepreneurAcademyPage)).match(/<a [^>]*>/g) ?? [];
    expect(blogs.length).toBeGreaterThan(0);
    blogs.forEach((blog) => {
      const tag = tags.find((candidate) => candidate.includes(`href="${blog.link}"`)) ?? "";
      const classes = (tag.match(/\bclass="([^"]*)"/)?.[1] ?? "").split(" ");
      expect(classes, blog.id).toEqual(expect.arrayContaining(FOCUS_RING));
    });
  });
});
