import Image from "next/image";
import { Separator } from "../ui/separator";
import Info from "./sections/Info";
import { Project } from "@/types/showcase";
import Gallery from "./sections/Gallery";
import Prices from "./sections/Prices";
import Description from "./sections/Description";
import TeamMembers from "./sections/TeamMembers";
import Resources from "./sections/Resources";

const project: Project = {
  id: "1",
  name: "BlockVote BlockVote BlockVote BlockVote BlockVote BlockVote BlockVote",
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
    name: "Avalanche Summit tatata",
    location: "LATAM AMERICA NORTE SUR CALLE OESTE AVENIDA ESTE",
    year: 2024,
  },
  tracks: ["GAMING", "DEFI", "GAMING", "DEFI", "GAMING", "DEFI", "GAMING", "DEFI", "GAMING", "DEFI", "GAMING", "DEFI"],
  gallery: ["/temp/project-overview-banner.png", "/temp/project-logo.png", "/temp/project-overview-banner.png", "/temp/project-logo.png", "/temp/project-overview-banner.png", "/temp/project-logo.png"],
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
  members: [
    {
      imgUrl: "/temp/andrea-vargas.jpg",
      name: "John Doe",
      role: "Lead Developer",
    },
    {
      imgUrl: "/temp/andrea-vargas.jpg",
      name: "John Doe",
      role: "Lead Developer",
    },
    {
      imgUrl: "/temp/andrea-vargas.jpg",
      name: "John Doe",
      role: "Lead Developer",
    },
    {
      imgUrl: "/temp/andrea-vargas.jpg",
      name: "John Doe",
      role: "Lead Developer",
    },
    {
      imgUrl: "/temp/andrea-vargas.jpg",
      name: "John Doe",
      role: "Lead Developer",
    },
    {
      imgUrl: "/temp/andrea-vargas.jpg",
      name: "John Doe",
      role: "Lead Developer",
    },
  ],
  resources: [
    {
      icon: "rss",
      title: "Websitesdas dadas",
      link: "linksito",
    },
    {
      icon: "rss",
      title: "Website",
      link: "linksito",
    },
    {
      icon: "rss",
      title: "Website",
      link: "linksito",
    },
  ],
};
export default function ProjectOverview() {
  return (
    <div>
      <Separator className="my-4 sm:my-8 bg-zinc-300 dark:bg-zinc-800" />
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
            className="absolute -bottom-6 sm:-bottom-20 lg:-bottom-32 left-4 sm:left-8 md:left-16 xl:left-24 w-12 h-12 sm:w-40 sm:h-40 lg:w-64 lg:h-64"
          />
        </div>
        <div className="mt-12 sm:mt-28 md:mt-40 flex flex-col gap-16">
          <Info project={project} />
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
          {project.description && (
            <Description description={project.description} />
          )}
          {project.members && <TeamMembers members={project.members} />}
          {project.resources && <Resources resources={project.resources} />}
        </div>
      </div>
    </div>
  );
}
