import Modal from "@/components/ui/Modal";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { Button } from "@/components/ui/button";

interface UserNotRegisteredProps {
  hackathonId: string;
  onToggle: (open: boolean) => void;
}

export const UserNotRegistered = ({
  hackathonId,
  onToggle,
}: UserNotRegisteredProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();
  const currentUser = session?.user;

  const lookForRegistration = async () => {
    if (!hackathonId || !currentUser?.email) return;
    const loadedData = await apiFetch(
      `/api/register-form?hackathonId=${hackathonId}&email=${currentUser?.email}`
    );
    if (loadedData) {
      onToggle(true);
      return;
    }
    onToggle(false);
    setIsOpen(true);
    setTimeout(() => {
      router.push(
        `/events/registration-form?event=${hackathonId}&utm=invitation-link`
      );
    }, 4000);
  };

  useEffect(() => {
    lookForRegistration();
  }, [hackathonId, currentUser?.email]);

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      title="Complete registration form"
      className="border border-red-500"
      description="Please fill your registration form to continue."
      footer={
        <div className="flex gap-3 w-full">
          <Button onClick={() => setIsOpen(false)} className="flex-1">
            Continue
          </Button>
        </div>
      }
    />
  );
};
