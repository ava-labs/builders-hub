import {
  type AstIndex,
  type AstNode,
  args,
  callOptionNames,
  callee,
  calleeName,
  child,
  collect,
  isCall,
  isGlobalMember,
  isMsgSender,
  isNode,
  isTypeConversion,
  list,
  modifierNames,
  slots,
  some,
  srcEnd,
  srcStart,
  str,
  typeString,
  unwrap,
  walk,
} from "./ast";
import type { DetectorInfo, Severity } from "./types";

/*
 * Static detectors over solc's AST. They are deliberately intraprocedural and
 * name-aware (OpenZeppelin, Chainlink CCIP, Teleporter conventions): fast,
 * explainable, and tuned so the reference blueprints come out clean. They do
 * not replace the review checklist or a professional audit; they catch the
 * mistakes that generated code makes most often, before anything is signed.
 */

export interface AuditUnit {
  path: string;
  source: string;
  ast: AstNode;
}

export interface FunctionInfo {
  unit: AuditUnit;
  contract: AstNode;
  fn: AstNode;
  body: AstNode | undefined;
  /** Public or external, callable by anyone who can reach the contract. */
  entry: boolean;
  mutates: boolean;
  params: Set<number>;
}

export interface NodeInfo {
  node: AstNode;
  ancestors: AstNode[];
  unit: AuditUnit;
  contract?: AstNode;
  fn?: FunctionInfo;
}

export interface DetectorContext {
  index: AstIndex;
  units: AuditUnit[];
  contracts: { unit: AuditUnit; contract: AstNode }[];
  functions: FunctionInfo[];
  nodes: NodeInfo[];
}

export interface RawFinding {
  unit: AuditUnit;
  node: AstNode;
  message: string;
  severity?: Severity;
  contract?: AstNode;
  fn?: AstNode;
}

export interface Detector extends DetectorInfo {
  run(ctx: DetectorContext): RawFinding[];
}

/* ------------------------------- helpers ------------------------------- */

const NON_ACCESS_MODIFIERS = /^(nonReentrant\w*|noReentran\w*|lock|whenNotPaused|whenPaused)$/;
const REENTRANCY_GUARDS = /^(nonReentrant\w*|noReentran\w*|lock)$/;
// Names that imply "who may call", e.g. _checkOwner, _checkRole, _onlyGateway, _requireIssuer.
// Deliberately not bare require/check helpers such as _requireOwned (ERC-721 existence) or _requireNotPaused.
const AUTH_HELPER =
  /^_?(check|only|require|ensure)(Owner|Admin|Role|Auth\w*|Governance|Governor|Minter|Operator|Issuer|Manager|Router|Messenger|Teleporter|Gateway|Relayer|Keeper|Guardian|Caller|Sender)\w*$|^_?(authorize\w*|auth|hasRole|isAuthorized)$/;
const SIGNATURE_HELPER = /^(permit|ecrecover|recover|tryRecover|isValidSignature\w*|_useNonce|_useCheckedNonce|_verify\w*|verify\w*)$/;
const STATE_WRITING_INTERNALS = new Set(["_mint", "_burn", "_transfer", "_update", "_approve", "_safeMint", "_safeTransfer", "_setApprovalForAll"]);
const LIBRARY_EXTERNAL_CALLS = new Set([
  "safeTransfer",
  "safeTransferFrom",
  "safeIncreaseAllowance",
  "safeDecreaseAllowance",
  "forceApprove",
  "safePermit",
  "transferAndCallRelaxed",
  "transferFromAndCallRelaxed",
  "approveAndCallRelaxed",
  "sendValue",
  "functionCall",
  "functionCallWithValue",
  "functionDelegateCall",
]);

const nameOf = (node: AstNode | undefined) => str(node, "name") ?? "";

/** `L.f(x, ...)` passes the bound value explicitly; `x.f(...)` via `using L for T` does not. */
const isDirectLibraryCall = (call: AstNode) => typeString(child(callee(call), "expression")).startsWith("type(library");

function hasAccessModifier(fn: AstNode): boolean {
  return modifierNames(fn).some((name) => !NON_ACCESS_MODIFIERS.test(name));
}

function callsAuthHelper(body: AstNode | undefined): boolean {
  return !!body && some(body, (node) => isCall(node) && AUTH_HELPER.test(calleeName(node) ?? ""));
}

/** msg.sender compared, required, or branched on somewhere in the body. */
function callerChecked(body: AstNode | undefined): boolean {
  if (!body) return false;
  let checked = false;
  walk(body, (node, ancestors) => {
    if (checked) return false;
    if (!isMsgSender(node)) return;
    for (let i = ancestors.length - 1; i >= 0; i--) {
      const ancestor = ancestors[i];
      const next = ancestors[i + 1] ?? node;
      if (ancestor.nodeType === "BinaryOperation" && ["==", "!="].includes(str(ancestor, "operator") ?? "")) checked = true;
      else if (isCall(ancestor, "require") || isCall(ancestor, "assert")) checked = true;
      else if ((ancestor.nodeType === "IfStatement" || ancestor.nodeType === "Conditional") && next === child(ancestor, "condition")) checked = true;
      if (checked) break;
      if (ancestor.nodeType.endsWith("Statement") || ancestor.nodeType === "Block") break;
    }
  });
  return checked;
}

function isGuarded(fn: FunctionInfo): boolean {
  return hasAccessModifier(fn.fn) || callerChecked(fn.body) || callsAuthHelper(fn.body);
}

function referencesCaller(fn: FunctionInfo): boolean {
  return !!fn.body && some(fn.body, isMsgSender);
}

function derivesFrom(expr: AstNode | undefined, ids: Set<number>): boolean {
  if (!expr || ids.size === 0) return false;
  return some(expr, (node) => node.nodeType === "Identifier" && ids.has(node.referencedDeclaration as number));
}

function referenceCount(root: AstNode | undefined, declId: number): number {
  if (!root) return 0;
  return collect(root, (node) => node.nodeType === "Identifier" && node.referencedDeclaration === declId).length;
}

type Trust = "trusted" | "configured" | "untrusted";

function trustOf(expr: AstNode | undefined, index: AstIndex): Trust {
  if (!expr) return "untrusted";
  const e = unwrap(expr);
  if (isMsgSender(e)) return "untrusted";
  if (isTypeConversion(e)) return trustOf(args(e)[0], index);
  if (e.nodeType === "Identifier") {
    if (nameOf(e) === "this") return "trusted";
    const decl = index.decl(e.referencedDeclaration);
    if (decl?.nodeType === "VariableDeclaration" && decl.stateVariable === true) {
      const mutability = str(decl, "mutability");
      return mutability === "immutable" || mutability === "constant" || decl.constant === true ? "trusted" : "configured";
    }
    return "untrusted";
  }
  // A getter of our own, e.g. CCIPReceiver.getRouter(): configuration, not caller input.
  if (isCall(e) && callee(e)?.nodeType === "Identifier" && args(e).length === 0) return "configured";
  return "untrusted";
}

interface ExternalCall {
  node: AstNode;
  member: string;
  target: AstNode | undefined;
  lowLevel: boolean;
  sendsValue: boolean;
  trust: Trust;
}

function externalCall(call: AstNode, index: AstIndex): ExternalCall | undefined {
  if (!isCall(call)) return undefined;
  const fn = callee(call);
  if (fn?.nodeType !== "MemberAccess") return undefined;
  const member = str(fn, "memberName") ?? "";
  const base = child(fn, "expression");
  if (!base) return undefined;
  const withValue = callOptionNames(call).includes("value");
  const decl = index.decl(fn.referencedDeclaration);

  if (decl?.nodeType === "FunctionDefinition" && str(index.decl(decl.scope), "contractKind") === "library") {
    if (!LIBRARY_EXTERNAL_CALLS.has(member)) return undefined;
    const target = typeString(base).startsWith("type(library") ? args(call)[0] : base;
    const sendsValue = member === "sendValue" || member === "functionCallWithValue";
    return { node: call, member, target, lowLevel: member.startsWith("function"), sendsValue, trust: trustOf(target, index) };
  }

  const baseType = typeString(base);
  if (/^address( payable)?$/.test(baseType)) {
    if (member === "transfer" || member === "send") {
      return { node: call, member, target: base, lowLevel: false, sendsValue: true, trust: trustOf(base, index) };
    }
    if (member === "call" || member === "delegatecall") {
      return { node: call, member, target: base, lowLevel: true, sendsValue: withValue, trust: trustOf(base, index) };
    }
    return undefined;
  }

  if (baseType.startsWith("contract ")) {
    if (decl?.nodeType === "VariableDeclaration") return undefined;
    const mutability = str(decl, "stateMutability");
    if (mutability === "view" || mutability === "pure") return undefined;
    if (base.nodeType === "Identifier" && nameOf(base) === "this") return undefined;
    return { node: call, member, target: base, lowLevel: false, sendsValue: withValue, trust: trustOf(base, index) };
  }
  return undefined;
}

function writesState(lhs: AstNode | undefined, index: AstIndex): boolean {
  if (!lhs) return false;
  const e = unwrap(lhs);
  if (e.nodeType === "TupleExpression") return list(e, "components").some((c) => writesState(c, index));
  return index.storageRoot(e) !== undefined;
}

function stateWritesAfter(body: AstNode, offset: number, index: AstIndex): AstNode[] {
  return collect(body, (node) => {
    if (srcStart(node) < offset) return false;
    if (node.nodeType === "Assignment") return writesState(child(node, "leftHandSide"), index);
    if (node.nodeType === "UnaryOperation" && ["++", "--", "delete"].includes(str(node, "operator") ?? "")) {
      return writesState(child(node, "subExpression"), index);
    }
    if (isCall(node)) {
      const name = calleeName(node) ?? "";
      const fn = callee(node);
      if ((name === "push" || name === "pop") && fn?.nodeType === "MemberAccess") return writesState(child(fn, "expression"), index);
      if (fn?.nodeType === "Identifier" && STATE_WRITING_INTERNALS.has(name)) return true;
    }
    return false;
  }).map((m) => m.node);
}

const isLiteralish = (node: AstNode | undefined) => /^(int_const|rational_const|literal_string)/.test(typeString(node));
const isDynamicType = (t: string) => /^(string|bytes)( |$)/.test(t) || /\[\]( |$)/.test(t);
const intBits = (t: string): { signed: boolean; bits: number } | undefined => {
  const m = /^(u?)int(\d*)$/.exec(t.split(" ")[0]);
  return m ? { signed: m[1] !== "u", bits: m[2] ? Number(m[2]) : 256 } : undefined;
};

const inFunction = (ctx: DetectorContext, predicate: (info: NodeInfo) => boolean) => ctx.nodes.filter(predicate);

const finding = (info: NodeInfo, message: string, severity?: Severity): RawFinding => ({
  unit: info.unit,
  node: info.node,
  message,
  severity,
  contract: info.contract,
  fn: info.fn?.fn,
});

const fnLabel = (fn: FunctionInfo) =>
  str(fn.fn, "kind") === "function" ? `${nameOf(fn.fn)}()` : `${str(fn.fn, "kind") ?? "function"}`;

/* ------------------------------ detectors ------------------------------ */

const unprotectedInitializer: Detector = {
  id: "unprotected-initializer",
  title: "Initializer callable by anyone",
  severity: "critical",
  category: "SC10",
  description: "An initialize function without the initializer modifier or a one-time guard can be called again, or first, by an attacker who then owns the contract.",
  recommendation: "Inherit OpenZeppelin Initializable, mark the function `initializer` (or `reinitializer(n)`), and call `_disableInitializers()` in the constructor.",
  run(ctx) {
    return ctx.functions
      .filter((f) => f.entry && f.mutates && /^(initialize\w*|init)$/.test(nameOf(f.fn)))
      .filter((f) => !hasAccessModifier(f.fn) && !callsAuthHelper(f.body))
      .filter((f) => {
        // A hand-rolled `require(!initialized)` style guard on state.
        const guarded = collect(f.body ?? f.fn, (node) => isCall(node, "require") || node.nodeType === "IfStatement").some((m) => {
          const condition = m.node.nodeType === "IfStatement" ? child(m.node, "condition") : args(m.node)[0];
          return !!condition && some(condition, (n) => n.nodeType === "Identifier" && ctx.index.decl(n.referencedDeclaration)?.stateVariable === true);
        });
        return !guarded;
      })
      .map((f) => ({ unit: f.unit, node: f.fn, contract: f.contract, fn: f.fn, message: `${fnLabel(f)} can be called by anyone, any number of times.` }));
  },
};

const unprotectedUpgrade: Detector = {
  id: "unprotected-upgrade",
  title: "Upgrade authorization is empty",
  severity: "critical",
  category: "SC10",
  description: "UUPS proxies call `_authorizeUpgrade` before switching implementation. An empty override lets anyone replace the logic of the contract.",
  recommendation: "Restrict `_authorizeUpgrade` with `onlyOwner` or a role, ideally behind a timelock or multisig.",
  run(ctx) {
    return ctx.functions
      .filter((f) => nameOf(f.fn) === "_authorizeUpgrade" && f.body && list(f.body, "statements").length === 0 && !hasAccessModifier(f.fn))
      .map((f) => ({ unit: f.unit, node: f.fn, contract: f.contract, fn: f.fn, message: "Anyone can upgrade this contract to arbitrary code." }));
  },
};

const uninitializedImplementation: Detector = {
  id: "uninitialized-implementation",
  title: "Implementation contract can be initialized",
  severity: "high",
  category: "SC10",
  description: "The implementation behind a proxy keeps its own storage. If its initializers are not disabled, anyone can initialize it, take ownership, and in UUPS setups upgrade or self-destruct it.",
  recommendation: "Add `constructor() { _disableInitializers(); }` to every upgradeable implementation.",
  run(ctx) {
    return ctx.contracts
      .filter(({ contract }) => str(contract, "contractKind") === "contract" && contract.abstract !== true)
      .filter(({ contract }) => ctx.index.inheritsFrom(contract, "Initializable"))
      .filter(({ contract }) => {
        const ctor = list(contract, "nodes").find((n) => n.nodeType === "FunctionDefinition" && str(n, "kind") === "constructor");
        return !ctor || !some(ctor, (n) => isCall(n, "_disableInitializers"));
      })
      .map(({ unit, contract }) => ({ unit, node: contract, contract, message: `${nameOf(contract)} never calls _disableInitializers() in its constructor.` }));
  },
};

const delegatecallUntrusted: Detector = {
  id: "delegatecall-untrusted",
  title: "delegatecall to a caller-controlled address",
  severity: "high",
  category: "SC10",
  description: "delegatecall runs foreign code with this contract's storage and balance. A target the caller controls can overwrite ownership or drain funds.",
  recommendation: "Only delegatecall to immutable, audited implementations; never to addresses taken from calldata or unguarded storage.",
  run(ctx) {
    return inFunction(ctx, (i) => isCall(i.node)).flatMap((info) => {
      const call = externalCall(info.node, ctx.index);
      if (!call || !(call.member === "delegatecall" || call.member === "functionDelegateCall") || call.trust === "trusted") return [];
      return call.trust === "untrusted"
        ? [finding(info, "The delegatecall target comes from the caller.")]
        : [finding(info, "The delegatecall target is mutable storage; whoever can set it controls this contract.", "low")];
    });
  },
};

const unprotectedMint: Detector = {
  id: "unprotected-mint",
  title: "Anyone can mint",
  severity: "critical",
  category: "SC01",
  description: "A public function mints tokens without checking who calls it.",
  recommendation: "Guard minting with `onlyOwner`, an AccessControl role such as MINTER_ROLE, or payment checks, and cap supply where the design allows.",
  run(ctx) {
    return ctx.functions
      .filter((f) => f.entry && f.mutates && f.body && !isGuarded(f))
      .filter((f) => !(str(f.fn, "stateMutability") === "payable" && some(f.body!, (n) => isGlobalMember(n, "msg", "value"))))
      .flatMap((f) =>
        collect(f.body!, (n) => isCall(n) && callee(n)?.nodeType === "Identifier" && ["_mint", "_safeMint"].includes(calleeName(n) ?? "")).map(
          ({ node }) => {
            const open = args(node).some((a) => derivesFrom(a, f.params));
            return {
              unit: f.unit,
              node,
              contract: f.contract,
              fn: f.fn,
              severity: open ? ("critical" as const) : ("medium" as const),
              message: open
                ? `${fnLabel(f)} mints a caller-chosen amount or recipient with no access check.`
                : `${fnLabel(f)} mints a fixed amount to anyone who calls it. Fine for a testnet faucet, dangerous for anything with value.`,
            };
          },
        ),
      );
  },
};

const unprotectedWithdrawal: Detector = {
  id: "unprotected-withdrawal",
  title: "Anyone can send this contract's funds",
  severity: "high",
  category: "SC01",
  description: "A public function sends native coins or tokens held by the contract to a caller-chosen address, with no access check and no per-caller accounting.",
  recommendation: "Restrict sweeps to the owner, or pay out only amounts owed to msg.sender and zero them first.",
  run(ctx) {
    return ctx.functions
      .filter((f) => f.entry && f.mutates && f.body && !isGuarded(f) && !referencesCaller(f))
      .flatMap((f) =>
        collect(f.body!, (n) => isCall(n)).flatMap(({ node }) => {
          const call = externalCall(node, ctx.index);
          if (!call) return [];
          const tokenOut = !call.sendsValue && ["transfer", "safeTransfer"].includes(call.member);
          const recipient = call.sendsValue ? call.target : tokenOut ? args(node)[isDirectLibraryCall(node) ? 1 : 0] : undefined;
          if (!recipient || !derivesFrom(recipient, f.params)) return [];
          return [{ unit: f.unit, node, contract: f.contract, fn: f.fn, message: `${fnLabel(f)} lets any caller send the contract's ${call.sendsValue ? "native balance" : "tokens"} to an address they choose.` }];
        }),
      );
  },
};

const arbitraryFromTransfer: Detector = {
  id: "arbitrary-from-transfer",
  title: "transferFrom with a caller-chosen owner",
  severity: "high",
  category: "SC01",
  description: "Anyone who approved this contract can have their tokens moved by a third party, because `from` is a parameter rather than msg.sender.",
  recommendation: "Use msg.sender as `from`, or require a signature from `from` (EIP-2612 permit or EIP-712) that commits to the recipient and amount.",
  run(ctx) {
    return ctx.functions
      .filter((f) => f.entry && f.mutates && f.body && !isGuarded(f))
      .filter((f) => !some(f.body!, (n) => isCall(n) && SIGNATURE_HELPER.test(calleeName(n) ?? "")))
      .flatMap((f) =>
        collect(f.body!, (n) => isCall(n) && ["transferFrom", "safeTransferFrom"].includes(calleeName(n) ?? "")).flatMap(({ node }) => {
          const from = args(node)[isDirectLibraryCall(node) ? 1 : 0];
          if (!from || isMsgSender(unwrap(from)) || !derivesFrom(from, f.params)) return [];
          return [{ unit: f.unit, node, contract: f.contract, fn: f.fn, message: `${fnLabel(f)} moves tokens from an address the caller picks.` }];
        }),
      );
  },
};

const arbitraryExternalCall: Detector = {
  id: "arbitrary-external-call",
  title: "Arbitrary call on the contract's behalf",
  severity: "high",
  category: "SC01",
  description: "A public function forwards caller-chosen calldata to a caller-chosen target. The call runs as this contract, so it can spend approvals granted to it or act on its roles.",
  recommendation: "Allowlist targets and function selectors, or restrict the function to the owner.",
  run(ctx) {
    return ctx.functions
      .filter((f) => f.entry && f.mutates && f.body && !isGuarded(f))
      .flatMap((f) =>
        collect(f.body!, (n) => isCall(n, "call") || isCall(n, "functionCall") || isCall(n, "functionCallWithValue")).flatMap(({ node }) => {
          const call = externalCall(node, ctx.index);
          if (!call || call.member === "delegatecall") return [];
          const data = args(node)[call.member !== "call" && isDirectLibraryCall(node) ? 1 : 0];
          if (!derivesFrom(call.target, f.params) || !derivesFrom(data, f.params)) return [];
          return [{ unit: f.unit, node, contract: f.contract, fn: f.fn, message: `${fnLabel(f)} calls any target with any calldata.` }];
        }),
      );
  },
};

const txOriginAuth: Detector = {
  id: "tx-origin-auth",
  title: "Authorization with tx.origin",
  severity: "high",
  category: "SC01",
  description: "tx.origin is the wallet that started the transaction, so a malicious contract the owner interacts with passes a tx.origin check.",
  recommendation: "Authorize with msg.sender.",
  run(ctx) {
    return inFunction(ctx, (i) => isGlobalMember(i.node, "tx", "origin")).flatMap((info) => {
      const comparison = [...info.ancestors].reverse().find((a) => a.nodeType === "BinaryOperation" && ["==", "!="].includes(str(a, "operator") ?? ""));
      if (!comparison) return [];
      const other = [child(comparison, "leftExpression"), child(comparison, "rightExpression")].find((side) => side && !some(side, (n) => n === info.node));
      if (other && isMsgSender(unwrap(other))) {
        return [finding(info, "tx.origin == msg.sender restricts callers to EOAs, which breaks smart accounts and is not a security boundary.", "low")];
      }
      return [finding(info, "Access is decided by tx.origin.")];
    });
  },
};

const selfdestructUse: Detector = {
  id: "selfdestruct",
  title: "selfdestruct",
  severity: "high",
  category: "SC01",
  description: "selfdestruct is deprecated. Since Cancun (EIP-6780) it no longer deletes code except in the creating transaction, but it still sends the whole balance.",
  recommendation: "Remove it. Use a pausable design and explicit withdrawals instead.",
  run(ctx) {
    return inFunction(ctx, (i) => isCall(i.node, "selfdestruct") || isCall(i.node, "suicide")).map((info) =>
      finding(info, "selfdestruct sends the entire balance.", info.fn && isGuarded(info.fn) ? "medium" : "high"),
    );
  },
};

const ccipUncheckedSource: Detector = {
  id: "ccip-unchecked-source",
  title: "CCIP receiver accepts any source",
  severity: "high",
  category: "SC01",
  description: "CCIPReceiver only checks that the router called it. Without checking the source chain selector and sender, any contract on any CCIP chain can trigger this logic.",
  recommendation: "Allowlist (sourceChainSelector, abi.decode(message.sender, (address))) pairs and check them in _ccipReceive.",
  run(ctx) {
    return ctx.functions
      .filter((f) => nameOf(f.fn) === "_ccipReceive" && f.body)
      .flatMap((f) => {
        const [message] = list(child(f.fn, "parameters"), "parameters");
        if (!message) return [];
        const members = collect(f.fn, (n) => n.nodeType === "MemberAccess" && derivesFrom(child(n, "expression"), new Set([message.id])))
          .map((m) => str(m.node, "memberName"));
        const delegated = collect(f.body!, (n) => isCall(n) && /allow|valid|check|auth|verify/i.test(calleeName(n) ?? "")).some((m) =>
          args(m.node).some((a) => derivesFrom(a, new Set([message.id]))),
        );
        if (delegated || (members.includes("sourceChainSelector") && members.includes("sender"))) return [];
        return [{ unit: f.unit, node: f.fn, contract: f.contract, fn: f.fn, message: "_ccipReceive never checks message.sourceChainSelector and message.sender." }];
      });
  },
};

const teleporterUncheckedSource: Detector = {
  id: "teleporter-unchecked-source",
  title: "ICM receiver trusts its caller or sender blindly",
  severity: "high",
  category: "SC01",
  description: "receiveTeleporterMessage must only accept calls from the TeleporterMessenger, and usually only from known contracts on known chains.",
  recommendation: "Require msg.sender == teleporterMessenger (or use TeleporterRegistryApp), and check sourceBlockchainID and originSenderAddress against the peers you expect.",
  run(ctx) {
    return ctx.functions
      .filter((f) => ["receiveTeleporterMessage", "_receiveTeleporterMessage"].includes(nameOf(f.fn)) && f.body)
      .flatMap((f) => {
        const out: RawFinding[] = [];
        const external = nameOf(f.fn) === "receiveTeleporterMessage";
        if (external && !hasAccessModifier(f.fn) && !callerChecked(f.body) && !callsAuthHelper(f.body)) {
          out.push({ unit: f.unit, node: f.fn, contract: f.contract, fn: f.fn, message: "Anyone can call receiveTeleporterMessage with a forged message: msg.sender is never checked." });
        }
        const [sourceChain, origin] = list(child(f.fn, "parameters"), "parameters");
        if (origin && sourceChain && referenceCount(f.body, origin.id) === 0) {
          out.push({
            unit: f.unit,
            node: f.fn,
            contract: f.contract,
            fn: f.fn,
            severity: "medium",
            message: "originSenderAddress is never checked, so any contract on the source chain can send this message.",
          });
        }
        return out;
      });
  },
};

const singleStepOwnership: Detector = {
  id: "single-step-ownership",
  title: "One-step ownership transfer",
  severity: "info",
  category: "SC01",
  description: "Ownable transfers ownership in one call, so a mistyped address loses the contract for good.",
  recommendation: "Use Ownable2Step, where the new owner must accept.",
  run(ctx) {
    return ctx.contracts
      .filter(({ contract }) => str(contract, "contractKind") === "contract" && contract.abstract !== true)
      .filter(({ contract }) => ctx.index.inheritsFrom(contract, "Ownable") && !ctx.index.inheritsFrom(contract, "Ownable2Step"))
      .map(({ unit, contract }) => ({ unit, node: contract, contract, message: `${nameOf(contract)} uses single-step Ownable.` }));
  },
};

const oracleStalePrice: Detector = {
  id: "oracle-stale-price",
  title: "Chainlink price used without staleness checks",
  severity: "medium",
  category: "SC03",
  description: "latestRoundData can return an old or non-positive answer during outages, sequencer downtime or feed deprecation.",
  recommendation: "Require answer > 0 and block.timestamp - updatedAt <= the feed's heartbeat, and handle the failure explicitly.",
  run(ctx) {
    return inFunction(ctx, (i) => isCall(i.node)).flatMap((info) => {
      const name = calleeName(info.node);
      if (name === "latestAnswer" || name === "latestTimestamp" || name === "getAnswer") {
        return [finding(info, `${name}() is deprecated and carries no round metadata.`)];
      }
      if (name !== "latestRoundData") return [];
      const parent = info.ancestors[info.ancestors.length - 1];
      if (parent?.nodeType !== "VariableDeclarationStatement") return [];
      const declarations = slots(parent, "declarations");
      const answer = declarations[1];
      const updatedAt = declarations[3];
      const body = info.fn?.body;
      if (!updatedAt || referenceCount(body, updatedAt.id) === 0) return [finding(info, "updatedAt is ignored, so a stale price is accepted.")];
      const answerChecked =
        !!answer &&
        collect(body ?? parent, (n) => n.nodeType === "BinaryOperation" && ["<", "<=", ">", ">=", "==", "!="].includes(str(n, "operator") ?? "")).some((m) =>
          derivesFrom(m.node, new Set([answer.id])),
        );
      return answerChecked ? [] : [finding(info, "The answer is never checked to be positive.", "low")];
    });
  },
};

const spotPriceOracle: Detector = {
  id: "spot-price-oracle",
  title: "Spot AMM price used as an oracle",
  severity: "medium",
  category: "SC04",
  description: "Pool reserves and slot0 move within a single transaction, so a flash loan can set the price this contract reads.",
  recommendation: "Use a Chainlink feed or a TWAP long enough to be expensive to move.",
  run(ctx) {
    return inFunction(ctx, (i) => isCall(i.node, "getReserves") || isCall(i.node, "slot0")).map((info) =>
      finding(info, `${calleeName(info.node)}() is a spot value that can be manipulated within one transaction.`),
    );
  },
};

const ecrecoverRaw: Detector = {
  id: "ecrecover-raw",
  title: "Raw ecrecover",
  severity: "medium",
  category: "SC05",
  description: "ecrecover accepts malleable signatures and returns address(0) for invalid ones, and a bare hash has no replay protection.",
  recommendation: "Use OpenZeppelin ECDSA.recover over an EIP-712 digest that includes a nonce, the chain ID and this contract.",
  run(ctx) {
    return inFunction(ctx, (i) => isCall(i.node, "ecrecover") && !["ECDSA", "SignatureChecker"].includes(nameOf(i.contract))).map((info) =>
      finding(info, "Signature recovered with raw ecrecover."),
    );
  },
};

const PRECOMPILE = /^0x0[0-3]0{36}[0-9a-f]{2}$/i;

const hardcodedAddress: Detector = {
  id: "hardcoded-address",
  title: "Hardcoded address",
  severity: "low",
  category: "SC05",
  description: "An address literal ties the code to one network, and a wrong one fails silently or sends funds nowhere.",
  recommendation: "Take external addresses as constructor arguments (Builder Hub resolves them from the verified network registry).",
  run(ctx) {
    return ctx.nodes
      .filter((i) => i.node.nodeType === "Literal" && typeString(i.node).startsWith("address"))
      .filter((i) => {
        const value = str(i.node, "value") ?? "";
        return !/^0x0{40}$/i.test(value) && !PRECOMPILE.test(value);
      })
      .map((info) => finding(info, `Address literal ${str(info.node, "value")}.`));
  },
};

const LOW_LEVEL = new Set(["call", "delegatecall", "staticcall", "send"]);

const uncheckedLowLevelCall: Detector = {
  id: "unchecked-low-level-call",
  title: "Low-level call result ignored",
  severity: "medium",
  category: "SC06",
  description: "call, delegatecall, staticcall and send return false instead of reverting. Ignoring the result means a failed payment or call looks like success.",
  recommendation: "Capture the success flag and revert on failure, e.g. `(bool ok, ) = to.call{value: v}(\"\"); if (!ok) revert TransferFailed();`.",
  run(ctx) {
    return inFunction(ctx, (i) => {
      if (!isCall(i.node) || !LOW_LEVEL.has(calleeName(i.node) ?? "")) return false;
      return /^address( payable)?$/.test(typeString(child(callee(i.node)!, "expression")));
    }).flatMap((info) => {
      const parent = info.ancestors[info.ancestors.length - 1];
      const body = info.fn?.body;
      if (parent?.nodeType === "ExpressionStatement") return [finding(info, "The success flag is discarded.")];
      if (parent?.nodeType === "VariableDeclarationStatement") {
        const [ok] = slots(parent, "declarations");
        if (!ok || referenceCount(body, ok.id) === 0) return [finding(info, "The success flag is never checked.")];
      }
      if (parent?.nodeType === "Assignment") {
        const lhs = unwrap(child(parent, "leftHandSide")!);
        const first = lhs.nodeType === "TupleExpression" ? slots(lhs, "components")[0] : lhs;
        const id = first && first.nodeType === "Identifier" ? (first.referencedDeclaration as number) : undefined;
        if (id === undefined || referenceCount(body, id) < 2) return [finding(info, "The success flag is never checked.")];
      }
      return [];
    });
  },
};

const uncheckedErc20Transfer: Detector = {
  id: "unchecked-erc20-transfer",
  title: "ERC-20 return value ignored",
  severity: "medium",
  category: "SC06",
  description: "Some tokens return false instead of reverting, and some (USDT) return nothing, which makes a bool-checking call revert.",
  recommendation: "Use OpenZeppelin SafeERC20: safeTransfer, safeTransferFrom and forceApprove.",
  run(ctx) {
    return inFunction(ctx, (i) => {
      if (!isCall(i.node) || !["transfer", "transferFrom", "approve"].includes(calleeName(i.node) ?? "")) return false;
      const base = child(callee(i.node)!, "expression");
      return typeString(base).startsWith("contract ") && typeString(i.node) === "bool";
    })
      .filter((info) => info.ancestors[info.ancestors.length - 1]?.nodeType === "ExpressionStatement")
      .map((info) => finding(info, `The bool returned by ${calleeName(info.node)}() is ignored.`));
  },
};

const LOOPS = new Set(["ForStatement", "WhileStatement", "DoWhileStatement"]);

const pushPaymentLoop: Detector = {
  id: "push-payment-loop",
  title: "Payments pushed inside a loop",
  severity: "medium",
  category: "SC06",
  description: "One recipient that reverts, or runs out of gas, blocks every payment in the loop, and the loop itself can outgrow the block gas limit.",
  recommendation: "Record what each recipient is owed and let them withdraw (pull payments).",
  run(ctx) {
    const seen = new Set<AstNode>();
    return inFunction(ctx, (i) => isCall(i.node) && i.ancestors.some((a) => LOOPS.has(a.nodeType))).flatMap((info) => {
      const call = externalCall(info.node, ctx.index);
      if (!call || !(call.sendsValue || ["transfer", "safeTransfer"].includes(call.member))) return [];
      const loop = [...info.ancestors].reverse().find((a) => LOOPS.has(a.nodeType))!;
      if (seen.has(loop)) return [];
      seen.add(loop);
      return [{ ...finding(info, "A payment inside a loop: one failing recipient reverts them all."), node: loop }];
    });
  },
};

const transferStipend: Detector = {
  id: "transfer-stipend",
  title: "transfer/send with a 2300 gas stipend",
  severity: "low",
  category: "SC06",
  description: "transfer and send forward 2300 gas, which is not enough for smart-contract wallets such as Safe or ERC-4337 accounts.",
  recommendation: "Use `call{value: amount}(\"\")`, check the result, and protect the function against reentrancy.",
  run(ctx) {
    return inFunction(ctx, (i) => {
      if (!isCall(i.node) || !["transfer", "send"].includes(calleeName(i.node) ?? "")) return false;
      return typeString(child(callee(i.node)!, "expression")) === "address payable";
    }).map((info) => finding(info, `${calleeName(info.node)}() fails for recipients that need more than 2300 gas.`));
  },
};

const divideBeforeMultiply: Detector = {
  id: "divide-before-multiply",
  title: "Division before multiplication",
  severity: "medium",
  category: "SC07",
  description: "Integer division truncates, so dividing first throws away precision that the multiplication then scales up.",
  recommendation: "Multiply first, or use OpenZeppelin Math.mulDiv for full precision without overflow.",
  run(ctx) {
    return inFunction(ctx, (i) => i.node.nodeType === "BinaryOperation" && str(i.node, "operator") === "*").flatMap((info) => {
      const sides = [child(info.node, "leftExpression"), child(info.node, "rightExpression")].filter(isNode).map(unwrap);
      const division = sides.find((s) => s.nodeType === "BinaryOperation" && str(s, "operator") === "/" && !isLiteralish(s));
      return division ? [{ ...finding(info, "The result of a division is multiplied."), node: info.node }] : [];
    });
  },
};

const strictBalanceEquality: Detector = {
  id: "strict-balance-equality",
  title: "Strict equality on a balance",
  severity: "medium",
  category: "SC02",
  description: "Anyone can send native coins or tokens to a contract, so logic that expects an exact balance can be broken or blocked.",
  recommendation: "Track deposits in storage, or compare with >= / <=.",
  run(ctx) {
    const isOwnBalance = (node: AstNode) => {
      if (node.nodeType === "MemberAccess" && str(node, "memberName") === "balance") {
        const base = unwrap(child(node, "expression")!);
        return isTypeConversion(base) && nameOf(args(base)[0]) === "this";
      }
      if (isCall(node, "balanceOf")) {
        const arg = args(node)[0];
        return !!arg && isTypeConversion(unwrap(arg)) && nameOf(args(unwrap(arg))[0]) === "this";
      }
      return false;
    };
    return inFunction(ctx, (i) => i.node.nodeType === "BinaryOperation" && ["==", "!="].includes(str(i.node, "operator") ?? ""))
      .filter((info) => some(info.node, isOwnBalance))
      .map((info) => finding(info, "The contract's own balance is compared with == or !=."));
  },
};

const BLOCK_DATA = ["timestamp", "prevrandao", "difficulty", "number", "coinbase"];

const weakRandomness: Detector = {
  id: "weak-randomness",
  title: "Randomness from block data",
  severity: "high",
  category: "SC02",
  description: "Block values are public and partly chosen by block producers. On Avalanche prevrandao is not random at all.",
  recommendation: "Use a verifiable randomness source such as Chainlink VRF, or commit-reveal.",
  run(ctx) {
    const isBlockData = (n: AstNode) => BLOCK_DATA.some((m) => isGlobalMember(n, "block", m)) || isCall(n, "blockhash");
    // Plain `block.timestamp % 1 days` is time bucketing; hashing block data or reading prevrandao is a dice roll.
    const isDiceRoll = (n: AstNode) =>
      (isCall(n, "keccak256") && some(n, isBlockData)) ||
      isGlobalMember(n, "block", "prevrandao") ||
      isGlobalMember(n, "block", "difficulty") ||
      isCall(n, "blockhash");
    return inFunction(ctx, (i) => i.node.nodeType === "BinaryOperation" && str(i.node, "operator") === "%")
      .filter((info) => some(child(info.node, "leftExpression")!, isDiceRoll))
      .map((info) => finding(info, "A value derived from block data is used as a random number."));
  },
};

const encodePackedCollision: Detector = {
  id: "encode-packed-collision",
  title: "abi.encodePacked with several dynamic values",
  severity: "medium",
  category: "SC02",
  description: "Packed encoding concatenates dynamic values without lengths, so (\"ab\", \"c\") and (\"a\", \"bc\") hash the same.",
  recommendation: "Use abi.encode, or put at most one dynamic value in abi.encodePacked.",
  run(ctx) {
    return inFunction(ctx, (i) => {
      if (!isCall(i.node, "encodePacked")) return false;
      const fn = callee(i.node);
      return nameOf(child(fn!, "expression")) === "abi" && args(i.node).filter((a) => isDynamicType(typeString(a))).length >= 2;
    }).map((info) => finding(info, "Two or more dynamic values are packed together."));
  },
};

const ETH_OUT = (node: AstNode, index: AstIndex) => {
  if (isCall(node, "selfdestruct")) return true;
  if (node.nodeType === "FunctionCallOptions" && ((node.names as string[] | undefined) ?? []).includes("value")) return true;
  const call = isCall(node) ? externalCall(node, index) : undefined;
  return !!call?.sendsValue;
};

const lockedEther: Detector = {
  id: "locked-ether",
  title: "Native coins can come in but never leave",
  severity: "medium",
  category: "SC02",
  description: "The contract accepts native coins through a payable function but has no code path that sends them anywhere.",
  recommendation: "Add an access-controlled withdrawal, or remove payable if the contract should never hold native coins.",
  run(ctx) {
    return ctx.contracts
      .filter(({ contract }) => str(contract, "contractKind") === "contract" && contract.abstract !== true)
      .filter(({ contract }) => {
        const hierarchy = ctx.index.hierarchy(contract);
        const payable = hierarchy.some((c) => list(c, "nodes").some((n) => n.nodeType === "FunctionDefinition" && str(n, "stateMutability") === "payable"));
        return payable && !hierarchy.some((c) => some(c, (n) => ETH_OUT(n, ctx.index)));
      })
      .map(({ unit, contract }) => ({ unit, node: contract, contract, message: `${nameOf(contract)} can receive native coins but never sends them.` }));
  },
};

const unboundedLoop: Detector = {
  id: "unbounded-loop",
  title: "Loop over an array anyone can grow",
  severity: "medium",
  category: "SC02",
  description: "Anyone can push to this storage array without a cap, and a state-changing function loops over all of it; once it is long enough, that function runs out of gas forever.",
  recommendation: "Cap the array where it grows, or process it in pages.",
  run(ctx) {
    const lengthRoots = (root: AstNode) =>
      new Set(
        collect(root, (n) => n.nodeType === "MemberAccess" && str(n, "memberName") === "length")
          .map((m) => ctx.index.storageRoot(child(m.node, "expression"))?.id)
          .filter((id): id is number => id !== undefined),
      );
    const growable = new Set<number>();
    for (const f of ctx.functions) {
      if (!f.entry || !f.mutates || !f.body || isGuarded(f)) continue;
      const capped = new Set(
        collect(f.body, (n) => n.nodeType === "BinaryOperation").flatMap((m) => [...lengthRoots(m.node)]),
      );
      for (const { node } of collect(f.body, (n) => isCall(n, "push"))) {
        const root = ctx.index.storageRoot(child(callee(node)!, "expression"));
        if (root && !capped.has(root.id)) growable.add(root.id);
      }
    }
    if (growable.size === 0) return [];
    return inFunction(ctx, (i) => LOOPS.has(i.node.nodeType) && !!i.fn?.mutates).flatMap((info) => {
      const condition = child(info.node, "condition");
      if (!condition || ![...lengthRoots(condition)].some((id) => growable.has(id))) return [];
      return [finding(info, "This loop walks an array that any caller can grow without limit.")];
    });
  },
};

const reentrancy: Detector = {
  id: "reentrancy",
  title: "State written after an external call",
  severity: "high",
  category: "SC08",
  description: "The function updates storage after handing control to another contract, which can call back in while the old state is still visible.",
  recommendation: "Follow checks-effects-interactions (update storage before the call) and add OpenZeppelin ReentrancyGuard's nonReentrant.",
  run(ctx) {
    const out: RawFinding[] = [];
    for (const f of ctx.functions) {
      if (!f.entry || !f.mutates || !f.body) continue;
      if (modifierNames(f.fn).some((name) => REENTRANCY_GUARDS.test(name))) continue;
      const calls = collect(f.body, (n) => isCall(n))
        .map(({ node }) => externalCall(node, ctx.index))
        .filter((c): c is ExternalCall => !!c && c.trust !== "trusted" && c.member !== "delegatecall");
      let worst: { call: ExternalCall; writes: AstNode[]; severity: Severity } | undefined;
      for (const call of calls) {
        const writes = stateWritesAfter(f.body, srcEnd(call.node), ctx.index);
        if (!writes.length) continue;
        const severity: Severity = call.trust === "untrusted" ? "high" : "low";
        if (!worst || (severity === "high" && worst.severity !== "high")) worst = { call, writes, severity };
      }
      if (!worst) continue;
      const target = worst.call.trust === "untrusted" ? "a caller-controlled address" : "a configured contract";
      out.push({
        unit: f.unit,
        node: worst.call.node,
        contract: f.contract,
        fn: f.fn,
        severity: worst.severity,
        message: `${fnLabel(f)} writes storage after calling ${target}, without nonReentrant.`,
      });
    }
    return out;
  },
};

const uncheckedArithmetic: Detector = {
  id: "unchecked-arithmetic",
  title: "Arithmetic in an unchecked block",
  severity: "low",
  category: "SC09",
  description: "Overflow checks are off inside unchecked { }, so a wrong assumption wraps silently.",
  recommendation: "Keep unchecked for loop counters and proven bounds, and state the bound in a comment next to it.",
  run(ctx) {
    return ctx.nodes
      .filter((i) => i.node.nodeType === "UncheckedBlock")
      .filter((i) =>
        some(i.node, (n) =>
          (n.nodeType === "BinaryOperation" && ["+", "-", "*", "**", "<<"].includes(str(n, "operator") ?? "") && !isLiteralish(n)) ||
          (n.nodeType === "Assignment" && ["+=", "-=", "*="].includes(str(n, "operator") ?? "")),
        ),
      )
      .map((info) => finding(info, "Arithmetic runs without overflow checks here."));
  },
};

const unsafeDowncast: Detector = {
  id: "unsafe-downcast",
  title: "Unchecked integer downcast",
  severity: "low",
  category: "SC09",
  description: "Casting to a smaller integer type truncates silently instead of reverting.",
  recommendation: "Use OpenZeppelin SafeCast, or check the value against type(uintN).max first.",
  run(ctx) {
    return inFunction(ctx, (i) => isTypeConversion(i.node)).flatMap((info) => {
      const to = intBits(typeString(info.node));
      const value = args(info.node)[0];
      const from = value ? intBits(typeString(value)) : undefined;
      if (!to || !from || !value || isLiteralish(value) || to.bits >= from.bits) return [];
      const inner = unwrap(value);
      if ((isGlobalMember(inner, "block", "timestamp") || isGlobalMember(inner, "block", "number")) && to.bits >= 32) return [];
      const body = info.fn?.body;
      const declId = inner.nodeType === "Identifier" ? (inner.referencedDeclaration as number) : undefined;
      const bounded =
        !!body &&
        collect(body, (n) => n.nodeType === "BinaryOperation" && ["<", "<=", ">", ">="].includes(str(n, "operator") ?? "")).some(
          (m) => (declId !== undefined && derivesFrom(m.node, new Set([declId]))) || some(m.node, (n) => n.nodeType === "MemberAccess" && str(n, "memberName") === "max"),
        );
      return bounded ? [] : [finding(info, `${typeString(value).split(" ")[0]} is cast to ${typeString(info.node)} without a bounds check.`)];
    });
  },
};

export const DETECTORS: Detector[] = [
  unprotectedInitializer,
  unprotectedUpgrade,
  uninitializedImplementation,
  delegatecallUntrusted,
  unprotectedMint,
  unprotectedWithdrawal,
  arbitraryFromTransfer,
  arbitraryExternalCall,
  txOriginAuth,
  selfdestructUse,
  ccipUncheckedSource,
  teleporterUncheckedSource,
  singleStepOwnership,
  oracleStalePrice,
  spotPriceOracle,
  ecrecoverRaw,
  hardcodedAddress,
  uncheckedLowLevelCall,
  uncheckedErc20Transfer,
  pushPaymentLoop,
  transferStipend,
  divideBeforeMultiply,
  strictBalanceEquality,
  weakRandomness,
  encodePackedCollision,
  lockedEther,
  unboundedLoop,
  reentrancy,
  uncheckedArithmetic,
  unsafeDowncast,
];
