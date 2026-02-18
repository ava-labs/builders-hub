"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { ExternalLink } from 'lucide-react';
import { DynamicIcon } from 'lucide-react/dynamic';

interface Resource {
  icon: string;
  title: string;
  description: string;
  link: string;
}

export default function BuildGamesResourcesWrapper() {
  const { status } = useSession();
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Only fetch when authenticated
    if (status !== "authenticated") {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetch("/api/build-games/resources")
      .then((res) => res.json())
      .then((data) => {
        if (data.hasAccess && data.resources) {
          setResources(data.resources);
        }
      })
      .catch((error) => {
        console.error("Error fetching resources:", error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [status]);

  // Don't render if not authenticated, no resources, or still loading
  if (status === "loading" || isLoading || resources.length === 0) {
    return null;
  }

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

        {/* Resources List */}
        <div className="flex flex-col divide-y divide-white/5 w-full">
          {resources.map((resource, index) => (
            <a
              key={index}
              href={resource.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative px-4 py-3 hover:bg-[rgba(102,172,214,0.05)] transition-all duration-200 cursor-pointer first:pt-0 last:pb-0"
            >
              <div className="flex items-center gap-3">
                <DynamicIcon
                  name={resource.icon as any}
                  size={16}
                  className="text-[#66acd6]/70 group-hover:text-[#66acd6] transition-colors flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[14px] font-['Aeonik:Medium',sans-serif] text-white group-hover:text-[#66acd6] transition-colors">
                      {resource.title}
                    </span>
                    <span className="text-[13px] font-['Aeonik:Regular',sans-serif] text-white/50">
                      {resource.description}
                    </span>
                  </div>
                </div>
                <ExternalLink className="text-white/30 group-hover:text-[#66acd6] transition-colors flex-shrink-0" size={14} />
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
