import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

interface JoinTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setLoadData?: (accepted: boolean) => void;
  teamName: string;
  projectId: string;
  hackathonId: string;
  currentUserId?: string;
}

export const JoinTeamDialog = ({
  open,
  onOpenChange,
  teamName,
  projectId,
  hackathonId,
  currentUserId,
  setLoadData
}: JoinTeamDialogProps) => {
  const router = useRouter();
  const { toast } = useToast();
  const wasActionTaken = useRef(false);
  const searchParams = useSearchParams();
  // Reset the flag when modal opens
  useEffect(() => {
    if (open) {
      wasActionTaken.current = false;
    }
  }, [open]);

  const handleAcceptJoinTeam = async () => {
    try {
      wasActionTaken.current = true; // Mark that an action was taken
      const response = await axios.patch(`/api/project/${projectId}/members/status`, {
        user_id: currentUserId,
        status: "Confirmed",
      });
      
      if (response.status === 200) {

        if (setLoadData) {
          const params = new URLSearchParams(searchParams.toString());
          params.delete("invitation");
          setLoadData(true);
        }
      }
      
      onOpenChange(false);
      
    } catch (error) {
      console.error("Error updating status:", error);
      // Reset the flag if there was an error so the toast can still show
      wasActionTaken.current = false;
    }
  };

  const handleClose = (open: boolean) => {
    // If modal is closing and no action was taken, show toast and redirect
    if (!open && !wasActionTaken.current) {
      toast({
        title: "Redirecting...",
        description: "You will be redirected to hackathon",
        duration: 3000,
      });
      
      // Small delay to show the toast before redirecting
      setTimeout(() => {
        router.push(`/hackathons/${hackathonId}`);
      }, 1000);
    }
    
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        hideCloseButton={true}
        className="dark:bg-zinc-900 dark:text-white rounded-lg p-6 w-full max-w-md border border-zinc-400 px-4"
      >
        <DialogClose asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-6 right-4 dark:text-white hover:text-red-400 p-0 h-6 w-6"
            onClick={() => {
              // This will trigger handleClose with open=false
              onOpenChange(false);
            }}
          >
            ✕
          </Button>
        </DialogClose>
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Join Your Team
          </DialogTitle>
        </DialogHeader>
        <Card className="border border-red-500 dark:bg-zinc-800 rounded-md">
          <div className="flex flex-col px-4">
            <p className="text-md text-center dark:text-white text-gray-700">
              You&apos;ve been invited to join <b>{teamName}</b>.
            </p>
          </div>

          <div className="flex flex-col items-center justify-center gap-4 py-4">
            <Button
              onClick={handleAcceptJoinTeam}
              className="dark:bg-white dark:text-black"
            >
              Accept &amp; Join Team
            </Button>
          </div>
        </Card>
      </DialogContent>
    </Dialog>
  );
}; 