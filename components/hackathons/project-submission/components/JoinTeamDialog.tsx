import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import axios from "axios";
import { useRouter } from "next/navigation";

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

  const handleAcceptJoinTeam = async () => {
    try {
      axios.patch(`/api/project/${projectId}/members/status`, {
        user_id: currentUserId,
        status: "Confirmed",
      })
        .then(() => {
          console.log("Status updated successfully");
        })
        .catch((error) => {
          console.error("Error updating status:", error);
        });
      onOpenChange(false);
      if(setLoadData){
        setLoadData(true);
      }
      
    } catch (error) {
      console.error("Error joining team:", error);
    }
  };

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
            onClick={() => {
              router.push(`/hackathons/${hackathonId}`);
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
          <div className="flex flex-col px-6">
            <p className="text-md dark:text-white text-gray-700">
              You&apos;ve been invited to join {teamName}. Accept the invitation
              to collaborate with your team.
            </p>
          </div>

          <div className="flex flex-col items-center justify-center gap-4 py-6">
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