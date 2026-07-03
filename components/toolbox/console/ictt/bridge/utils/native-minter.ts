/**
 * Sync detection of the Native Minter precompile on a destination L1.
 *
 * `NativeTokenRemote` requires the `contractNativeMinterConfig` precompile to
 * be active on the chain it's deployed to, otherwise the constructor (and
 * every subsequent mint) reverts. We surface this in the v2 wizard so the
 * `Native gas token` radio is disabled-with-a-tooltip rather than letting the
 * user click through to a guaranteed failure.
 *
 * Detection strategy is intentionally cheap and offline: parse the L1's stored
 * `genesisData` and look for the precompile key under `config`. The presence
 * of the key is treated as activation, because `generateGenesis` (see
 * `components/toolbox/components/genesis/genGenesis.ts`) only emits the key
 * when the user opted in.
 *
 * Returns:
 *   - `true`     when the genesis JSON contains the precompile.
 *   - `false`    when the genesis JSON exists and does NOT contain it.
 *   - `'unknown'` when no genesis was stored (imported chains, older entries).
 *
 * Consumers should map `'unknown'` to "allow but show advisory" — the wallet
 * tx will still revert if the precompile is actually missing, so we don't
 * pretend to know better than the chain.
 */
export type NativeMinterStatus = true | false | 'unknown';

export function detectNativeMinterPrecompile(genesisData: string | null | undefined): NativeMinterStatus {
  if (!genesisData) return 'unknown';
  try {
    const parsed: unknown = JSON.parse(genesisData);
    if (!isRecord(parsed)) return 'unknown';
    const config = parsed.config;
    if (!isRecord(config)) return 'unknown';
    return Object.prototype.hasOwnProperty.call(config, 'contractNativeMinterConfig');
  } catch {
    return 'unknown';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
