import Modal from "@/components/ui/Modal";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { set } from "date-fns";

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
    const response = await axios.get(
      `/api/register-form?hackathonId=${hackathonId}&email=${currentUser?.email}`
    );
    const loadedData = response.data;
    if (loadedData) {
      onToggle(true);
      return;
    }
    onToggle(false);
    setIsOpen(true);
    setTimeout(() => {
      router.push(
        `/hackathons/registration-form?hackathon=${hackathonId}&utm=invitation-link`
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
