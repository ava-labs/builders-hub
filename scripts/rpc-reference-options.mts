// fumadocs-openapi generateFiles options for the P-Chain, C-Chain and X-Chain
// RPC reference pages.

// The library's default slug keeps "&" ("Balances & UTXOs" becomes
// "balances-&-utxos"), and a docs URL with "&" does not resolve, so tag
// folders keep letters and digits only.
function tagFolderName(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const rpcReferenceOptions = {
  includeDescription: true,
  groupBy: "tag",
  slugify: tagFolderName,
} as const;
