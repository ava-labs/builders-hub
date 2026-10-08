import { permanentRedirect } from "next/navigation";
import { cChainAddressOf, protocolMainContract } from "@/lib/contracts";
import { getRWAProject } from "@/lib/rwa/projects";

/* The old per-protocol page is retired. An RWA project opens on the C-Chain
   DeFi tab's RWA view; any other protocol on its main C-Chain contract in
   the explorer: the registry's main contract, then DefiLlama's C-Chain
   address. With none, the C-Chain DeFi tab. */
async function llamaAddress(slug: string): Promise<string | undefined> {
  try {
    const res = await fetch(`https://api.llama.fi/protocol/${encodeURIComponent(slug)}`, { next: { revalidate: 86_400 } });
    if (!res.ok) return undefined;
    const p = (await res.json()) as { address?: string | null };
    return cChainAddressOf(p.address);
  } catch {
    return undefined;
  }
}

export default async function DAppPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // an RWA project opens on the DeFi tab's RWA view, as it once opened its dashboard
  if (getRWAProject(slug)) return permanentRedirect("/explorer/mainnet/c-chain/defi/rwa");
  const address = protocolMainContract(slug) ?? (await llamaAddress(slug));
  permanentRedirect(address ? `/explorer/mainnet/c-chain/address/${address}` : "/explorer/mainnet/c-chain/defi");
}
