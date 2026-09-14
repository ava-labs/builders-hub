import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createMetadata } from "@/utils/metadata";
import { NetworkShell } from "@/components/explorer-v2/network/NetworkShell";
import { IcmMessageView } from "@/components/explorer-v2/IcmMessage";
import { normalizeMessageId } from "@/lib/icm-message";
import { fetchIcmMessage } from "@/lib/icm-message.server";

// The delivered case is immutable, but an in-flight message must not have "sent"
// pinned; upstream already collapses repeat lookups on a 30s cache.
export const revalidate = 30;

const ogImage = { url: "/api/og/explorer", width: 1200, height: 630, alt: "Avalanche Explorer" };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ messageId: string }>;
}): Promise<Metadata> {
  const { messageId } = await params;
  const id = normalizeMessageId(messageId);
  const short = id ? `${id.slice(0, 12)}…${id.slice(-6)}` : "Message";
  return createMetadata({
    title: `Interchain Message ${short} | Avalanche Explorer`,
    description:
      "Teleporter message lifecycle: source and destination chain, delivery transaction, relayer and execution outcome.",
    openGraph: { images: ogImage },
    twitter: { images: ogImage },
  });
}

export default async function IcmMessagePage({
  params,
}: {
  params: Promise<{ network: string; messageId: string }>;
}) {
  const { network, messageId } = await params;
  const id = normalizeMessageId(messageId);
  if (!id) notFound();

  const message = await fetchIcmMessage(id);

  return (
    <NetworkShell
      network={network}
      title="Interchain Message"
      eyebrow="Interchain Messaging"
      intro="One Teleporter message, end to end: where it was sent from, where it landed, and what happened when it arrived."
    >
      <IcmMessageView messageId={id} message={message} />
    </NetworkShell>
  );
}
