import { HackathonHeader } from "@/types/hackathons";
import React from "react";
import { Separator } from "@/components/ui/separator";
import { MDXRemote } from "next-mdx-remote/rsc";

function About({ hackathon }: { hackathon: HackathonHeader }) {
  return (
    <section>
      <h2 className="text-4xl font-bold mb-8" id="about">
        About
      </h2>
      <Separator className="my-8 bg-zinc-300 dark:bg-zinc-800" />
      <div className="pt-5 pb-5">
        <div className="prose prose-sm max-w-none dark:prose-invert">
          {hackathon.content?.tracks_text && (
            <MDXRemote source={hackathon.content.tracks_text} />
          )}
        </div>
      </div>
    </section>
  );
}

export function AboutPreview({ hackathon }: { hackathon: any }) {
  const formatMarkdownText = (text: string) => {
    if (!text) return '';
    let formatted = text.replace(/\\n/g, '\n');
    formatted = formatted.replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold mt-6 mb-3">$1</h3>');
    formatted = formatted.replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold mt-8 mb-4">$1</h2>');
    formatted = formatted.replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold mt-8 mb-4">$1</h1>');
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>');
    formatted = formatted.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
    formatted = formatted.replace(/^---$/gim, '<hr class="my-6 border-zinc-300 dark:border-zinc-700" />');
    formatted = formatted.replace(/\n\n/g, '</p><p class="mb-4">');
    formatted = formatted.replace(/\n/g, '<br/>');
    formatted = `<p class="mb-4">${formatted}</p>`;
    return formatted;
  };

  return (
    <section>
      <h2 className="text-4xl font-bold mb-8" id="about">
        About
      </h2>
      <div className="my-8 h-px bg-zinc-300 dark:bg-zinc-800"></div>
      <div className="pt-5 pb-5">
        <div className="prose prose-sm max-w-none dark:prose-invert">
          {hackathon.content?.tracks_text && (
            <div 
              dangerouslySetInnerHTML={{ 
                __html: formatMarkdownText(hackathon.content.tracks_text)
              }}
            />
          )}
        </div>
      </div>
    </section>
  );
}

export default About; 