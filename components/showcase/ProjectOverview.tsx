import Image from "next/image";
import { Separator } from "../ui/separator";
import BlockVote from "./sections/BlockVote";
import { Project } from "@/types/showcase";
import Gallery from "./sections/Gallery";
import Prices from "./sections/Prices";

const project: Project = {
  id: "1",
  name: "BlockVote",
  isWinner: true,
  bannerUrl: "/temp/project-banner.png",
  logoUrl: "/temp/project-logo.png",
  shortDescription:
    "A decentralized and tamper-proof voting system leveraging blockchain technology to ensure fair elections.",
  description:
    "A decentralized and tamper-proof voting system leveraging blockchain technology to ensure transparency, security, and verifiability in elections. BlockVote enables real-time vote tracking while preserving voter privacy and integrity",
  liveDemoUrl: "dsads",
  sourceCodeUrl: "dsads",
  videoUrl: "dsads",
  event: {
    name: "Avalanche Summit",
    location: "LATAM",
    year: 2024,
  },
  tracks: ["GAMING", "DEFI"],
  gallery: ["/temp/project-overview-banner.png", "/temp/project-logo.png"],
  prices: [
    {
      icon: "",
      title: "$15,000",
      description: "Total award for this project",
    },
    {
      icon: "",
      title: "$15,000",
      description: "Total award for this project",
    },
    {
      icon: "",
      title: "$15,000",
      description: "Total award for this project",
    },
  ],
};
export default function ProjectOverview() {
  return (
    <div>
      <Separator className="my-8 bg-zinc-300 dark:bg-zinc-800" />
      <div className="px-6">
        <div className="relative">
          <Image
            src={project.bannerUrl}
            alt="project-banner"
            width={100}
            height={635}
            className="w-full"
          />
          <Image
            src={project.logoUrl}
            alt="project-banner"
            width={100}
            height={635}
            className="absolute -bottom-32 left-24 w-64 h-64"
          />
        </div>
        <div className="mt-40 flex flex-col gap-16">
          <BlockVote project={project} />
          {project.gallery && <Gallery projectGallery={project.gallery} />}
          {project.videoUrl && (
            <video
              width="320"
              height="816"
              controls
              preload="none"
              className="w-full"
            >
              <source src={project.videoUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          )}
          {project.prices && <Prices prices={project.prices} />}
        </div>
      </div>
    </div>
  );
}
