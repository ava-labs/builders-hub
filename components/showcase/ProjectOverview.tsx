import Image from "next/image";
import { Separator } from "../ui/separator";
import Info from "./sections/Info";
import Gallery from "./sections/Gallery";
import Prices from "./sections/Prices";
import Description from "./sections/Description";
import TeamMembers from "./sections/TeamMembers";
import { Project} from "@/types/showcase";
import VideoRenderer from "./DemoVideoRenderer";

type Props = {
  project: Project;
};
export default function ProjectOverview({ project }: Props) {
  return (
    <div>
      <Separator className="my-4 sm:my-8 bg-zinc-300 dark:bg-zinc-800" />
      <div className="px-6">
        {project.cover_url && project.logo_url && (
          <div className="relative">
            <Image
              src={project.cover_url}
              alt="project-banner"
              width={100}
              height={635}
              className="w-full"
            />
            <Image
              src={project.logo_url}
              alt="project-banner"
              width={100}
              height={635}
              className="absolute -bottom-6 sm:-bottom-20 lg:-bottom-32 left-4 sm:left-8 md:left-16 xl:left-24 w-12 h-12 sm:w-40 sm:h-40 lg:w-64 lg:h-64"
            />
          </div>
        )}
        <div className="mt-12 sm:mt-28 md:mt-40 flex flex-col gap-16">
          <Info project={project} />
          {project.screenshots && (
            <Gallery projectGallery={project.screenshots} />
          )}
          {project.demo_video_link && (
            <VideoRenderer link={project.demo_video_link} />
          )}

          {project.prices && <Prices prices={project.prices} />}
          {project.full_description && (
            <Description description={project.full_description} />
          )}
          {project.members && (
            <TeamMembers
              members={project.members}
              projectName={project.project_name}
            />
          )}
          {/* {resources && <Resources resources={resources} />} */}
        </div>
      </div>
    </div>
  );
}
