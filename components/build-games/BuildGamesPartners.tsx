import React from 'react';
import { getHackathon } from '@/server/services/hackathons';
import Image from 'next/image';
import Link from 'next/link';

const HACKATHON_ID = "249d2911-7931-4aa0-a696-37d8370b79f9";

export default async function BuildGamesPartners() {
  const hackathon = await getHackathon(HACKATHON_ID);

  if (!hackathon || !hackathon.content?.partners || hackathon.content.partners.length === 0) {
    return null;
  }

  const partners = hackathon.content.partners as Array<{
    name: string;
    logo: string;
  }>;

  const becomeSponsorLink = hackathon.content.become_sponsor_link as string | undefined;

  return (
    <div className="gradient-border-section relative rounded-[16px] shrink-0 w-full">
      <img
        alt=""
        className="absolute inset-0 max-w-none object-50%-50% object-cover opacity-30 pointer-events-none rounded-[16px] size-full"
        src="/build-games/frame-23.png"
      />
      <div className="content-stretch flex flex-col items-start overflow-clip pb-[48px] pt-[48px] px-[48px] relative rounded-[inherit] w-full">
        {/* Header */}
        <div className="content-stretch flex flex-col gap-[10px] items-start overflow-clip p-[10px] relative shrink-0 w-full mb-12">
          <div className="flex flex-col font-['Aeonik:Medium',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[48px] text-white">
            <p className="leading-none">Partners</p>
          </div>
          <p className="font-['Aeonik:Regular',sans-serif] text-[18px] text-white/70 leading-relaxed mt-4">
            These partners are supporting BuildGames. Find mentors to help you shape your idea and integrate their tech stack into your project to speed up your development.
          </p>
        </div>

        {/* Partners Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full mb-12">
          {partners.map((partner, index) => (
            <div
              key={index}
              className="group relative aspect-video rounded-lg overflow-hidden
                bg-gradient-to-br from-[rgba(102,172,214,0.05)] to-[rgba(102,172,214,0.02)]
                border border-[#66acd6]/20 hover:border-[#66acd6]/50
                transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/20"
            >
              {/* Glow effect on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#66acd6]/0 via-[#66acd6]/0 to-[#66acd6]/0
                group-hover:from-[#66acd6]/10 group-hover:via-[#66acd6]/5 group-hover:to-transparent
                transition-all duration-300" />

              {/* Partner Logo */}
              <div className="relative w-full h-full flex items-center justify-center p-6">
                <Image
                  src={partner.logo}
                  alt={partner.name}
                  fill
                  className="object-contain !relative filter brightness-0 invert opacity-60
                    group-hover:opacity-100 transition-all duration-300"
                />
              </div>

              {/* Partner Name Tooltip */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#152d44] to-transparent
                opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-3">
                <p className="text-white text-xs font-['Aeonik:Medium',sans-serif] text-center truncate">
                  {partner.name}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Become a Partner CTA */}
        {becomeSponsorLink && (
          <div className="flex justify-center w-full mt-8">
            <Link
              href={becomeSponsorLink}
              className="group relative"
            >
              <div className="absolute -inset-0.5 bg-gradient-to-r from-[#66acd6] to-[#38bdf8] rounded-lg blur opacity-30
                group-hover:opacity-60 transition duration-300" />

              <div className="relative flex items-center gap-3 px-8 py-4 bg-[#66acd6] rounded-lg
                font-['Aeonik:Medium',sans-serif] font-medium text-[#152d44]
                group-hover:bg-[#7fc0e5] transition-all duration-200
                shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/40">
                <svg
                  className="w-5 h-5 transition-transform group-hover:scale-110"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <span className="text-base">Become a Partner</span>
                <svg
                  className="w-4 h-4 transition-transform group-hover:translate-x-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
