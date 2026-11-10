import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import LearningTree, { treeEdges } from "@/components/academy/learning-tree";
import { team1LearningPaths } from "@/components/academy/learning-path-configs/team1.config";
import { coursesInOrder, courseUrl } from "@/components/academy/shared/academy-tracks";

// Fixture stats, CourseStats by course url, for two courses (Team1 courses have no modules); the others get no entry.
const courseStats = {
  "/academy/team1/team1-fundamentals": { modules: 0, lessons: 6 },
  "/academy/team1/team1-technical-member": { modules: 0, lessons: 7 },
};
const html = renderToStaticMarkup(createElement(LearningTree, { pathType: "team1", courseStats }));
/** Every card link for a course: the phone list's, then the desktop tree's. */
const cardsFor = (name: string) =>
  html.split("<a ").map((segment) => `<a ${segment}`).filter((segment) => segment.includes(`>${name}</h4>`));
/** A card's text as a reader sees it: every tag removed. */
const text = (markup: string) => markup.replace(/<[^>]+>/g, "");

describe("LearningTree server markup (the Team1 landing)", () => {
  it("numbers each card by its place in the mobileOrder sort, the same on phone and desktop", () => {
    coursesInOrder(team1LearningPaths).forEach((node, index) => {
      const cards = cardsFor(node.name);
      expect(cards).toHaveLength(2);
      cards.forEach((card) => expect(card).toContain(`>${String(index + 1).padStart(2, "0")}</span>`));
    });
  });

  it("links each card to its course", () => {
    team1LearningPaths.forEach((node) =>
      cardsFor(node.name).forEach((card) => expect(card).toContain(`href="${courseUrl("team1", node.slug)}"`)),
    );
  });

  it("prints lessons from courseStats, and no counts without an entry", () => {
    cardsFor("Team1 Fundamentals").forEach((card) => expect(text(card)).toContain("6 lessons"));
    cardsFor("Team1 Technical Member").forEach((card) => expect(text(card)).toContain("7 lessons"));
    cardsFor("Team1 Soft Skills").forEach((card) => expect(card).not.toContain("lessons"));
  });

  it("renders no completed state before mount", () => {
    expect(html).not.toContain("Completed");
    expect(html).not.toContain("bg-ac-ok");
  });

  it("draws the lines and the phone arrows in the line token", () => {
    expect(html).toContain("stroke-ac-line");
    expect(html).toContain('vector-effect="non-scaling-stroke"');
    expect(html).not.toMatch(/stroke="rgb\(/);
    expect(html.match(/class="text-ac-line"/g)).toHaveLength(team1LearningPaths.length - 1);
  });

  it("gives each Team1 category its hue tile", () => {
    expect(cardsFor("Team1 Fundamentals")[0]).toContain('data-hue="blue"');
    expect(cardsFor("Team1 Technical Member")[0]).toContain('data-hue="orange"');
    expect(cardsFor("Team1 Soft Skills")[0]).toContain('data-hue="green"');
  });

  it("wraps each card in a link that carries the card's group and draws the one 2 px ink focus ring", () => {
    const linkClasses = [...html.matchAll(/<a class="([^"]*)"/g)].map(([, list]) => list.split(" "));
    expect(linkClasses).toHaveLength(team1LearningPaths.length * 2);
    linkClasses.forEach((classes) =>
      expect(classes).toEqual(
        expect.arrayContaining(["group", "rounded-xl", "focus-visible:outline-2", "focus-visible:outline-offset-2", "focus-visible:outline-ac-ink"]),
      ),
    );
    expect(html).not.toMatch(/group-focus-visible:(outline|ring)|focus-visible:ring/);
  });

  it("raises a focused desktop card above its neighbours, so no neighbour's paper covers its ring", () => {
    expect(html.match(/<div class="absolute z-10 flex justify-center focus-within:z-20"/g)).toHaveLength(team1LearningPaths.length);
    expect(html).not.toMatch(/z-index:10/);
  });
});

describe("treeEdges", () => {
  it("draws one curve per dependency, leaving 95 px below the parent's top, and names its ends", () => {
    const edges = treeEdges(team1LearningPaths, new Map());
    expect(edges).toHaveLength(5);
    expect(edges[0]).toEqual({
      key: "team1-fundamentals-team1-technical-member",
      d: "M 50 95 C 50 147.5, 20 147.5, 20 205",
      completed: false,
      from: "team1-fundamentals",
      to: "team1-technical-member",
    });
  });

  it("marks the lines into a completed course", () => {
    const edges = treeEdges(team1LearningPaths, new Map([["team1-advanced-technical-member", true]]));
    expect(edges.filter((edge) => edge.completed).map((edge) => edge.key)).toEqual(["team1-technical-member-team1-advanced-technical-member"]);
  });
});
