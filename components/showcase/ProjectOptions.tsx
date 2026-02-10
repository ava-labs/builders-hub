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
import { useRouter } from "next/navigation";

export const ProjectOptions = ({
  project,
  confirmOpen,
  setConfirmOpen,
  isAssignBadgeOpen,
  setIsAssignBadgeOpen,
  isFromProfile = false,
}: Props & {
  confirmOpen: boolean;
  setConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAssignBadgeOpen: boolean;
  setIsAssignBadgeOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isFromProfile?: boolean;
}) => {
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { toast } = useToast();
  const handleSetWinner = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
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
        router.refresh();
      } else if (response.data.alreadyWinner) {
        toast({
          title: "Project is already a winner",
          description: "This project has already been marked as winner.",
          variant: "default",
          duration: 3000,
        });
      } else {
        toast({
          title: "Failed to set project winner",
          description: response.data.message || "Unable to mark project as winner. Please try again.",
          variant: "destructive",
          duration: 3000,
        });
      }
    } catch (error: any) {
      console.error("Error setting winner:", error);
      
      // Handle API error responses (401, 403, etc.)
      if (error.response?.data) {
        const errorData = error.response.data;
        const errorTitle = errorData.error || "Error";
        const errorMessage = errorData.message || "An error occurred while setting the project as winner.";
        
        // Special handling for authorization errors
        if (error.response.status === 401) {
          toast({
            title: "Authentication Required",
            description: errorMessage,
            variant: "destructive",
            duration: 5000,
          });
        } else if (error.response.status === 403) {
          toast({
            title: "Access Denied",
            description: errorMessage,
            variant: "destructive",
            duration: 5000,
          });
        } else {
          toast({
            title: errorTitle,
            description: errorMessage,
            variant: "destructive",
            duration: 3000,
          });
        }
      } else {
        // Network or other errors
        toast({
          title: "Connection Error",
          description: "Unable to connect to the server. Please check your internet connection.",
          variant: "destructive",
          duration: 3000,
        });
      }
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
          className="w-48 z-9999"
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
            <>
              {!project.is_winner ? (
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
              ) : 
              (<DropdownMenuItem
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
                </DropdownMenuItem>)
              }
            </>
          )}
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
