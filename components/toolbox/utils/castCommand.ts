/**
 * Generate a `cast send` CLI command string for completing validator operations
 * via Foundry when a Core wallet is not available.
 */
export function generateCastSendCommand(opts: {
  address: string;
  calldata: string;
  accessList?: any[];
  rpcUrl: string;
}): string {
  const accessListArg = opts.accessList ? `--access-list '${JSON.stringify(opts.accessList)}'` : '';
  return [
    `cast send ${opts.address} \\`,
    `  ${opts.calldata} \\`,
    ...(accessListArg ? [`  ${accessListArg} \\`] : []),
    `  --gas-limit 2000000 \\`,
    `  --rpc-url ${opts.rpcUrl} \\`,
    `  --private-key $PRIVATE_KEY`,
  ].join('\n');
}
