import React from 'react';
import { getHackathon } from '@/server/services/hackathons';
import Image from 'next/image';
import { DynamicIcon } from 'lucide-react/dynamic';

const HACKATHON_ID = "249d2911-7931-4aa0-a696-37d8370b79f9";

export default async function BuildGamesMentors() {
  const hackathon = await getHackathon(HACKATHON_ID);

  if (!hackathon || !hackathon.content?.speakers || hackathon.content.speakers.length === 0) {
    return null;
  }

  const speakers = hackathon.content.speakers as Array<{
    name: string;
    picture?: string;
    category: string;
    icon: string;
  }>;

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
            <p className="leading-none">Mentors</p>
          </div>
          {hackathon.content.speakers_text && (
            <p className="font-['Aeonik:Regular',sans-serif] text-[18px] text-white/70 leading-relaxed mt-4">
              {hackathon.content.speakers_text as string}
            </p>
          )}
        </div>

        {/* Mentors Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full">
          {speakers.map((speaker, index) => (
            <div
              key={index}
              className="group relative rounded-xl overflow-hidden
                bg-gradient-to-br from-[rgba(102,172,214,0.08)] to-[rgba(102,172,214,0.02)]
                border border-[#66acd6]/20 hover:border-[#66acd6]/50
                transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-cyan-500/20"
            >
              {/* Background Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#66acd6]/0 via-[#66acd6]/0 to-[#66acd6]/0
                group-hover:from-[#66acd6]/10 group-hover:via-[#66acd6]/5 group-hover:to-transparent
                transition-all duration-300 pointer-events-none" />

              <div className="relative p-6">
                {/* Image/Avatar */}
                <div className="relative mb-4 rounded-lg overflow-hidden">
                  {speaker.picture && speaker.picture.trim() !== "" ? (
                    <div className="relative aspect-square w-full">
                      <Image
                        src={speaker.picture}
                        alt={speaker.name}
                        fill
                        className="object-cover rounded-lg transition-transform duration-300 group-hover:scale-110"
                      />
                      {/* Gradient Overlay on Hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#152d44] via-transparent to-transparent
                        opacity-0 group-hover:opacity-60 transition-opacity duration-300" />
                    </div>
                  ) : (
                    <div className="aspect-square w-full bg-gradient-to-br from-[rgba(102,172,214,0.1)] to-[rgba(102,172,214,0.05)]
                      rounded-lg flex items-center justify-center border border-[#66acd6]/20">
                      <DynamicIcon
                        name="user-circle"
                        size={64}
                        className="text-[#66acd6]/40"
                      />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="space-y-2">
                  <h3 className="text-lg font-['Aeonik:Medium',sans-serif] font-medium text-white group-hover:text-[#66acd6] transition-colors">
                    {speaker.name}
                  </h3>

                  {/* Category Badge */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full
                    bg-[#66acd6]/10 border border-[#66acd6]/20 w-fit">
                    <DynamicIcon
                      name={speaker.icon as any}
                      size={14}
                      className="text-[#66acd6]"
                    />
                    <p className="text-xs font-['Aeonik:Medium',sans-serif] text-[#66acd6]">
                      {speaker.category}
                    </p>
                  </div>
                </div>

                {/* Corner Accent */}
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-[#66acd6]/10 to-transparent rounded-bl-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
