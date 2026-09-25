import { permanentRedirect } from "next/navigation";
import { getRWAProject } from "@/lib/rwa/projects";

/* The RWA dashboards are retired. A project opens on its tranche pool, where
   its loans live; an unknown slug lands on the C-Chain DeFi tab. */
export default async function RWAProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pool = getRWAProject(slug)?.addresses.tranchePool;
  permanentRedirect(pool ? `/explorer/mainnet/c-chain/address/${pool.toLowerCase()}` : "/explorer/mainnet/c-chain/defi");
}
