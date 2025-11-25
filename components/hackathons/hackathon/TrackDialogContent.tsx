"use client";

import { Track } from "@/types/hackathons";
import { DynamicIcon } from "lucide-react/dynamic";
import React from "react";

type Props = {
  track: Track | null;
};

export default function TrackDialogContent({ track }: Props) {
  if (!track) return null;

  const formatDescription = (text: string) => {
    if (!text) return '';
    let formatted = text.replace(/\\n/g, '\n'); // Unescape \n
    formatted = formatted.replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold mt-6 mb-3 text-zinc-50">$1</h3>');
    formatted = formatted.replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold mt-8 mb-4 text-zinc-50">$1</h2>');
    formatted = formatted.replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold mt-8 mb-4 text-red-500">$1</h1>');
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-zinc-50">$1</strong>');
    formatted = formatted.replace(/\*(.*?)\*/g, '<em class="italic text-zinc-50">$1</em>');
    formatted = formatted.replace(/^---$/gim, '<hr class="my-6 border-red-500" />');
    formatted = formatted.replace(/\n\n/g, '</p><p class="mb-4 text-zinc-50">');
    formatted = formatted.replace(/\n/g, '<br/>');
    formatted = `<p class="mb-4 text-zinc-50">${formatted}</p>`;
    return formatted;
  };

  return (
    <div className="max-w-lg max-h-[80vh] mx-auto text-zinc-50 rounded-2xl overflow-auto">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-red-500 rounded-full">
          {track.logo && track.logo.trim() !== "" ? (
            <DynamicIcon name={track.logo as any} size={36} color="#F5F5F9" />
          ) : (
            <DynamicIcon name="wrench" size={36} color="#F5F5F9" />
          )}
        </div>
        <h1 className="text-3xl font-semibold m-0">{track.name}</h1>
      </div>
      <span className="block w-full h-[1px] my-8 bg-red-500"></span>
      <div className="prose text-zinc-50 prose-h1:text-red-500 overflow-y-auto">
        <div 
          dangerouslySetInnerHTML={{ 
            __html: formatDescription(track.description)
          }}
        />
      </div>
    </div>
  );
}
