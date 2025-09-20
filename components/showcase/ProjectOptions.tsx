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

export const ProjectOptions = ({
  project,
  confirmOpen,
  setConfirmOpen,
}: Props & {
  confirmOpen: boolean;
  setConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleSetWinner = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log("Set Winner clicked for project:", project.id);
    setConfirmOpen(false);
  };

  const handleAssignBadge = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <>
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
            onSelect={(e) => {
              e.preventDefault();
              e.stopPropagation();
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
                e.stopPropagation(); // no navega el Card
                handleSetWinner(e);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
