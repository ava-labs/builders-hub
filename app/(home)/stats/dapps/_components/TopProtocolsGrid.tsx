"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { DAppStats } from "@/types/dapps";

interface TopProtocolsGridProps {
  dapps: DAppStats[];
}

// Dark band that surfaces the top 12 protocols by TVL as circular avatars
// with rank badges. Click jumps to the detail page.
export function TopProtocolsGrid({ dapps }: TopProtocolsGridProps) {
  const router = useRouter();
  const top12 = dapps.slice(0, 12);

  return (
    <div className="bg-zinc-900 dark:bg-black py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <h3 className="text-sm font-medium text-zinc-400 mb-4">
          Top Protocols by TVL
        </h3>
        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-3 sm:gap-4">
          {top12.map((dapp, index) => (
            <button
              key={dapp.id}
              onClick={() => router.push(`/stats/dapps/${dapp.slug}`)}
              className="group relative flex flex-col items-center cursor-pointer"
            >
              <div className="relative">
                <div className="absolute -top-1 -right-1 z-10 w-4 h-4 rounded-full bg-white text-zinc-900 text-[10px] font-bold flex items-center justify-center">
                  {index + 1}
                </div>
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-zinc-800 border-2 border-zinc-700 overflow-hidden transition-all duration-200 group-hover:scale-110 group-hover:border-red-500">
                  {dapp.logo ? (
                    <Image
                      src={dapp.logo}
                      alt={dapp.name}
                      width={56}
                      height={56}
                      unoptimized={dapp.logo?.endsWith(".svg")}
                      className={`w-full h-full object-cover ${dapp.darkInvert ? "dark:invert" : ""}`}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg font-bold text-zinc-400">
                      {dapp.name.charAt(0)}
                    </div>
                  )}
                </div>
              </div>
              <span className="mt-1.5 text-[10px] sm:text-xs text-zinc-500 text-center truncate w-full max-w-[60px] group-hover:text-white transition-colors">
                {dapp.name.length > 8
                  ? `${dapp.name.slice(0, 8)}...`
                  : dapp.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
