import React, { useState } from "react";
import { Props } from "./ProjectCard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { EllipsisVertical } from "lucide-react";
import { Toaster } from "../ui/toaster";
import { AssignBadge } from "./assign-badge";
import { useRouter } from "next/navigation";

export const ProjectOptions = ({
  project,
  isAssignBadgeOpen,
  setIsAssignBadgeOpen,
  isFromProfile = false,
}: Props & {
  isAssignBadgeOpen: boolean;
  setIsAssignBadgeOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isFromProfile?: boolean;
}) => {
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleAssignBadge = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsAssignBadgeOpen(true);
  };

  return (
    <>
      <Toaster />
      <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="h-auto w-auto p-1 mr-0 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full transition-colors"
          >
            <EllipsisVertical size={20} />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          side="bottom"
          className="w-48 z-[9999]"
          onPointerDownCapture={(e) => e.stopPropagation()}
        >
          {isFromProfile ? (
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
              }}
              onSelect={(e) => {
                e.stopPropagation();
                setIsDropdownOpen(false);
                router.push(`/hackathons/project-submission?project=${project.id}`);
              }}
            >
              Edit
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
              }}
              onSelect={(e) => {
                e.stopPropagation();
                setIsDropdownOpen(false);
                handleAssignBadge(e as any);
              }}
            >
              Assign Badge
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AssignBadge
        isOpen={isAssignBadgeOpen}
        onOpenChange={setIsAssignBadgeOpen}
        project={project}
      />
    </>
  );
};
