"use client";

import React, { useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";

interface ProjectMemberWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  hackathonId: string;
  setLoadData: (accepted: boolean) => void;
}

export const ProjectMemberWarningDialog: React.FC<
  ProjectMemberWarningDialogProps
> = ({ open, onOpenChange, projectName, hackathonId, setLoadData }) => {
  const router = useRouter();
  const { toast } = useToast();
  const wasActionTaken = useRef(false);

  // Reset the flag when modal opens
  useEffect(() => {
    if (open) {
      wasActionTaken.current = false;
    }
  }, [open]);

  const handleAcceptInvite = () => {
    wasActionTaken.current = true; // Mark that an action was taken
    setLoadData(true);
    onOpenChange(false);
  };

  const handleRejectInvite = () => {
    wasActionTaken.current = true; // Mark that an action was taken
    setLoadData(false);
    onOpenChange(false);
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
            Project Membership Warning
          </DialogTitle>
        </DialogHeader>
        <Card className="border border-red-500 dark:bg-zinc-800 rounded-md">
          <div className="flex flex-col px-4">
            <p className="text-md  text-red-500">
              You are currently a member of <b>{projectName.toUpperCase()}</b>.
            </p>
            <p className="text-md  text-red-500">
              If you accept this invitation, you will be removed from your
              current project and will lose all access to its information.
              <br />
              If you are the only member of your current project, accepting this
              invitation will result in the permanent deletion of that project.
            </p>
          </div>
          <div className="flex flex-row items-center justify-center gap-4 py-4">

            <Button
              onClick={handleAcceptInvite}
              type="button"
              className="dark:bg-white dark:text-black"
            >
              Accept invite
            </Button>

            <Button
              onClick={handleRejectInvite}
              type="button"
              className="dark:bg-white dark:text-black"
            >
              Reject invite
            </Button>
          </div>
        </Card>
      </DialogContent>
    </Dialog>
  );
};
