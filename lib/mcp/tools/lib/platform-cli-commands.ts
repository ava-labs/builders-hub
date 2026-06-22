/**
 * Canonical platform-cli command surface — the single source of truth for the
 * command strings emitted by `build_plan` and shown as `equivalentCli` in
 * `console_flow`. Keeping them here stops the three former copies (actions.ts,
 * console.ts, docs.ts) from drifting.
 *
 * platform-cli v2.0.0 renames several P-Chain commands to mirror the avalanchego
 * tx types (breaking). The released CLI on `main` is still v1, so we DEFAULT to
 * v1 and gate v2 behind PLATFORM_CLI_MAJOR — flip the constant to 2 when v2.0.0
 * actually tags, and every emitted command updates in one place.
 */

export const PLATFORM_CLI_MAJOR: 1 | 2 = 1;

function pick(v1: string, v2: string): string {
  return PLATFORM_CLI_MAJOR >= 2 ? v2 : v1;
}

export const CLI = {
  keysGenerate: 'platform keys generate',
  nodeInfo: 'platform node info',
  subnetCreate: 'platform subnet create',
  chainCreate: 'platform chain create',
  subnetConvertL1: pick('platform subnet convert-l1', 'platform subnet convert-to-l1'),
  subnetAddValidator: 'platform subnet add-validator', // v2 net-new (permissioned subnet validator)
  l1RegisterValidator: 'platform l1 register-validator',
  l1SetWeight: pick('platform l1 set-weight', 'platform l1 set-validator-weight'),
  l1AddBalance: pick('platform l1 add-balance', 'platform l1 increase-validator-balance'),
  l1DisableValidator: 'platform l1 disable-validator',
  validatorAdd: pick('platform validator add', 'platform validator add-permissionless'),
  validatorDelegate: pick('platform validator delegate', 'platform validator add-permissionless-delegator'),
  transferSend: 'platform transfer send',
  transferPtoC: 'platform transfer p-to-c',
  transferCtoP: 'platform transfer c-to-p',
} as const;

export const PLATFORM_CLI_DOCS = 'https://build.avax.network/docs/tooling/platform-cli';
