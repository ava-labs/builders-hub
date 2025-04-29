"use client";

import React from "react";
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

  function closeDialog() {
    router.push(`/hackathons/${hackathonId}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton={true}
        className="dark:bg-zinc-900 dark:text-white rounded-lg p-6 w-full max-w-md border border-zinc-400 px-4"
      >
        <DialogClose asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-6 right-4 dark:text-white hover:text-red-400 p-0 h-6 w-6"
            onClick={closeDialog}
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
              You are currently a member of {projectName}.
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
              onClick={() => setLoadData(true)}
              type="button"
              className="dark:bg-white dark:text-black"
            >
              Accept invite
            </Button>

            <Button
              onClick={() => setLoadData(false)}
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
