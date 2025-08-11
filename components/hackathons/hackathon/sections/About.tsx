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
          <MDXRemote source={hackathon.content.tracks_text} />
        </div>
      </div>
    </section>
  );
}

export default About; 