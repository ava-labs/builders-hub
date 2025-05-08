import { Button } from "@/components/ui/button";
<<<<<<< HEAD
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BadgeAlert } from "lucide-react";
import React from "react";
=======
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { LoadingButton } from "@/components/ui/loading-button";
import Modal from "@/components/ui/Modal";
import { BadgeAlert } from "lucide-react";
import React, { useState } from "react";
>>>>>>> upstream/master

interface SignOutComponentProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
<<<<<<< HEAD
  onConfirm: () => void;
=======
  onConfirm: () => void | Promise<void>;
>>>>>>> upstream/master
}

export default function SignOutComponent({
  isOpen,
  onOpenChange,
  onConfirm,
}: SignOutComponentProps) {
<<<<<<< HEAD
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          w-[95%] max-w-[450px] sm:w-[85%] sm:max-w-[500px] md:w-[70vw] md:max-w-[550px]
          border border-red-500 p-4 sm:p-6 gap-4 rounded-lg mx-auto
          bg-white text-black dark:bg-zinc-900 dark:text-white
          [&>button>svg]:text-zinc-500 dark:[&>button>svg]:text-zinc-400
          [&>button>svg:hover]:text-zinc-700 dark:[&>button>svg:hover]:text-zinc-300
          [&>button>svg]:w-7 [&>button>svg]:h-7
        "
      >
        <DialogHeader>
          <DialogTitle className="text-center sm:text-left">
            Sign Out
          </DialogTitle>
          <DialogClose />
        </DialogHeader>

        <Card
          className="
            my-4 border border-red-500
            w-[95%] sm:w-[85%] md:w-full max-h-[190px]
            rounded-md p-4 sm:p-6 gap-4 mx-auto
             text-black dark:bg-zinc-800 dark:text-white
          "
        >
          <div className="flex flex-col items-center gap-4 pb-4">
            <BadgeAlert color="rgb(239 68 68)" size="34" />
            <DialogDescription className="text-red-600 dark:text-red-500 text-center text-base sm:text-lg">
              Are you sure you want to sign out?
            </DialogDescription>
          </div>

          <DialogFooter className="flex flex-col gap-2 w-full sm:flex-row sm:gap-4 sm:justify-center">
            <Button
              variant="ghost"
              onClick={onConfirm}
              className="
                w-full sm:w-auto px-4 py-2
    bg-red-500 text-white hover:bg-red-600
    dark:bg-red-600 dark:hover:bg-red-700
    transition-colors cursor-pointer
              "
            >
              Yes, Sign Out
            </Button>

            <Button
              variant="secondary"
              className="
                w-full sm:w-auto px-4 py-2 underline
                text-black dark:text-white hover:no-underline cursor-pointer
              "
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </Card>
      </DialogContent>
    </Dialog>
=======
  const [isConfirm, setIsConfirm] = useState(false);
  const handleConfirm = async () => {
    setIsConfirm(true);
    try {
      await Promise.all([
        onConfirm(),
        new Promise((resolve) => setTimeout(resolve, 300)), 
      ]);
      onOpenChange(false); 
    } finally {
      setIsConfirm(false);
    }
  };
  const content = (
    <Card
      className="
              my-4 w-[95%] sm:w-[85%] md:w-full max-h-[190px]
              rounded-md p-4 sm:p-6 gap-4 mx-auto
              text-black dark:bg-zinc-800 dark:text-white
              border border-red-500
            "
    >
      <CardContent className="flex flex-col items-center gap-4 pb-4">
        <BadgeAlert color="rgb(239 68 68)" size="34" />
        <p className="text-red-600 dark:text-red-500 text-center text-base sm:text-lg">
          Are you sure you want to sign out?
        </p>
      </CardContent>
      <CardFooter className="flex flex-col gap-2 w-full sm:flex-row sm:gap-4 sm:justify-center">
        <LoadingButton
        isLoading={isConfirm}
        onClick={handleConfirm}
        loadingText="Signing Out..."
         className="w-full sm:w-auto px-4 py-2 cursor-pointer"
        >
          Yes, Sign Out
        </LoadingButton>

        <Button
          variant="ghost"
          className="
          w-full sm:w-auto px-4 py-2 underline
           cursor-pointer
        "
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
      </CardFooter>
    </Card>
  );

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Sign Out"
      content={content}
      className="border border-red-500"
    />
>>>>>>> upstream/master
  );
}
