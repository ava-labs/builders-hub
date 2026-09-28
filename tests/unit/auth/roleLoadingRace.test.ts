import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

// Exercise the component's actual async loader with controlled response order,
// without a browser or any requests to the real role-management endpoint.
const path = "components/admin/UserRolesManager.tsx";
const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let loader = "";
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "loadRoles") loader = node.getText(source);
  ts.forEachChild(node, visit);
}
visit(source);

function setup() {
  const pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  const state = { rows: [] as unknown[], loading: false };
  const context = vm.createContext({
    rolesRequest: { current: 0 },
    fetch: (url: string) => new Promise((resolve, reject) => pending.set(new URL(url, "http://local").searchParams.get("user_id")!, { resolve, reject })),
    setLoading: (value: boolean) => { state.loading = value; },
    setRows: (value: unknown[]) => { state.rows = value; },
    setDrafts: vi.fn(), draftsFromRows: (rows: unknown[]) => rows,
    toast: { error: vi.fn() }, encodeURIComponent,
  });
  vm.runInContext(ts.transpileModule(loader, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  const respond = (user: string) => pending.get(user)!.resolve({ ok: true, json: async () => ({ roles: [user] }) });
  return { context, pending, state, respond };
}

describe("role loader response ordering", () => {
  it("ignores an old response arriving after the selected user's response", async () => {
    const { context, state, respond } = setup();
    const old = context.loadRoles("A");
    const current = context.loadRoles("B");
    respond("B"); await current;
    respond("A"); await old;
    expect(state.rows).toEqual(["B"]);
  });

  it("does not clear loading or report an old failure while the current request is pending", async () => {
    const { context, state, pending, respond } = setup();
    const old = context.loadRoles("A");
    const current = context.loadRoles("B");
    pending.get("A")!.reject(new Error("offline")); await old;
    expect(state.loading).toBe(true);
    expect(context.toast.error).not.toHaveBeenCalled();
    respond("B"); await current;
    expect(state.rows).toEqual(["B"]);
    expect(state.loading).toBe(false);
  });
});
