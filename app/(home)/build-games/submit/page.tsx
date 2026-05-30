import BuildGamesSubmitForm from "@/components/build-games/BuildGamesSubmitForm";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Submit | Build Games 2026",
  description: "Submit your Build Games 2026 stage deliverables.",
};

interface PageProps {
  searchParams: Promise<{ stage?: string }>;
}

export default async function BuildGamesSubmitPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const stageParam = parseInt(params.stage ?? "1", 10);
  const stage = [1, 2, 3, 4].includes(stageParam) ? stageParam : 1;

  return (
    <div className="min-h-screen bg-black">
      {/* Top nav */}
      <div className="border-b border-zinc-800/60">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <Link href="/build-games" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Build Games
          </Link>
          <span className="text-zinc-700">|</span>
          <div className="flex items-center gap-2">
            <AvalancheLogo className="w-6 h-6" />
            <span className="text-zinc-400 text-sm font-medium">Build Games 2026</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
        <BuildGamesSubmitForm stage={stage} />
      </div>
    </div>
  );
}
