import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import React from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";

interface ProcessCompletedDialogProps {
  hackathon_id: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}
export default function ProcessCompletedDialog(
  params: ProcessCompletedDialogProps
) {
  const router = useRouter();
  const content = (
    <Card
      className="my-4 w-[95%] sm:w-[85%] md:w-full max-h-[190px]
                        rounded-md p-4 sm:p-6 gap-4 mx-auto
                        text-black dark:bg-zinc-800 dark:text-white
                        border border-red-500"
    >
      <CardContent className="w-full max-w-xs sm:max-w-sm md:max-w-md mx-auto p-4">
        Your application will be reviewed by the AvaLabs staff. We will notify
        you if you have been approved or not.
      
        <CardFooter className="flex flex-col gap-2 w-full sm:flex-row sm:gap-4 sm:justify-center">
        <Button
          onClick={() => {
            router.push(`/hackathons/${params.hackathon_id}`);
          }}
          className="mt-4"
        >
          OK
        </Button>
        </CardFooter>
      </CardContent>
    </Card>
  );
  return (
    <Modal
      isOpen={params.isOpen}
      onOpenChange={params.onOpenChange}
      title="Application Submitted"
      content={content}
      className="border border-red-500"
    />
  );
}
