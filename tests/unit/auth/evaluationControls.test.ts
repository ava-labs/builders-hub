import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EvaluationPanel } from "@/components/evaluate/EvaluationPanel";

describe("organizer scoring controls", () => {
  it.each([true, false])("shows scoring controls only when canEvaluate is %s", (canEvaluate) => {
    const html = renderToStaticMarkup(createElement(EvaluationPanel, {
      projectId: "project", origin: "hackathon", evaluations: [],
      currentUserId: "owner", stage: 0, currentStage: 0,
      canEvaluate, onEvaluationSaved: () => {},
    }));
    expect(html.includes("Your Verdict")).toBe(canEvaluate);
    expect(html.includes("Final Score")).toBe(canEvaluate);
  });
});
