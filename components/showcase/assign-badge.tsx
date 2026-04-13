import { useEffect, useState, useMemo } from "react";
import Modal from "../ui/Modal";
import { Project } from "@/types/showcase";
import { MultiSelect } from "../ui/multi-select";
import { Badge } from "@/types/badge";
import { BadgeCategory } from "@/server/services/badge";
import { useToast } from "@/hooks/use-toast";
import { LoadingButton } from "../ui/loading-button";
import { Toaster } from "../ui/toaster";
import { apiFetch } from "@/lib/api/client";

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

  // Memoize badge IDs to prevent unnecessary re-fetches
  const assignedBadgeIds = useMemo(
    () => project.badges?.map(b => b.badge_id) || [],
    [project.badges]
  );

  useEffect(() => {
    // Only fetch badges when modal is opened
    if (!isOpen) return;

    const fetchBadges = async () => {
      const data = await apiFetch<Badge[]>("/api/badge/get-all");
      const filteredBadges = data.filter(
        (badge: Badge) => badge.category == "hackathon"
      );

      // Filter out badges that are already assigned
      const availableBadges = filteredBadges.filter(
        (badge: Badge) => !assignedBadgeIds.includes(badge.id)
      );

      setOptionsWithLabel(
        availableBadges.map((option: Badge) => ({
          label: option.name,
          value: option.id,
        }))
      );
    };
    fetchBadges();
  }, [isOpen, project.id, assignedBadgeIds]);

  const handleClose = () => {
    setSelectedBadges([]);
    setIsLoading(false);
    onOpenChange(false);
  };

  const handleAssignBadges = async () => {
    setIsLoading(true);
    try {
      await apiFetch("/api/badge/assign", {
        method: "POST",
        body: {
          badgesId: selectedBadges,
          projectId: project.id,
          category: BadgeCategory.project,
        },
      });
      toast({
        title: "Badges assigned successfully",
        description: "The badges have been assigned to the project",
        duration: 3000,
      });
    } catch {
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
