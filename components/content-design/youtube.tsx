import type { NextPage } from "next";
import { YouTubeEmbed } from "@next/third-parties/google";
import styles from "./youtube.module.css";

interface YoutubeProps {
  id: string;
  params: string;
  fullSize: boolean;
}

const YouTube: NextPage<YoutubeProps> = ({ id, params = "", fullSize = true }) => {
  if (!fullSize) return <YouTubeEmbed videoid={id} width={560} height={315} params={params} />;
  return (
    <div className={`aspect-video w-full ${styles.youtube_father}`}>
      <YouTubeEmbed videoid={id} params={params} />
    </div>
  );
};

export default YouTube;
