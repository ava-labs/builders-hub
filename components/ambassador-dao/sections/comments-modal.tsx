import {
  DialogContent,
  Dialog,
  DialogTitle,
} from "@/components/ambassador-dao/dialog";
import Image from "next/image";
import React, { useState } from "react";
import CustomButton from "../custom-button";
import { useRouter } from "next/navigation";
import { CommentsSection } from "./comment-section";

interface IProps {
  isOpen: boolean;
  onClose: () => void;
  id: string;
}

export const CommentsModal = ({ isOpen, onClose, id }: IProps) => {
  const onCloseModal = () => {
    onClose();
  };

  return (
    <div>
      <Dialog open={isOpen} onOpenChange={onCloseModal}>
        <DialogContent
          className='max-w-xl bg-[#fafafa] dark:bg-[#09090B]'
          showClose
        >
          <DialogTitle></DialogTitle>
          <CommentsSection id={id} />
        </DialogContent>
      </Dialog>
    </div>
  );
};
