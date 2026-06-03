/**
 * Serialize / parse the Avalanche SDK `Context` across the HTTP boundary.
 *
 * The console resolves the Context server-side (`/api/avalanche-context`) so the
 * browser never calls the public X-Chain endpoint directly (that direct
 * `avm.getAssetDescription` fetch bypasses the Core wallet transport and fails
 * from non-production origins).
 *
 * The Context holds `bigint` values both at the top level (`baseTxFee`,
 * `createAssetTxFee`) and nested inside `platformFeeConfig` (`maxCapacity`,
 * `maxPerSecond`, …). JSON can't represent `bigint`, so we tag every bigint on
 * the wire and revive it on read. This is intentionally shape-agnostic: it keeps
 * working if the SDK's fee model gains or drops bigint fields.
 */

const BIGINT_TAG = '__avax_bigint__';

interface TaggedBigInt {
  [BIGINT_TAG]: string;
}

function isTaggedBigInt(value: unknown): value is TaggedBigInt {
  return (
    typeof value === 'object' &&
    value !== null &&
    BIGINT_TAG in value &&
    typeof (value as Record<string, unknown>)[BIGINT_TAG] === 'string'
  );
}

/** Stringify a Context (or any value), encoding every `bigint` as `{ [BIGINT_TAG]: "…" }`. */
export function stringifyContext(value: unknown): string {
  return JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? { [BIGINT_TAG]: v.toString() } : v));
}

/** Parse a string produced by `stringifyContext`, reviving every tagged bigint back to `bigint`. */
export function parseContext<T>(json: string): T {
  return JSON.parse(json, (_key, value) => (isTaggedBigInt(value) ? BigInt(value[BIGINT_TAG]) : value)) as T;
}
