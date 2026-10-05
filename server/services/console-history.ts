import type { Prisma } from "@prisma/client";
import { prisma } from "@/prisma/prisma";

/* ------------------------------------------------------------------ */
/* Console history: what a user did in the Console, newest first.       */
/* Three tables feed it: ConsoleLog (written by the client through      */
/* POST /api/console-log, so its data is untrusted), FaucetClaim (sent  */
/* claims only) and NodeRegistration (managed testnet nodes).           */
/* ------------------------------------------------------------------ */

export const CONSOLE_HISTORY_SOURCES = ["console", "faucet", "node"] as const;
export type ConsoleHistorySource = (typeof CONSOLE_HISTORY_SOURCES)[number];
export type ConsoleHistoryStatus = "success" | "error" | "info";
export type ConsoleHistoryNetwork = "mainnet" | "testnet";

export interface ConsoleHistoryItem {
  /** unique across sources: `${source}:${row id}` */
  id: string;
  source: ConsoleHistorySource;
  status: ConsoleHistoryStatus;
  title: string;
  detail: string | null;
  network: ConsoleHistoryNetwork | null;
  createdAt: string;
  /** an explorer link on this site, built only from a validated hash */
  href: string | null;
  hash: string | null;
  /** the contract a deploy created, validated */
  address: string | null;
}

export interface ConsoleHistoryPage {
  items: ConsoleHistoryItem[];
  nextCursor: string | null;
}

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 50;

export function clampLimit(raw: unknown): number {
  const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(n)));
}

/* ------------------------------------------------------------------ */
/* Cursor: the position of the last item of a page. Base64url JSON of   */
/* [created_at ISO, source, id], so an id with any character survives.  */
export interface CursorKey {
  createdAt: Date;
  source: ConsoleHistorySource;
  id: string;
}

export class InvalidCursorError extends Error {
  constructor() {
    super("Invalid cursor");
    this.name = "InvalidCursorError";
  }
}

export function encodeCursor(key: CursorKey): string {
  return Buffer.from(JSON.stringify([key.createdAt.toISOString(), key.source, key.id]), "utf8").toString("base64url");
}

export function decodeCursor(raw: string): CursorKey {
  if (raw.length > 600 || !/^[A-Za-z0-9_-]+$/.test(raw)) throw new InvalidCursorError();
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    throw new InvalidCursorError();
  }
  if (!Array.isArray(parsed) || parsed.length !== 3) throw new InvalidCursorError();
  const [iso, source, id] = parsed as unknown[];
  if (typeof iso !== "string" || typeof source !== "string" || typeof id !== "string") throw new InvalidCursorError();
  const createdAt = new Date(iso);
  if (Number.isNaN(createdAt.getTime()) || createdAt.toISOString() !== iso) throw new InvalidCursorError();
  if (!(CONSOLE_HISTORY_SOURCES as readonly string[]).includes(source)) throw new InvalidCursorError();
  if (id.length === 0 || id.length > 200) throw new InvalidCursorError();
  return { createdAt, source: source as ConsoleHistorySource, id };
}

const rank = (s: ConsoleHistorySource) => CONSOLE_HISTORY_SOURCES.indexOf(s);

/* The page order is created_at desc, then source (console, faucet,
   node), then id asc. A table's rows strictly after the cursor: */
export function keysetWhere(source: ConsoleHistorySource, cursor: CursorKey | null) {
  if (!cursor) return {};
  const t = cursor.createdAt;
  if (rank(source) < rank(cursor.source)) return { created_at: { lt: t } };
  if (rank(source) > rank(cursor.source)) return { created_at: { lte: t } };
  return { OR: [{ created_at: { lt: t } }, { created_at: t, id: { gt: cursor.id } }] };
}

const PAGE_ORDER = [{ created_at: "desc" as const }, { id: "asc" as const }];

/* ------------------------------------------------------------------ */
/* Hashes and links                                                     */
const EVM_HASH = /^0x[0-9a-fA-F]{64}$/;
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
// a CB58 id (P-Chain tx): the base58 alphabet, no 0 O I l
const CB58_ID = /^[1-9A-HJ-NP-Za-km-z]{32,60}$/;

export const isEvmHash = (v: unknown): v is string => typeof v === "string" && EVM_HASH.test(v);
export const isCb58Id = (v: unknown): v is string => typeof v === "string" && CB58_ID.test(v);

const explorerNetwork = (n: ConsoleHistoryNetwork) => (n === "mainnet" ? "mainnet" : "fuji");

export function pchainTxHref(id: unknown, network: ConsoleHistoryNetwork | null): string | null {
  if (!isCb58Id(id) || !network) return null;
  return `/explorer/${explorerNetwork(network)}/p-chain/tx/${id}`;
}

/** a link only for the two C-Chains; another chain's hash has no page here */
export function cchainTxHref(hash: unknown, chainId: number | null): string | null {
  if (!isEvmHash(hash)) return null;
  if (chainId === 43114) return `/explorer/mainnet/c-chain/tx/${hash}`;
  if (chainId === 43113) return `/explorer/fuji/c-chain/tx/${hash}`;
  return null;
}

export function parseNetwork(v: unknown): ConsoleHistoryNetwork | null {
  return v === "mainnet" || v === "testnet" ? v : null;
}

export function parseChainId(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d{1,12}$/.test(v) ? Number(v) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function networkOfChain(chainId: number | null): ConsoleHistoryNetwork | null {
  if (chainId === 43114) return "mainnet";
  if (chainId === 43113) return "testnet";
  return null;
}

/* ------------------------------------------------------------------ */
/* Titles. P-Chain rows end in the eventType of usePChainNotifications; */
/* EVM rows end in <deploy|call|transfer|local>/<snake_name>.           */
const PCHAIN_EVENTS: Record<string, { done: string; failed: string }> = {
  subnet_created: { done: "L1 created", failed: "Could not create the L1" },
  chain_created: { done: "Chain created", failed: "Could not create the chain" },
  l1_conversion: { done: "Converted to L1", failed: "Could not convert to L1" },
  validator_added: { done: "Validator added", failed: "Could not add the validator" },
  auto_renewed_validator_added: {
    done: "Auto-renewed validator added",
    failed: "Could not add the auto-renewed validator",
  },
  auto_renewed_validator_config_set: {
    done: "Auto-renewal settings changed",
    failed: "Could not change the auto-renewal settings",
  },
  validator_registered: { done: "Validator registered", failed: "Could not register the validator" },
  validator_weight_set: { done: "Validator weight set", failed: "Could not set the validator weight" },
  validator_balance_increased: {
    done: "Validator balance increased",
    failed: "Could not increase the validator balance",
  },
  validator_disabled: { done: "Validator disabled", failed: "Could not disable the validator" },
  subnet_validator_removed: { done: "Legacy validator removed", failed: "Could not remove the legacy validator" },
  cross_chain_export: { done: "Cross-chain export sent", failed: "Could not send the cross-chain export" },
  cross_chain_import: { done: "Cross-chain import completed", failed: "Could not complete the cross-chain import" },
};
// older rows that name the transaction, not the event
PCHAIN_EVENTS.create_subnet = PCHAIN_EVENTS.subnet_created;
PCHAIN_EVENTS.create_chain = PCHAIN_EVENTS.chain_created;
PCHAIN_EVENTS.convert_subnet_to_l1 = PCHAIN_EVENTS.l1_conversion;

// a cross-chain tx can land on the C-Chain, so its id gets no P-Chain link
const CROSS_CHAIN_EVENTS = new Set(["cross_chain_export", "cross_chain_import"]);

/** a table entry by an untrusted key, never an Object.prototype member */
const lookup = <T>(table: Record<string, T>, key: string): T | undefined =>
  Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;

/** words the snake case lost: acronyms, chain names, joined contract names */
const WORDS: Record<string, string> = {
  "p-chain": "P-Chain",
  "c-chain": "C-Chain",
  "x-chain": "X-Chain",
  avax: "AVAX",
  erc20: "ERC20",
  erc721: "ERC721",
  icm: "ICM",
  ictt: "ICTT",
  l1: "L1",
  l1s: "L1s",
  subnet: "L1",
  subnets: "L1s",
  subnetid: "L1 ID",
  evm: "EVM",
  rpc: "RPC",
  poa: "PoA",
  id: "ID",
  fuji: "Fuji",
  teleporter: "Teleporter",
  validatormanager: "validator manager",
  validatormessages: "validator messages",
  proxyadmin: "proxy admin",
  transparentupgradeableproxy: "transparent upgradeable proxy",
  nativetokenstakingmanager: "native token staking manager",
  erc20tokenstakingmanager: "ERC20 token staking manager",
  examplerewardcalculator: "example reward calculator",
  icmdemo: "ICM demo",
  teleporterregistry: "Teleporter registry",
  poamanager: "PoA manager",
  exampleerc20: "example ERC20",
  erc20tokenremote: "ERC20 token remote",
  nativetokenremote: "native token remote",
  erc20tokenhome: "ERC20 token home",
  nativetokenhome: "native token home",
  tokenhome: "token home",
  wrappednativetoken: "wrapped native token",
  babyjubjub: "BabyJubJub",
};

/** snake_name to words, lower case except known words; clipped */
function words(snake: string): string {
  const out = snake
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((token) => {
      const m = /^([^a-z0-9]*)(.*?)([^a-z0-9]*)$/i.exec(token);
      const [, lead = "", core = "", trail = ""] = m ?? [];
      const lower = core.toLowerCase();
      return `${lead}${lookup(WORDS, lower) ?? lower}${trail}`;
    })
    .join(" ")
    .replace(/\b([pcx]) chain\b/gi, (_, c: string) => `${c.toUpperCase()}-Chain`)
    // visible text says L1, never subnet, also inside a joined name
    .replace(/subnet/gi, "L1");
  return clip(out, 80);
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const KINDS = new Set(["deploy", "call", "transfer", "local"]);

/** the EVM kind of a path: the segment before the name, or one more back for <kind>/contract/<name> */
function evmKind(segments: string[]): string {
  const near = (segments[segments.length - 2] ?? "").toLowerCase();
  if (KINDS.has(near)) return near;
  const far = (segments[segments.length - 3] ?? "").toLowerCase();
  return KINDS.has(far) ? far : "";
}

/** the past tense of a leading verb, so a row says what the user did */
const PAST: Record<string, string> = {
  add: "added",
  advance: "advanced",
  aggregate: "aggregated",
  allow: "allowed",
  approve: "approved",
  burn: "burned",
  change: "changed",
  claim: "claimed",
  complete: "completed",
  create: "created",
  delete: "deleted",
  deploy: "deployed",
  disable: "disabled",
  enable: "enabled",
  fund: "funded",
  grant: "granted",
  initialize: "initialized",
  initiate: "initiated",
  migrate: "migrated",
  mint: "minted",
  pause: "paused",
  register: "registered",
  remove: "removed",
  resend: "resent",
  restart: "restarted",
  revoke: "revoked",
  send: "sent",
  set: "set",
  submit: "submitted",
  transfer: "transferred",
  unpause: "unpaused",
  unwrap: "unwrapped",
  update: "updated",
  upgrade: "upgraded",
  verify: "verified",
  withdraw: "withdrew",
  wrap: "wrapped",
};

/** a name that ends in a noun of an action: "managed testnet node creation" */
const NOUN_ACTIONS: Record<string, { done: string; verb: string }> = {
  creation: { done: "created", verb: "create" },
  deletion: { done: "deleted", verb: "delete" },
  restart: { done: "restarted", verb: "restart" },
};
const NOUN_ACTION = /^(?:managed (?:testnet )?)?(.+) (creation|deletion|restart)$/i;

// one term with the FaucetClaim rows, whichever source the dedup keeps
const FAUCET_TITLE = { done: "Received tokens from the faucet", failed: "Could not receive tokens from the faucet" };
const FAUCET_CLAIM = /^(.*?)\s*faucet claim$/i;

/** the chain of a faucet claim: "P-Chain" for "Fuji P-Chain AVAX", else the name less "manual" */
function faucetChain(text: string): string | null {
  const primary = /\b([pcx])-chain\b/i.exec(text);
  if (primary) return `${primary[1].toUpperCase()}-Chain`;
  const chain = text
    .replace(/\bmanual\b/gi, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return chain ? capitalize(chain) : null;
}

// transferFrom: "Transferred from ERC20 token" would name another action
const TRANSFER_FROM = /^transfer from erc20 tokens?$/i;
const TRANSFER_FROM_TITLE = {
  done: "Sent ERC20 tokens from an approved address",
  failed: "Could not send ERC20 tokens from an approved address",
};

function joinDetail(first: string | null, second: string | null): string | null {
  return first && second ? `${first}: ${second}` : (first ?? second);
}

interface ConsoleAction {
  title: string;
  /** a detail that the title took out of the name, such as the chain of a faucet claim */
  detail: string | null;
}

function consoleAction(actionPath: string | null | undefined, status: string): ConsoleAction {
  const failed = status === "error";
  const plain = (title: string): ConsoleAction => ({ title, detail: null });
  const segments = (typeof actionPath === "string" ? actionPath : "").split("/").filter(Boolean);
  const last = sanitize(segments[segments.length - 1] ?? "").toLowerCase();
  const kind = evmKind(segments);
  if (!last) return plain(failed ? "Console action failed" : "Console action");

  const event = lookup(PCHAIN_EVENTS, last);
  if (event) return plain(failed ? event.failed : event.done);

  const name = words(last);
  if (!name) return plain(failed ? "Console action failed" : "Console action");
  if (kind === "deploy") return plain(failed ? `Could not deploy ${name}` : `Deployed ${name}`);
  // a call named by one word is a function name; a longer name is a phrase
  if (kind === "call" && !name.includes(" ")) return plain(failed ? `Could not call ${name}` : `Called ${name}`);

  // a faucet claim: "<chain> faucet claim", or an older faucet/claim/<chain> path
  const claim = FAUCET_CLAIM.exec(name);
  const fromEnd = (i: number) => (segments[segments.length - i] ?? "").toLowerCase();
  const olderClaim = fromEnd(3) === "faucet" && fromEnd(2) === "claim";
  if (claim || olderClaim) {
    return {
      title: failed ? FAUCET_TITLE.failed : FAUCET_TITLE.done,
      detail: faucetChain(claim ? claim[1] : name),
    };
  }

  if (TRANSFER_FROM.test(name)) return plain(failed ? TRANSFER_FROM_TITLE.failed : TRANSFER_FROM_TITLE.done);

  const noun = NOUN_ACTION.exec(name);
  if (noun) {
    const action = NOUN_ACTIONS[noun[2].toLowerCase()];
    return plain(failed ? `Could not ${action.verb} the ${noun[1]}` : `${capitalize(noun[1])} ${action.done}`);
  }

  // "send native coin" reads "Sent native coin", or "Could not send native coin"
  const space = name.indexOf(" ");
  const verb = space > 0 ? name.slice(0, space).toLowerCase() : "";
  const past = lookup(PAST, verb);
  if (past) {
    const rest = name.slice(space + 1);
    return plain(failed ? `Could not ${verb} ${rest}` : `${capitalize(past)} ${rest}`);
  }
  return plain(failed ? `${capitalize(name)} failed` : capitalize(name));
}

/** the human title of a ConsoleLog row */
export function consoleActionTitle(actionPath: string | null | undefined, status: string): string {
  return consoleAction(actionPath, status).title;
}

/* ------------------------------------------------------------------ */
/* Text safety: rendered as React text only; still strip control chars  */
function sanitize(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ").trim();
}

function clip(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/** the first line of an error, without control characters, at most 140 chars */
export function safeErrorText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const first = raw.split(/\r?\n/).find((line) => line.trim()) ?? "";
  const text = sanitize(first).replace(/\s+/g, " ");
  return text ? clip(text, 140) : null;
}

/* ------------------------------------------------------------------ */
/* Row mapping                                                          */
type JsonObject = Record<string, unknown>;

const asObject = (v: unknown): JsonObject | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as JsonObject) : null;

/** a local action stores its result as a JSON string (a faucet reply) */
function localResult(data: JsonObject | null): JsonObject | null {
  const r = data?.result;
  if (typeof r !== "string" || r.length > 10_000 || !r.trimStart().startsWith("{")) return asObject(r);
  try {
    return asObject(JSON.parse(r));
  } catch {
    return null;
  }
}

/** the tx id a ConsoleLog row names, if it has a valid format */
export function consoleRowHash(data: unknown): string | null {
  const d = asObject(data);
  const result = localResult(d);
  for (const v of [d?.txID, d?.txHash, result?.txID, result?.txHash]) {
    if (isEvmHash(v) || isCb58Id(v)) return v;
  }
  return null;
}

export interface ConsoleLogRow {
  id: string;
  status: string;
  action_path: string | null;
  data: Prisma.JsonValue | null;
  created_at: Date;
}

export interface FaucetClaimRow {
  id: string;
  faucet_type: string;
  chain_id: string | null;
  amount: string;
  tx_hash: string | null;
  created_at: Date;
}

export interface NodeRegistrationRow {
  id: string;
  chain_name: string | null;
  status: string;
  created_at: Date;
  expires_at: Date;
}

export function consoleItem(row: ConsoleLogRow): ConsoleHistoryItem {
  const data = asObject(row.data);
  const result = localResult(data);
  const status: ConsoleHistoryStatus = row.status === "success" ? "success" : row.status === "error" ? "error" : "info";
  const segments = (row.action_path ?? "").split("/").filter(Boolean);
  const last = (segments[segments.length - 1] ?? "").toLowerCase();
  const kind = evmKind(segments);
  const chainId = parseChainId(data?.chainId ?? result?.chainId);
  // a C-Chain id decides the network, so the tag and the link agree
  const network = networkOfChain(chainId) ?? parseNetwork(data?.network);
  const hash = consoleRowHash(data);
  const action = consoleAction(row.action_path, row.status);

  let href: string | null = null;
  if (hash && !CROSS_CHAIN_EVENTS.has(last)) {
    href = isEvmHash(hash) ? cchainTxHref(hash, chainId) : pchainTxHref(hash, network);
  }
  const address =
    kind === "deploy" && typeof data?.address === "string" && EVM_ADDRESS.test(data.address) ? data.address : null;

  return {
    id: `console:${row.id}`,
    source: "console",
    status,
    title: action.title,
    // the detail the title took out of the name (the chain), then an error text
    detail: joinDetail(action.detail, status === "error" ? safeErrorText(data?.error) : null),
    network,
    createdAt: row.created_at.toISOString(),
    href,
    hash,
    address,
  };
}

const AMOUNT = /^\d{1,12}(\.\d{1,18})?$/;

export function faucetItem(row: FaucetClaimRow): ConsoleHistoryItem {
  const chainId = parseChainId(row.chain_id);
  const amount = AMOUNT.test(row.amount) ? row.amount : null;
  let hash: string | null = null;
  let href: string | null = null;
  let network: ConsoleHistoryNetwork | null = "testnet"; // the faucets serve Fuji only
  let detail: string;
  let unit = "AVAX";

  if (row.faucet_type === "pchain") {
    hash = isCb58Id(row.tx_hash) ? row.tx_hash : null;
    href = pchainTxHref(hash, network);
    detail = "P-Chain";
  } else if (row.faucet_type === "devnet") {
    hash = isEvmHash(row.tx_hash) ? row.tx_hash : null;
    network = null; // the devnet is neither Fuji nor Mainnet
    detail = "Devnet";
  } else {
    hash = isEvmHash(row.tx_hash) ? row.tx_hash : null;
    href = cchainTxHref(hash, chainId);
    if (chainId === 43113) {
      detail = "C-Chain";
    } else {
      // an L1 faucet pays in that L1's own token
      unit = "test tokens";
      detail = chainId ? `L1 with chain ID ${chainId}` : "L1";
    }
  }

  return {
    id: `faucet:${row.id}`,
    source: "faucet",
    status: "success",
    title: amount ? `Received ${amount} ${unit} from the faucet` : "Received tokens from the faucet",
    detail,
    network,
    createdAt: row.created_at.toISOString(),
    href,
    hash,
    address: null,
  };
}

export function nodeItem(row: NodeRegistrationRow, now: Date = new Date()): ConsoleHistoryItem {
  const state =
    row.status === "terminated" ? "terminated" : row.expires_at.getTime() < now.getTime() ? "expired" : "active";
  const chain = row.chain_name ? clip(sanitize(row.chain_name), 60) : "";
  return {
    id: `node:${row.id}`,
    source: "node",
    status: "info",
    title: "Node created",
    detail: chain ? `${chain}. Status: ${state}.` : `Status: ${state}.`,
    network: "testnet", // managed nodes run on Fuji only
    createdAt: row.created_at.toISOString(),
    href: null,
    hash: null,
    address: null,
  };
}

/* ------------------------------------------------------------------ */
/* Merge                                                                */
interface Candidate {
  key: CursorKey;
  item: ConsoleHistoryItem | null; // null: a faucet claim that a Console row already shows
}

/** The page of `limit` positions after the cursor. Each list is in the
    database's order (created_at desc, id asc), so a stable sort on time
    and source keeps the id order the database used for the cursor.
    `faucetFull`: the faucet read filled its take, so more claims can follow
    even when the claims past the page are all hidden. */
export function mergePage(candidates: Candidate[], limit: number, faucetFull = false): ConsoleHistoryPage {
  const sorted = [...candidates].sort(
    (a, b) => b.key.createdAt.getTime() - a.key.createdAt.getTime() || rank(a.key.source) - rank(b.key.source),
  );
  const page = sorted.slice(0, limit);
  const last = page[page.length - 1];
  // no cursor to a page of hidden claims only
  const more = faucetFull || sorted.slice(limit).some((c) => c.item !== null);
  return {
    items: page.flatMap((c) => (c.item ? [c.item] : [])),
    nextCursor: more && last ? encodeCursor(last.key) : null,
  };
}

// a Console row is written after the faucet replies, so it is newer than the claim
const DEDUP_WINDOW_MS = 60 * 60 * 1000;
// the most Console rows one dedup read returns
const DEDUP_SCAN_MAX = 200;
// the most reads one page makes when hidden claims leave it short
const MAX_ROUNDS = 3;

const normHash = (h: string) => (h.startsWith("0x") ? h.toLowerCase() : h);

export async function getConsoleHistory(
  userId: string,
  { cursor, limit }: { cursor?: string | null; limit?: number | string | null } = {},
): Promise<ConsoleHistoryPage> {
  const want = clampLimit(limit);
  let key = cursor ? decodeCursor(cursor) : null;
  const items: ConsoleHistoryItem[] = [];
  let nextCursor: string | null = null;
  // a hidden claim uses a position, so read on until the page is full
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const page = await readPage(userId, key, want - items.length);
    items.push(...page.items);
    nextCursor = page.nextCursor;
    if (items.length >= want || !nextCursor) break;
    key = decodeCursor(nextCursor);
  }
  return { items, nextCursor };
}

async function readPage(userId: string, key: CursorKey | null, limit: number): Promise<ConsoleHistoryPage> {
  const take = limit + 1;

  const [logs, claims, nodes] = await Promise.all([
    prisma.consoleLog.findMany({
      where: { user_id: userId, ...keysetWhere("console", key) },
      orderBy: PAGE_ORDER,
      take,
      select: { id: true, status: true, action_path: true, data: true, created_at: true },
    }),
    prisma.faucetClaim.findMany({
      where: { user_id: userId, tx_hash: { not: null }, ...keysetWhere("faucet", key) },
      orderBy: PAGE_ORDER,
      take,
      select: { id: true, faucet_type: true, chain_id: true, amount: true, tx_hash: true, created_at: true },
    }),
    prisma.nodeRegistration.findMany({
      where: { user_id: userId, ...keysetWhere("node", key) },
      orderBy: PAGE_ORDER,
      take,
      select: { id: true, chain_name: true, status: true, created_at: true, expires_at: true },
    }),
  ]);

  // A manual claim has a Console row too. Its row can sit on an earlier
  // page, so read the faucet rows written after these claims as well.
  const shown = new Set<string>();
  const addHash = (data: unknown) => {
    const h = consoleRowHash(data);
    if (h) shown.add(normHash(h));
  };
  logs.forEach((l) => addHash(l.data));
  const open = claims.filter((c) => c.tx_hash && !shown.has(normHash(c.tx_hash)));
  if (open.length > 0) {
    // one short window after each claim, not one span over all of them
    const related = await prisma.consoleLog.findMany({
      where: {
        user_id: userId,
        action_path: { contains: "faucet" },
        OR: open.map((c) => ({
          created_at: { gte: c.created_at, lte: new Date(c.created_at.getTime() + DEDUP_WINDOW_MS) },
        })),
      },
      orderBy: { created_at: "asc" },
      take: DEDUP_SCAN_MAX,
      select: { data: true },
    });
    related.forEach((l) => addHash(l.data));
  }

  const now = new Date();
  return mergePage(
    [
      ...logs.map((r) => ({
        key: { createdAt: r.created_at, source: "console" as const, id: r.id },
        item: consoleItem(r),
      })),
      ...claims.map((r) => ({
        key: { createdAt: r.created_at, source: "faucet" as const, id: r.id },
        item: r.tx_hash && shown.has(normHash(r.tx_hash)) ? null : faucetItem(r),
      })),
      ...nodes.map((r) => ({
        key: { createdAt: r.created_at, source: "node" as const, id: r.id },
        item: nodeItem(r, now),
      })),
    ],
    limit,
    claims.length === take,
  );
}
