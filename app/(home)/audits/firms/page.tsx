import type { Metadata } from "next";
import { createMetadata } from "@/utils/metadata";
import { getPublicFirms } from "@/server/services/audits/visibility";
import { FirmsList } from "@/components/audits/firms/FirmsList";

export const dynamic = "force-dynamic";
// revalidate = 60 is the lever if traffic ever matters (S-22).

export const metadata: Metadata = createMetadata({
  title: "Vetted firms",
  description:
    "The vetted security firms on the Ava Labs audit whitelist and the services each one offers. One request reaches all of them, or only the ones you choose.",
  openGraph: {
    url: "/audits/firms",
    images: { url: "/api/og/audits", width: 1200, height: 630, alt: "Avalanche Security Audits" },
  },
  twitter: {
    images: { url: "/api/og/audits", width: 1200, height: 630, alt: "Avalanche Security Audits" },
  },
});

export default async function VettedFirmsPage() {
  const firms = await getPublicFirms();
  return (
    <main className="container relative max-w-[1400px]">
      <FirmsList firms={firms} />
    </main>
  );
}
