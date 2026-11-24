import React from "react";
import { videoEmbed } from "@/lib/hackathons/project-links";

type Props = {
  link: string;
};

export default function VideoRenderer({ link }: Props) {
  const video = videoEmbed(link);
  if (!video) return null;

  if (video.kind === "frame") {
    return (
      <iframe
        className="w-full aspect-video"
        src={video.src}
        title="Embedded video player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  return (
    <video width="320" height="816" controls preload="none" className="w-full">
      <source src={video.src} type="video/mp4" />
      Your browser does not support the video tag.
    </video>
  );
}
