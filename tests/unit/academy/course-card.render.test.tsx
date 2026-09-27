import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BookOpen } from "lucide-react";
import { CourseCard, shortDuration, statsLabel, type CourseCardProps } from "@/components/academy/course-card";

// One card's inputs; test fixture values standing in for a config node and its computed stats.
const card = (over: Partial<CourseCardProps> = {}): CourseCardProps => ({
  variant: "desktop",
  name: "Avalanche Fundamentals",
  description: "Learn about Avalanche Consensus",
  number: "01",
  discipline: "Fundamentals",
  hue: "blue",
  icon: BookOpen,
  stats: { modules: 4, lessons: 31 },
  duration: "1 hour",
  tool: "Console",
  completed: false,
  ...over,
});
const render = (over?: Partial<CourseCardProps>) => renderToStaticMarkup(createElement(CourseCard, card(over)));
/** The footer row: from its opening tag to the end of the card. */
const footer = (html: string) => {
  const at = html.lastIndexOf('<div class="mt-[7px]');
  return at === -1 ? "" : html.slice(at);
};
/** Markup as a reader sees it: every tag removed. */
const text = (html: string) => html.replace(/<[^>]+>/g, "");
/** Each `group-hover:` class in the markup, with the class list of the element that carries it. */
const hoverReveals = (html: string) =>
  [...html.matchAll(/class="([^"]*)"/g)].flatMap(([, list]) => {
    const classes = list.split(" ");
    return classes
      .filter((name) => name.startsWith("group-hover:"))
      .map((name) => ({ classes, value: name.slice("group-hover:".length) }));
  });

describe("CourseCard", () => {
  it("heads the card with the hue tile, the discipline label and the course number", () => {
    const html = render();
    expect(html).toContain('data-hue="blue"');
    expect(html).toContain(">Fundamentals</span>");
    expect(html).toMatch(/font-ac-mono[^"]*">01<\/span>/);
  });

  it("keeps the desktop description on one line and shows the tool only on hover", () => {
    const html = render();
    expect(html).toContain("line-clamp-1");
    expect(html).toMatch(/max-h-0[^"]*group-hover:max-h-8[^>]*>.*Console/);
    expect(text(footer(html))).toContain("31 lessons · 4 modules");
    expect(footer(html)).toContain("1 h");
    expect(footer(html)).not.toContain("Console");
  });

  it("gives each hover reveal a focus twin, so keyboard focus on the wrapping link shows what hover shows", () => {
    const desktop = hoverReveals(render());
    expect(desktop.map(({ value }) => value)).toEqual(expect.arrayContaining(["border-ac-ink", "mt-2", "max-h-8", "opacity-100"]));
    for (const { classes, value } of [...desktop, ...hoverReveals(render({ variant: "phone" }))]) {
      expect(classes).toContain(`group-focus-visible:${value}`);
    }
  });

  it("puts the tool in the phone footer, where its name truncates before the row leaves the card", () => {
    const html = render({ variant: "phone" });
    expect(html).not.toContain("line-clamp-1");
    expect(html).not.toContain("max-h-0");
    expect(footer(html)).toMatch(/min-w-0[\s\S]*<span class="truncate">Console<\/span>/);
    expect(text(footer(html))).toContain("31 lessons · 4 modules");
  });

  it("sets the dot apart in its own element with 1 px side margins, on the desktop and phone footers", () => {
    const separated = expect.stringContaining('31 lessons<span class="mx-px"> · </span>4 modules');
    expect([footer(render()), footer(render({ variant: "phone" }))]).toEqual([separated, separated]);
  });

  it("shows a check in place of the number and Completed in place of the counts", () => {
    const html = render({ completed: true });
    expect(html).not.toContain(">01<");
    expect(html).toContain("bg-ac-ok");
    expect(footer(html)).toContain("Completed");
    expect(footer(html)).not.toContain("lessons");
  });

  it("prints no counts without a stats entry, and lessons alone for a course without modules", () => {
    expect(footer(render({ stats: undefined }))).not.toContain("lessons");
    const team1 = footer(render({ stats: { modules: 0, lessons: 5 }, duration: undefined, tool: undefined }));
    expect(team1).toContain(">5 lessons<");
    expect(team1).not.toContain("module");
  });

  it("drops the footer when it has nothing to show, and the hue when the discipline has none", () => {
    expect(footer(render({ stats: undefined, duration: undefined, tool: undefined }))).toBe("");
    expect(render({ hue: null })).not.toContain("data-hue");
  });
});

describe("card footer text", () => {
  it("shortens durations as the approved cards print them", () => {
    expect(shortDuration("1 hour")).toBe("1 h");
    expect(shortDuration("2 hours")).toBe("2 h");
    expect(shortDuration("1.5 hours")).toBe("1.5 h");
    expect(shortDuration("45 minutes")).toBe("45 min");
  });

  it("counts lessons and modules with the right plural", () => {
    const label = (stats: Parameters<typeof statsLabel>[0]) => text(renderToStaticMarkup(createElement("span", null, statsLabel(stats))));
    expect(label({ lessons: 31, modules: 4 })).toBe("31 lessons · 4 modules");
    expect(label({ lessons: 1, modules: 1 })).toBe("1 lesson · 1 module");
    expect(label({ lessons: 7, modules: 0 })).toBe("7 lessons");
  });
});
