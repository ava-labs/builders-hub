/**
 * Pure mapping for the Avalanche Notify import: scan export items to ValidatorAlert rows.
 * No database and no network here, so tests/unit/validator-alerts can cover every rule.
 */

import { isValidEmail } from '@/lib/email';
import { normalizeEmail } from '@/lib/utils';
import { NODE_ID_PATTERN } from '@/components/profile/sections/alerts-format';
import { LEGACY_NOTIFY_SOURCE } from '@/server/services/legacy-validator-alerts';

/** The old service watched Primary Network validators only. */
export const PRIMARY = 'primary';

/** One attribute value in `aws dynamodb scan --output json`. */
export type DynamoValue = { S?: string; N?: string; BOOL?: boolean; [type: string]: unknown };
export type DynamoItem = Record<string, DynamoValue>;

/** Read `{"Items": [...]}` from a scan export. Throws on any other shape. */
export function parseScanExport(json: unknown): DynamoItem[] {
  const items = (json as { Items?: unknown } | null)?.Items;
  if (!Array.isArray(items)) throw new Error('The export has no "Items" array. Give the output of `aws dynamodb scan --output json`.');
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('An entry in "Items" is not an object.');
  }
  return items as DynamoItem[];
}

function stringAttr(item: DynamoItem, name: string): string | null {
  const value = item[name]?.S;
  return typeof value === 'string' ? value : null;
}

/** Attribute name to the number of items that carry it. Names only, never values. */
export function attributeCensus(items: DynamoItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) for (const name of Object.keys(item)) counts[name] = (counts[name] ?? 0) + 1;
  return counts;
}

export interface LegacyPair {
  email: string;
  node_id: string;
}

export interface ExtractReport {
  items: number;
  invalidNodeId: number;
  /** Not a string, or not a valid address: for example KMS ciphertext. */
  emailNotPlaintext: number;
  /** Items that repeat an (email, NodeID) pair after normalization. */
  duplicatePairs: number;
}

/** The key of one alert: unique per (email, node, network) in the import. */
export function pairKey(email: string, nodeId: string, subnetId: string = PRIMARY): string {
  return `${normalizeEmail(email)}\n${nodeId}\n${subnetId}`;
}

/** Valid, normalized, deduplicated (email, NodeID) pairs, in export order. */
export function extractPairs(items: DynamoItem[]): { pairs: LegacyPair[]; report: ExtractReport } {
  const report: ExtractReport = { items: items.length, invalidNodeId: 0, emailNotPlaintext: 0, duplicatePairs: 0 };
  const seen = new Set<string>();
  const pairs: LegacyPair[] = [];
  for (const item of items) {
    const nodeId = stringAttr(item, 'NodeID')?.trim() ?? '';
    if (!NODE_ID_PATTERN.test(nodeId)) {
      report.invalidNodeId++;
      continue;
    }
    const rawEmail = stringAttr(item, 'Email')?.trim() ?? '';
    if (!isValidEmail(rawEmail)) {
      report.emailNotPlaintext++;
      continue;
    }
    const email = normalizeEmail(rawEmail);
    const key = pairKey(email, nodeId);
    if (seen.has(key)) {
      report.duplicatePairs++;
      continue;
    }
    seen.add(key);
    pairs.push({ email, node_id: nodeId });
  }
  return { pairs, report };
}

/** A row for `prisma.validatorAlert.createMany`. Defaults match a new Primary Network alert. */
export interface ImportRow {
  user_id: string | null;
  node_id: string;
  subnet_id: string;
  email: string;
  source: string;
  label: null;
  uptime_alert: boolean;
  uptime_threshold: number;
  version_alert: boolean;
  expiry_alert: boolean;
  expiry_days: number;
  balance_alert: boolean;
  security_alert: boolean;
  active: boolean;
}

export interface ImportContext {
  /** `pairKey` of every row already in ValidatorAlert for these nodes, any user or none. */
  existingPairs: Set<string>;
  /** `userNodeKey` of every row already in ValidatorAlert for these nodes that has a user. */
  existingUserNodes: Set<string>;
  /** Normalized email to User.id, for addresses that have a Builder Hub account. */
  userIdByEmail: Map<string, string>;
  /** NodeIDs in the current Primary Network validator set; null keeps every node. */
  activeNodes: Set<string> | null;
}

export interface PlanReport {
  alreadyInValidatorAlert: number;
  notValidating: number;
  rows: number;
  rowsWithAccount: number;
  rowsWithoutAccount: number;
  emails: number;
  nodes: number;
}

/** The key of the unique (user_id, node_id, subnet_id) index. */
export function userNodeKey(userId: string, nodeId: string, subnetId: string = PRIMARY): string {
  return `${userId}\n${nodeId}\n${subnetId}`;
}

export function toImportRow(pair: LegacyPair, userId: string | null): ImportRow {
  return {
    user_id: userId,
    node_id: pair.node_id,
    subnet_id: PRIMARY,
    email: pair.email,
    source: LEGACY_NOTIFY_SOURCE,
    label: null,
    uptime_alert: true,
    uptime_threshold: 95,
    version_alert: true,
    expiry_alert: true,
    expiry_days: 7,
    balance_alert: false,
    security_alert: false,
    active: true,
  };
}

/** Drop pairs that exist already or (with `activeNodes`) no longer validate, and build the rows. */
export function planImport(pairs: LegacyPair[], ctx: ImportContext): { rows: ImportRow[]; report: PlanReport } {
  const rows: ImportRow[] = [];
  let alreadyInValidatorAlert = 0;
  let notValidating = 0;
  for (const pair of pairs) {
    const userId = ctx.userIdByEmail.get(pair.email) ?? null;
    // Skip a pair with the same address, or a node that the account already watches.
    if (
      ctx.existingPairs.has(pairKey(pair.email, pair.node_id)) ||
      (userId && ctx.existingUserNodes.has(userNodeKey(userId, pair.node_id)))
    ) {
      alreadyInValidatorAlert++;
      continue;
    }
    if (ctx.activeNodes && !ctx.activeNodes.has(pair.node_id)) {
      notValidating++;
      continue;
    }
    rows.push(toImportRow(pair, userId));
  }
  const rowsWithAccount = rows.filter((r) => r.user_id !== null).length;
  return {
    rows,
    report: {
      alreadyInValidatorAlert,
      notValidating,
      rows: rows.length,
      rowsWithAccount,
      rowsWithoutAccount: rows.length - rowsWithAccount,
      emails: new Set(rows.map((r) => r.email)).size,
      nodes: new Set(rows.map((r) => r.node_id)).size,
    },
  };
}

export function chunk<T>(list: T[], size: number): T[][] {
  if (size < 1) throw new Error('Chunk size must be at least 1.');
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export interface NoticeCandidate {
  id: string;
  email: string;
  node_id: string;
  /** True when a migration notice log exists for this row. */
  noticed: boolean;
}

export interface NoticeGroup {
  email: string;
  alerts: { alertId: string; nodeId: string }[];
}

/**
 * One notice per address, listing each of its alerts. An address that has a notice on any
 * of its rows is skipped as a whole, so a second run sends nothing twice.
 */
export function groupNotices(rows: NoticeCandidate[]): { groups: NoticeGroup[]; alreadyNoticed: number } {
  const byEmail = new Map<string, NoticeCandidate[]>();
  for (const row of rows) {
    const email = normalizeEmail(row.email);
    byEmail.set(email, [...(byEmail.get(email) ?? []), row]);
  }
  const groups: NoticeGroup[] = [];
  let alreadyNoticed = 0;
  for (const [email, list] of byEmail) {
    if (list.some((r) => r.noticed)) {
      alreadyNoticed++;
      continue;
    }
    groups.push({ email, alerts: list.map((r) => ({ alertId: r.id, nodeId: r.node_id })) });
  }
  return { groups, alreadyNoticed };
}
