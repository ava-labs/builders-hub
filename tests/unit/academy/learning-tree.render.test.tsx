import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import LearningTree, { treeEdges } from "@/components/academy/learning-tree";
import { avalancheLearningPaths } from "@/components/academy/learning-path-configs/avalanche.config";
import { coursesInOrder, courseUrl } from "@/components/academy/shared/academy-tracks";

// Fixture stats, CourseStats by course url, for two courses; the other cards get no entry.
const courseStats = {
  "/academy/avalanche-l1/avalanche-fundamentals": { modules: 4, lessons: 31 },
  "/academy/avalanche-l1/permissioned-l1s": { modules: 7, lessons: 40 },
};
const html = renderToStaticMarkup(createElement(LearningTree, { pathType: "avalanche", courseStats }));
/** Every card link for a course: the phone list's, then the desktop tree's. */
const cardsFor = (name: string) =>
  html.split("<a ").map((segment) => `<a ${segment}`).filter((segment) => segment.includes(`>${name}</h4>`));
/** A card's text as a reader sees it: every tag removed. */
const text = (markup: string) => markup.replace(/<[^>]+>/g, "");

describe("LearningTree server markup", () => {
  it("numbers each card by its place in the mobileOrder sort, the same on phone and desktop", () => {
    coursesInOrder(avalancheLearningPaths).forEach((node, index) => {
      const cards = cardsFor(node.name);
      expect(cards).toHaveLength(2);
      cards.forEach((card) => expect(card).toContain(`>${String(index + 1).padStart(2, "0")}</span>`));
    });
  });

  it("links each card to its course", () => {
    avalancheLearningPaths.forEach((node) =>
      cardsFor(node.name).forEach((card) => expect(card).toContain(`href="${courseUrl("avalanche", node.slug)}"`)),
    );
  });

  it("prints lessons and modules from courseStats, and no counts without an entry", () => {
    cardsFor("Avalanche Fundamentals").forEach((card) => expect(text(card)).toContain("31 lessons · 4 modules"));
    cardsFor("Permissioned L1s").forEach((card) => expect(text(card)).toContain("40 lessons · 7 modules"));
    cardsFor("ERC20 Bridge").forEach((card) => expect(card).not.toContain("lessons"));
  });

  it("renders no completed state before mount", () => {
    expect(html).not.toContain("Completed");
    expect(html).not.toContain("bg-ac-ok");
  });

  it("draws the lines and the phone arrows in the line token", () => {
    expect(html).toContain("stroke-ac-line");
    expect(html).toContain('vector-effect="non-scaling-stroke"');
    expect(html).not.toMatch(/stroke="rgb\(/);
    expect(html.match(/class="text-ac-line"/g)).toHaveLength(avalancheLearningPaths.length - 1);
  });

  it("gives each discipline its hue tile", () => {
    expect(cardsFor("Avalanche Fundamentals")[0]).toContain('data-hue="blue"');
    expect(cardsFor("L1 Native Tokenomics")[0]).toContain('data-hue="gold"');
    expect(cardsFor("Customizing the EVM")[0]).toContain('data-hue="orange"');
  });

  it("wraps each card in a link that carries the card's group and draws the one 2 px ink focus ring", () => {
    const linkClasses = [...html.matchAll(/<a class="([^"]*)"/g)].map(([, list]) => list.split(" "));
    expect(linkClasses).toHaveLength(avalancheLearningPaths.length * 2);
    linkClasses.forEach((classes) =>
      expect(classes).toEqual(
        expect.arrayContaining(["group", "rounded-xl", "focus-visible:outline-2", "focus-visible:outline-offset-2", "focus-visible:outline-ac-ink"]),
      ),
    );
    // The card inside draws no ring of its own, so the ring is drawn once.
    expect(html).not.toMatch(/group-focus-visible:(outline|ring)|focus-visible:ring/);
  });

  it("raises a focused desktop card above its neighbours, so no neighbour's paper covers its ring", () => {
    expect(html.match(/<div class="absolute z-10 flex justify-center focus-within:z-20"/g)).toHaveLength(avalancheLearningPaths.length);
    // An inline z-index would beat the classes.
    expect(html).not.toMatch(/z-index:10/);
  });
});

describe("treeEdges", () => {
  it("draws one curve per dependency, leaving 95 px below the parent's top", () => {
    const edges = treeEdges(avalancheLearningPaths, new Map());
    expect(edges).toHaveLength(10);
    expect(edges.find((edge) => edge.key === "avalanche-fundamentals-customizing-evm")?.d).toBe(
      "M 50 95 C 50 135, 87.5 135, 87.5 180",
    );
    expect(edges.every((edge) => !edge.completed)).toBe(true);
  });

  it("marks the lines into a completed course", () => {
    const edges = treeEdges(avalancheLearningPaths, new Map([["permissionless-l1s", true]]));
    expect(edges.filter((edge) => edge.completed).map((edge) => edge.key)).toEqual([
      "permissioned-l1s-permissionless-l1s",
      "l1-native-tokenomics-permissionless-l1s",
    ]);
  });
});
