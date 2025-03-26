import { Separator } from "@/components/ui/separator";
import { ProjectMember } from "@/types/showcase";
import Image from "next/image";

type Props = {
  members: ProjectMember[];
};

export default function TeamMembers({ members }: Props) {
  return (
    <div>
      <h2 className="text-2xl">Team</h2>
      <Separator className="my-8 bg-zinc-300 dark:bg-zinc-800" />
      <p className="text-lg">Meet the minds behind BlackVote</p>
      <div className="flex justify-center gap-8">
        {members.map((member, index) => (
          <div key={index} className="flex flex-col justify-center gap-4">
            <Image
              src={member.imgUrl}
              alt={member.name}
              width={150}
              height={150}
              className="w-40 h-40 rounded-full"
            />
            <div>
              <h3 className="text-center">{member.name}</h3>
              <p className="text-sm text-zinc-300 text-center">{member.role}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
