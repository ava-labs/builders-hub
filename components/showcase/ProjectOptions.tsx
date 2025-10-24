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
import {
  AlertDialog,
  AlertDialogFooter,
  AlertDialogDescription,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
  AlertDialogAction,
} from "../ui/alert-dialog";
import axios from "axios";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "../ui/toaster";
import { AssignBadge } from "./assign-badge";

export const ProjectOptions = ({
  project,
  confirmOpen,
  setConfirmOpen,
  isAssignBadgeOpen,
  setIsAssignBadgeOpen,
}: Props & {
  confirmOpen: boolean;
  setConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAssignBadgeOpen: boolean;
  setIsAssignBadgeOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { toast } = useToast();
  const handleSetWinner = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const response = await axios.put(`/api/project/set-winner`, {
      project_id: project.id,
      isWinner: true,
    });

    if (response.data.success) {
      toast({
        title: "Project winner set successfully",
        description: "The project has been marked as the winner",
        duration: 3000,
      });
    } else {
      toast({
        title: "Failed to set project winner",
        description: "Unable to mark project as winner. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    }
    setConfirmOpen(false);
  };

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
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
            }}
            onSelect={(e) => {
              e.stopPropagation();
              setIsDropdownOpen(false);
              setConfirmOpen(true);
            }}
          >
            Set Winner
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
            }}
            onSelect={(e) => {
              setIsDropdownOpen(false);
              handleAssignBadge(e as any);
            }}
          >
            Assign Badge
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent onPointerDownCapture={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Winner?</AlertDialogTitle>
            <AlertDialogDescription>
              Do you want to mark "{project.project_name}" as winner? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.stopPropagation();
                handleSetWinner(e);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AssignBadge
        isOpen={isAssignBadgeOpen}
        onOpenChange={setIsAssignBadgeOpen}
        project={project}
      />
    </>
  );
};
