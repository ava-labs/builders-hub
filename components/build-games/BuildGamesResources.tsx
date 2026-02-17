import React from 'react';
import { getHackathon } from '@/server/services/hackathons';
import { ExternalLink } from 'lucide-react';
import { DynamicIcon } from 'lucide-react/dynamic';

const HACKATHON_ID = "249d2911-7931-4aa0-a696-37d8370b79f9";

export default async function BuildGamesResources() {
  const hackathon = await getHackathon(HACKATHON_ID);

  if (!hackathon || !hackathon.content?.resources) {
    return null;
  }

  const resources = hackathon.content.resources as Array<{
    icon: string;
    title: string;
    description: string;
    link: string;
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
            <p className="leading-none">Resources</p>
          </div>
          <p className="font-['Aeonik:Regular',sans-serif] text-[18px] text-white/70 leading-relaxed mt-4">
            Find key resources and support for your BuildGames journey
          </p>
        </div>

        {/* Resources Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          {resources.map((resource, index) => (
            <a
              key={index}
              href={resource.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative p-6 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[#66acd6]/20 backdrop-blur-sm hover:bg-[rgba(255,255,255,0.04)] transition-all duration-300 hover:border-[#66acd6]/40 hover:shadow-lg hover:shadow-cyan-500/10 cursor-pointer"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#66acd6]/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
              <div className="relative flex items-start gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-[#66acd6]/10 border border-[#66acd6]/20 flex-shrink-0">
                  <DynamicIcon
                    name={resource.icon as any}
                    size={24}
                    className="text-[#66acd6]"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-['Aeonik:Medium',sans-serif] font-medium text-white">
                      {resource.title}
                    </h3>
                    <ExternalLink className="text-[#66acd6] opacity-0 group-hover:opacity-100 transition-opacity" size={16} />
                  </div>
                  <p className="text-[15px] font-['Aeonik:Regular',sans-serif] text-white/70 leading-relaxed">
                    {resource.description}
                  </p>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
