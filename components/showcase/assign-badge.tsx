import React, { useEffect, useState } from "react";
import Modal from "../ui/Modal";
import { Project } from "@/types/showcase";
import { MultiSelect } from "../ui/multi-select";
import axios from "axios";
import { Badge } from "@/types/badge";
import { BadgeCategory } from "@/server/services/badge";
import { useToast } from "@/hooks/use-toast";
import { LoadingButton } from "../ui/loading-button";
import { Toaster } from "../ui/toaster";
type showAssignBadgeProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
};
export const AssignBadge = ({
  isOpen,
  onOpenChange,
  project,
}: showAssignBadgeProps) => {
  const [optionsWithLabel, setOptionsWithLabel] = useState<
    { label: string; value: string }[]
  >([]);
  const { toast } = useToast();
  const [selectedBadges, setSelectedBadges] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    const fetchBadges = async () => {
      // COMMENTED OUT: Hackathon badges feature disabled
      // const response = await axios.get("/api/badge/get-all");
      // const filteredBadges = response.data.filter(
      //   (badge: Badge) => badge.category == "hackathon"
      // );
      // setOptionsWithLabel(
      //   filteredBadges.map((option: Badge) => ({
      //     label: option.name,
      //     value: option.id,
      //   }))
      // );
      // Return empty array since hackathon badges are disabled
      setOptionsWithLabel([]);
    };
    fetchBadges();
  }, []);

  const handleClose = () => {
    setSelectedBadges([]);
    setIsLoading(false);
    onOpenChange(false);
  };

  const handleAssignBadges = async () => {
    setIsLoading(true);
    const response = await axios.post("/api/badge/assign", {
      badgesId: selectedBadges,
      projectId: project.id,
      category: BadgeCategory.project,
    });
    if (response.status == 200) {
      toast({
        title: "Badges assigned successfully",
        description: "The badges have been assigned to the project",
        duration: 3000,
      });
    } else {
      toast({
        title: "Failed to assign badges",
        description: "The badges have not been assigned to the project",
        variant: "destructive",
        duration: 3000,
      });
    }
    handleClose();
  };

  const multiSelectCard = (
    <div className="flex flex-col gap-2">
      <Toaster />
      <MultiSelect
        options={optionsWithLabel}
        selected={selectedBadges}
        onChange={(values: string[]) => {
          setSelectedBadges(values);
        }}
      />
      <LoadingButton
        isLoading={isLoading}
        disabled={selectedBadges.length == 0}
        onClick={() => {
          handleAssignBadges();
        }}
      >
        Assign Badges
      </LoadingButton>
    </div>
  );

  return (
    <>
      <Modal
        isOpen={isOpen}
        onOpenChange={(event: boolean) => {
          onOpenChange(event);
          if (!event) {
            handleClose();
          }
        }}
        title="Assign Badge"
        className="border-red-500"
        content={
          <div onPointerDownCapture={(e) => e.stopPropagation()}>
            {multiSelectCard}
          </div>
        }
      />
    </>
  );
};
