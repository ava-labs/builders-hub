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
import { EventsLang, t } from "@/lib/events/i18n";

interface ProjectMemberWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  hackathonId: string;
  setLoadData: (accepted: boolean) => void;
  lang?: EventsLang;
}

export const ProjectMemberWarningDialog: React.FC<ProjectMemberWarningDialogProps> = ({
  open,
  onOpenChange,
  projectName,
  hackathonId,
  setLoadData,
  lang = "en",
}) => {
  const router = useRouter();
  const { toast } = useToast();
  const wasActionTaken = useRef(false);

  useEffect(() => {
    if (open) {
      wasActionTaken.current = false;
    }
  }, [open]);

  const handleAcceptInvite = () => {
    wasActionTaken.current = true;
    setLoadData(true);
    onOpenChange(false);
  };

  const handleRejectInvite = () => {
    wasActionTaken.current = true;
    setLoadData(false);
    onOpenChange(false);
  };

  const handleClose = (open: boolean) => {
    if (!open && !wasActionTaken.current) {
      toast({
        title: t(lang, "invitation.invalid.redirecting"),
        description: t(lang, "invitation.join.redirectDesc"),
        duration: 3000,
      });
      setTimeout(() => {
        router.push(`/events/${hackathonId}`);
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
            onClick={() => onOpenChange(false)}
          >
            ✕
          </Button>
        </DialogClose>
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {t(lang, "invitation.warning.title")}
          </DialogTitle>
        </DialogHeader>
        <Card className="border border-red-500 dark:bg-zinc-800 rounded-md">
          <div className="flex flex-col px-4">
            <p className="text-md text-red-500">
              {t(lang, "invitation.warning.body", { projectName: projectName.toUpperCase() })}
            </p>
            <p className="text-md text-red-500">
              {t(lang, "invitation.warning.detail")}
            </p>
          </div>
          <div className="flex flex-row items-center justify-center gap-4 py-4">
            <Button
              onClick={handleAcceptInvite}
              type="button"
              className="dark:bg-white dark:text-black"
            >
              {t(lang, "invitation.warning.accept")}
            </Button>
            <Button
              onClick={handleRejectInvite}
              type="button"
              className="dark:bg-white dark:text-black"
            >
              {t(lang, "invitation.warning.reject")}
            </Button>
          </div>
        </Card>
      </DialogContent>
    </Dialog>
  );
};
