'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useRouter } from "next/navigation";
import axios from 'axios';

interface ProjectMemberWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  hackathonId: string;
  setLoadData: (accepted: boolean) => void;
}

export const ProjectMemberWarningDialog: React.FC<ProjectMemberWarningDialogProps> = ({
  open,
  onOpenChange,
  projectName,
  hackathonId,
  setLoadData
}) => {
    const router = useRouter();


    function closeDialog(){
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
            Project Member Warning
          </DialogTitle>
        </DialogHeader>
        <Card className="border border-red-500 dark:bg-zinc-800 rounded-md">
          <div className="flex flex-col px-4">
            <p className="text-md  text-red-500">
              You are currently a member of {projectName}. If you accept this invitation, you will be removed from your current project and will no longer have access to its information.
            </p>
          </div>
          <div className="flex flex-col items-center justify-center gap-4 py-2">

            <Button
              onClick={() => setLoadData(true)}
              type="button"
              className="dark:bg-white dark:text-black"
            >
              Continue
            </Button>
          </div>
        </Card>
      </DialogContent>
    </Dialog>
  );
}; 