import { redirect } from "next/navigation";

// Known valid console paths (leaf routes that have actual pages)
const validConsoleLeafPaths = [
  "/console",
  "/console/layer-1/create",
  "/console/layer-1/explorer-setup",
  "/console/layer-1/l1-node-setup",
  "/console/layer-1/l1-validator-balance",
  "/console/layer-1/validator-set",
  "/console/icm/setup",
  "/console/icm/test-connection",
  "/console/ictt/setup",
  "/console/ictt/token-transfer",
  "/console/primary-network/c-p-bridge",
  "/console/primary-network/faucet",
  "/console/primary-network/node-setup",
  "/console/primary-network/stake",
  "/console/primary-network/unit-converter",
  "/console/permissioned-l1s/add-validator",
  "/console/permissioned-l1s/change-validator-weight",
  "/console/permissioned-l1s/multisig-setup",
  "/console/permissioned-l1s/remove-expired-validator-registration",
  "/console/permissioned-l1s/remove-validator",
  "/console/permissioned-l1s/validator-manager-setup",
  "/console/permissionless-l1s/native-staking-manager-setup",
  "/console/l1-access-restrictions/deployer-allowlist",
  "/console/l1-access-restrictions/transactor-allowlist",
  "/console/l1-tokenomics/fee-manager",
  "/console/l1-tokenomics/native-minter",
  "/console/l1-tokenomics/reward-manager",
  "/console/testnet-infra/icm-relayer",
  "/console/testnet-infra/nodes",
  "/console/utilities/data-api-keys",
  "/console/utilities/format-converter",
  "/console/utilities/revert-poa-manager",
  "/console/utilities/transfer-proxy-admin",
  "/console/utilities/vmcMigrateFromV1",
  "/console/history",
];

/**
 * Finds the nearest available path for a given slug.
 * Tries progressively shorter paths until it finds one that exists or is a valid parent.
 */
function findNearestAvailablePath(slug: string[]): string {
  // Try progressively shorter paths (parent paths)
  for (let i = slug.length - 1; i >= 0; i--) {
    const parentSlug = slug.slice(0, i);
    const parentPath = parentSlug.length === 0 ? "/console" : `/console/${parentSlug.join("/")}`;

    // Check if this path exists as a leaf page or has children
    const matchingPage = validConsoleLeafPaths.find(
      (path) => path === parentPath || path.startsWith(parentPath + "/")
    );

    if (matchingPage) {
      // If exact match, return it; otherwise return the first child
      return matchingPage;
    }
  }

  // If no parent found, redirect to console root
  return "/console";
}

/**
 * Catch-all route for unknown console paths.
 * Redirects to the nearest available parent path instead of showing 404.
 */
export default async function CatchAllPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const nearestPath = findNearestAvailablePath(slug);
  redirect(nearestPath);
}
