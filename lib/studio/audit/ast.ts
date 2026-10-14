/**
 * Just enough of solc's compact JSON AST to write detectors against. Nodes
 * are left loosely typed on purpose: the shape varies across compiler
 * versions, and every accessor here tolerates missing fields.
 */

export interface AstNode {
  id: number;
  nodeType: string;
  src: string;
  [key: string]: unknown;
}

export const isNode = (value: unknown): value is AstNode =>
  typeof value === "object" && value !== null && typeof (value as { nodeType?: unknown }).nodeType === "string";

const SKIPPED_KEYS = new Set(["typeDescriptions", "documentation", "typeName", "baseName"]);

export function childNodes(node: AstNode): AstNode[] {
  const out: AstNode[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (SKIPPED_KEYS.has(key)) continue;
    if (Array.isArray(value)) {
      for (const item of value) if (isNode(item)) out.push(item);
    } else if (isNode(value)) {
      out.push(value);
    }
  }
  return out;
}

/** Depth-first walk. Returning false from `visit` skips that node's children. */
export function walk(root: AstNode, visit: (node: AstNode, ancestors: readonly AstNode[]) => boolean | void): void {
  const ancestors: AstNode[] = [];
  const step = (node: AstNode) => {
    if (visit(node, ancestors) === false) return;
    ancestors.push(node);
    for (const child of childNodes(node)) step(child);
    ancestors.pop();
  };
  step(root);
}

export interface Match {
  node: AstNode;
  ancestors: AstNode[];
}

export function collect(root: AstNode, predicate: (node: AstNode, ancestors: readonly AstNode[]) => boolean): Match[] {
  const out: Match[] = [];
  walk(root, (node, ancestors) => {
    if (predicate(node, ancestors)) out.push({ node, ancestors: [...ancestors] });
  });
  return out;
}

export function some(root: AstNode, predicate: (node: AstNode) => boolean): boolean {
  let found = false;
  walk(root, (node) => {
    if (found) return false;
    if (predicate(node)) found = true;
    return !found;
  });
  return found;
}

export function srcRange(node: AstNode): { start: number; length: number; file: number } {
  const [start, length, file] = node.src.split(":").map(Number);
  return { start, length, file };
}

export const srcStart = (node: AstNode) => srcRange(node).start;
export const srcEnd = (node: AstNode) => {
  const { start, length } = srcRange(node);
  return start + length;
};

/* ------------------------------ accessors ------------------------------ */

export const str = (node: AstNode | undefined, key: string): string | undefined =>
  node && typeof node[key] === "string" ? (node[key] as string) : undefined;

export const num = (node: AstNode | undefined, key: string): number | undefined =>
  node && typeof node[key] === "number" ? (node[key] as number) : undefined;

export const child = (node: AstNode | undefined, key: string): AstNode | undefined =>
  node && isNode(node[key]) ? (node[key] as AstNode) : undefined;

export const list = (node: AstNode | undefined, key: string): AstNode[] =>
  node && Array.isArray(node[key]) ? (node[key] as unknown[]).filter(isNode) : [];

/** Like `list`, but keeps the holes solc leaves for omitted tuple components. */
export const slots = (node: AstNode | undefined, key: string): (AstNode | null)[] =>
  node && Array.isArray(node[key]) ? (node[key] as unknown[]).map((item) => (isNode(item) ? item : null)) : [];

export const typeString = (node: AstNode | undefined): string =>
  (node?.typeDescriptions as { typeString?: string } | undefined)?.typeString ?? "";

/* ----------------------------- expressions ----------------------------- */

/** Strips parentheses, which solc represents as single-element tuples. */
export function unwrap(expr: AstNode): AstNode {
  let current = expr;
  while (current.nodeType === "TupleExpression" && list(current, "components").length === 1 && !current.isInlineArray) {
    current = list(current, "components")[0];
  }
  return current;
}

/** The called expression of a FunctionCall, past any `{value: ..., gas: ...}` options. */
export function callee(call: AstNode): AstNode | undefined {
  let expr = child(call, "expression");
  while (expr?.nodeType === "FunctionCallOptions") expr = child(expr, "expression");
  return expr;
}

export function callOptionNames(call: AstNode): string[] {
  const expr = child(call, "expression");
  return expr?.nodeType === "FunctionCallOptions" ? ((expr.names as string[] | undefined) ?? []) : [];
}

export function calleeName(call: AstNode): string | undefined {
  const fn = callee(call);
  if (!fn) return undefined;
  if (fn.nodeType === "Identifier") return str(fn, "name");
  if (fn.nodeType === "MemberAccess") return str(fn, "memberName");
  return undefined;
}

export const args = (call: AstNode): AstNode[] => list(call, "arguments");

export const isCall = (node: AstNode, name?: string) =>
  node.nodeType === "FunctionCall" && str(node, "kind") === "functionCall" && (name === undefined || calleeName(node) === name);

export const isTypeConversion = (node: AstNode) => node.nodeType === "FunctionCall" && str(node, "kind") === "typeConversion";

/** `base.member` on a global such as msg, tx or block. */
export function isGlobalMember(node: AstNode, base: string, member: string): boolean {
  if (node.nodeType !== "MemberAccess" || str(node, "memberName") !== member) return false;
  const expr = child(node, "expression");
  return expr?.nodeType === "Identifier" && str(expr, "name") === base;
}

export const isMsgSender = (node: AstNode) =>
  isGlobalMember(node, "msg", "sender") || (isCall(node, "_msgSender") && args(node).length === 0);

/** The identifier at the root of an lvalue such as `a.b[c].d`. */
export function rootIdentifier(expr: AstNode | undefined): AstNode | undefined {
  let current = expr;
  while (current) {
    current = unwrap(current);
    if (current.nodeType === "Identifier") return current;
    if (current.nodeType === "IndexAccess") current = child(current, "baseExpression");
    else if (current.nodeType === "MemberAccess") current = child(current, "expression");
    else if (current.nodeType === "IndexRangeAccess") current = child(current, "baseExpression");
    else return undefined;
  }
  return undefined;
}

export function modifierNames(fn: AstNode): string[] {
  return list(fn, "modifiers")
    .filter((m) => str(m, "kind") !== "baseConstructorSpecifier")
    .map((m) => str(child(m, "modifierName"), "name") ?? "")
    .filter(Boolean);
}

/* ------------------------------- index -------------------------------- */

export class AstIndex {
  readonly byId = new Map<number, AstNode>();
  /** Local storage pointers to the expression they were initialised from. */
  readonly pointerOrigins = new Map<number, AstNode>();

  constructor(units: AstNode[]) {
    for (const unit of units) {
      walk(unit, (node) => {
        if (typeof node.id === "number") this.byId.set(node.id, node);
        if (node.nodeType === "VariableDeclarationStatement") {
          const [decl] = slots(node, "declarations");
          const initial = child(node, "initialValue");
          if (decl && initial && str(decl, "storageLocation") === "storage") this.pointerOrigins.set(decl.id, initial);
        }
      });
    }
  }

  decl(id: unknown): AstNode | undefined {
    return typeof id === "number" ? this.byId.get(id) : undefined;
  }

  /** Most derived first, as solc linearizes it. */
  hierarchy(contract: AstNode): AstNode[] {
    const ids = (contract.linearizedBaseContracts as number[] | undefined) ?? [contract.id];
    return ids.map((id) => this.byId.get(id)).filter((c): c is AstNode => c?.nodeType === "ContractDefinition");
  }

  inheritsFrom(contract: AstNode, name: string): boolean {
    return this.hierarchy(contract).some((c) => str(c, "name") === name);
  }

  /** The state variable an lvalue ultimately writes to, following local storage pointers. */
  storageRoot(expr: AstNode | undefined, depth = 0): AstNode | undefined {
    const root = rootIdentifier(expr);
    const decl = this.decl(root?.referencedDeclaration);
    if (!decl || decl.nodeType !== "VariableDeclaration") return undefined;
    if (decl.stateVariable === true) return decl;
    if (str(decl, "storageLocation") !== "storage" || depth > 8) return undefined;
    const origin = this.pointerOrigins.get(decl.id);
    // A storage parameter of an internal function: some caller's storage.
    return origin ? this.storageRoot(origin, depth + 1) : decl;
  }
}
