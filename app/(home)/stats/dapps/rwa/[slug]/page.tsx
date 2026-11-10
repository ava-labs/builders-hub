import { permanentRedirect } from "next/navigation";
import { getRWAProject } from "@/lib/rwa/projects";

/* The RWA dashboards live on the C-Chain DeFi tab's RWA view now; an
   unknown slug lands on the DeFi tab. */
export default async function RWAProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  permanentRedirect(getRWAProject(slug) ? "/explorer/mainnet/c-chain/defi/rwa" : "/explorer/mainnet/c-chain/defi");
}
