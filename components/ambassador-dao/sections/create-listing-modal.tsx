import {
  DialogContent,
  Dialog,
  DialogTitle,
} from "@/components/ambassador-dao/dialog";
import Image from "next/image";
import React, { useState } from "react";
import Avalance3d from "@/public/images/avalance3d.svg";
import CustomButton from "../custom-button";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness, Lightbulb } from "lucide-react";

interface ICreateListingProps {
  isOpen: boolean;
  onClose: () => void;
}

const listingTypes = [
  {
    name: "Job",
    id: "JOB",
    title: "Hire a Freelancer",
    description:
      "Get applications based on a questionnaire set by you, and select one applicant to work with. Give a fixed budget, or ask for quotes.",
  },
  {
    name: "Bounty",
    id: "BOUNTY",
    title: "Host a Work Competition",
    description:
      "All participants complete your scope of work, and the best submission(s) are rewarded. Get multiple options to choose from.",
  },
];
export const CreateListingModal = ({
  isOpen,
  onClose,
}: ICreateListingProps) => {
  const [listingType, setListingType] = useState<"JOB" | "BOUNTY">("JOB");

  const onCloseModal = () => {
    onClose();
    setListingType("JOB");
  };

  const router = useRouter();

  const handleContinue = (type: "JOB" | "BOUNTY") => {
    setListingType(type);
    onClose();
    router.push("/ambassador-dao/sponsor/create?type=" + type);
  };

  return (
    <div>
      <Dialog open={isOpen} onOpenChange={onCloseModal}>
        <DialogContent
          className='max-w-5xl bg-[#fafafa] dark:bg-[#09090B]'
          showClose
        >
          <DialogTitle></DialogTitle>
          <div className='w-full flex flex-col md:flex-row gap-8 md:gap-6 pt-6 pb-2'>
            {listingTypes.map((type, idx) => (
              <div
                key={idx}
                className={`rounded-xl border border-[var(--default-border-color)] bg-[var(--default-background-color)] p-6 flex-1 cursor-pointer space-y-4
                  ${
                    listingType === type.id.toUpperCase()
                      ? "border-[#FB2C36]"
                      : ""
                  }
                `}
                onClick={() => setListingType(type.id.toUpperCase() as any)}
              >
                <div className='bg-zinc-200 dark:bg-[#000] rounded-md h-36 md:h-44 relative overflow-hidden'>
                  <Image
                    src={Avalance3d}
                    objectFit='contain'
                    alt='avalance icon'
                    className='absolute object-cover right-0 h-full'
                  />

                  <div className='px-6 py-1 bg-[#460809] border border-red-500 rounded-full flex items-center gap-2 justify-between absolute top-2 right-2 z-20'>
                    {type.id === "JOB" ? (
                      <BriefcaseBusiness className='w-4 h-4' color='white' />
                    ) : (
                      <Lightbulb className='w-4 h-4' color='white' />
                    )}

                    <p className='text-sm font-medium capitalize'>
                      {type.id.toLowerCase()}
                    </p>
                  </div>
                </div>

                <div className='text-[var(--primary-text-color)]'>
                  <p className='font-medium text-xl md:text-2xl mb-2'>
                    {type.title}
                  </p>
                  <p className='font-light'>{type.description}</p>
                </div>

                <CustomButton
                  variant='danger'
                  onClick={() => handleContinue(type.id.toUpperCase() as any)}
                  className='px-6 h-10 text-sm font-medium mt-4'
                >
                  <p>
                    Create A <span className='capitalize'>{type.name}</span>
                  </p>
                </CustomButton>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
