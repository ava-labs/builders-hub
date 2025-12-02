import { Separator } from "@/components/ui/separator";
import { Member } from "@/types/showcase";
import Image from "next/image";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import MemberBadge from "./MemberBadge";
import { UserBadge } from "@/types/badge";

type Props = {
  members: Member[];
  projectName: string;
  badges?: UserBadge[];
};

export default function TeamMembers({ members, projectName, badges }: Props) {

  return (
    <div>
      <h2 className="text-2xl font-bold">Team</h2>
      <Separator className="my-8 bg-zinc-300 dark:bg-zinc-800" />
      <p className="text-lg">Meet the minds behind {projectName}</p>
      
      <TooltipProvider>
        <div className="flex flex-wrap justify-center gap-8 mt-8">
          {members.filter((member) => member.status === "Confirmed").map((member, index) => (
            <Tooltip key={index} >
              <TooltipTrigger asChild>
                <div className="flex flex-col justify-center items-center gap-4  hover:scale-105 transition-transform duration-200">
                  <Image
                    src={member.user.image ?? ''}
                    alt={member.user.user_name ?? ''}
                    width={150}
                    height={150}
                    className="w-40 h-40 rounded-full"
                  />
                  <div>
                    <h3 className="text-center">{member.user.user_name}</h3>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 text-center">{member.role}</p>
                  </div>
                </div>
              </TooltipTrigger>
              
              <TooltipContent 
                side="top" 
                sideOffset={10}
                className="bg-zinc-900 dark:bg-zinc-100"
              >
              <MemberBadge badges={badges ?? []} member={member} />
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </div>
  );
}
