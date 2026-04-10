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
import { EventsLang, t } from "@/lib/events/i18n";
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
  lang?: EventsLang;
}

export const JoinTeamDialog = ({
  open,
  onOpenChange,
  teamName,
  projectId,
  hackathonId,
  currentUserId,
  setLoadData,
  lang = "en",
}: JoinTeamDialogProps) => {
  const router = useRouter();
  const { toast } = useToast();
  const wasActionTaken = useRef(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (open) {
      wasActionTaken.current = false;
    }
  }, [open]);

  const handleAcceptJoinTeam = async () => {
    try {
      wasActionTaken.current = true;
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
      wasActionTaken.current = false;
    }
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
            {t(lang, "invitation.join.title")}
          </DialogTitle>
        </DialogHeader>
        <Card className="border border-red-500 dark:bg-zinc-800 rounded-md">
          <div className="flex flex-col px-4">
            <p className="text-md text-center dark:text-white text-gray-700">
              {t(lang, "invitation.join.body", { teamName })}
            </p>
          </div>
          <div className="flex flex-col items-center justify-center gap-4 py-4">
            <Button
              onClick={handleAcceptJoinTeam}
              className="dark:bg-white dark:text-black"
            >
              {t(lang, "invitation.join.cta")}
            </Button>
          </div>
        </Card>
      </DialogContent>
    </Dialog>
  );
};
