import { Button } from "@/components/ui/button";
import Modal from "@/components/ui/Modal";
import { BadgeAlert } from "lucide-react";
import React from "react";

interface SignOutComponentProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export default function SignOutComponent({
  isOpen,
  onOpenChange,
  onConfirm,
}: SignOutComponentProps) {
  const content = (
    <div className="flex flex-col items-center gap-4 pb-4">
      <BadgeAlert color="rgb(239 68 68)" size="34" />
      <p className="text-red-600 dark:text-red-500 text-center text-base sm:text-lg">
        Are you sure you want to sign out?
      </p>
    </div>
  );

  const footer = (
    <>
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
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Sign Out"
      content={content}
      footer={footer}
      contentClassName="border border-red-500"
    />
  );
}
