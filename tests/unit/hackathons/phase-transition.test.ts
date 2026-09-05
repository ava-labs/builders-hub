import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const path = "components/evaluate/HackathonEvaluateDashboard.tsx";
const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler = "";
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "confirmPhaseChange") handler = node.getText(source);
  ts.forEachChild(node, visit);
}
visit(source);

describe("phase transition refresh", () => {
  it.each(["PICKING", "EVALUATION"])("reloads authorized server data after moving to %s", async (nextPhase) => {
    const reload = vi.fn();
    const fetch = vi.fn().mockResolvedValue({ ok: true });
    const context = vm.createContext({
      hackathonId: "event", nextPhase, fetch,
      window: { location: { reload } },
      setPhaseAdvancing: vi.fn(), setPhaseError: vi.fn(),
      setPhase: vi.fn(), setPhaseConfirmOpen: vi.fn(),
    });
    vm.runInContext(ts.transpileModule(handler, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
    await context.confirmPhaseChange();
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ phase: nextPhase });
    expect(reload).toHaveBeenCalledOnce();
    expect(context.setPhase).not.toHaveBeenCalled();
  });

  it("keeps the current page and reports a failed transition", async () => {
    const reload = vi.fn();
    const context = vm.createContext({
      hackathonId: "event", nextPhase: "PICKING",
      fetch: vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Forbidden" }) }),
      window: { location: { reload } },
      setPhaseAdvancing: vi.fn(), setPhaseError: vi.fn(),
    });
    vm.runInContext(ts.transpileModule(handler, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
    await context.confirmPhaseChange();
    expect(reload).not.toHaveBeenCalled();
    expect(context.setPhaseError).toHaveBeenLastCalledWith("Forbidden");
  });
});
