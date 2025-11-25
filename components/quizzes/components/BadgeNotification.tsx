import { useEffect, useRef, useState } from "react";
import { useBadgeAward } from "../hooks/useBadgeAward";
import Modal from "@/components/ui/Modal";
import { Fireworks } from "@fireworks-js/react";
import type { FireworksHandlers } from "@fireworks-js/react";
import { Badge } from "@/types/badge";
import Image from "next/image";
import { BadgeData } from "@/server/services/badge";

export const BadgeNotification = ({
  courseId,
  isCompleted,
}: {
  courseId: string;
  isCompleted: boolean;
}) => {
  const { session, awardBadge, getBadge } = useBadgeAward(courseId);
  const ref = useRef<FireworksHandlers>(null);
  const [showFireworks, setShowFireworks] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [badges, setBadges] = useState<BadgeData[]>([]);
  const badgeDefaultImage = "/wolfie/wolfie-hack.png";
  useEffect(() => {
    if (isCompleted && session) {
      awardBadge()
        .then((badge) => {

          if (
            badge.result &&
            Array.isArray(badge.result.badges) &&
            badge.result.badges.length > 0
          ) {

            setBadges(badge.result.badges);
            setShowFireworks(true);
            setIsModalOpen(true);

          }
        })
        .catch((error) => {
          console.error("Error awarding badge:", error);
        });
    }
  }, [isCompleted, session]);

  const handleModalClose = () => {
    // delay for fade out before closing
    setTimeout(() => {
      setIsModalOpen(false);
      setShowFireworks(false);
    }, 300);
  };

  return (
    <div className="relative">
      {showFireworks && (
        <div className="fixed inset-0 z-40 pointer-events-none">
          <Fireworks
            ref={ref}
            options={{ opacity: 0.5 }}
            style={{
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
            }}
          />
        </div>
      )}
      <Modal
        isOpen={isModalOpen}
        onOpenChange={handleModalClose}
        title={""}
        content={
          <div className={`flex flex-col items-center justify-center`}>
            <h3 className="text-lg font-bold text-center">
              {"Congratulations!"}
            </h3>

            {Array.isArray(badges) && badges.length === 1 ? (
              // Mostrar un solo badge
              <div className="flex flex-col items-center px-2 py-2  w-[250px]">
                <Image
                  src={badges[0]?.image_path || ""}
                  alt={"badge"}
                  width={100}
                  height={100}
                />
                <p className="text-base dark:text-zinc-400 text-gray-500 text-center mt-2">
                  {"You have been awarded with a new badge"}
                </p>
                <h3 className="text-base font-bold text-center mt-2">
                  {badges[0]?.name}
                </h3>
                <p className="text-base dark:text-zinc-400 text-gray-500 text-center mt-1">
                  {badges[0]?.completed_requirement.description}
                  {/* COMMENTED OUT: Points feature disabled */}
                  {/* : <span className="font-bold">{badges[0]?.completed_requirement.points} points</span> */}
                </p>
              </div>
            ) : Array.isArray(badges) && badges.length > 1 ? (
              // Mostrar múltiples badges en mosaico
              <div className="flex flex-col items-center">
                <p className="text-base text-gray-500 text-center mb-4">
                  {`You have been awarded with ${badges.length} new badges!`}
                </p>
                <div className={`grid ${badges.length > 2 ? 'grid-cols-3' : 'grid-cols-2'} gap-4 `}>
                  {badges.map((badge, index) => (
                    <div key={index} className="flex flex-col items-center px-2 py-2 gap-4 w-[250px]">
                      <Image
                        src={badge.image_path && badge.image_path != '' ? badge.image_path : badgeDefaultImage as string}
                        alt={badge.name}
                        width={80}
                        height={80}
                      />
                      <p className="text-base font-bold text-center mt-1">
                        {badge.name}
                      </p>
                      <p className="text-base dark:text-zinc-400 text-gray-500 text-center mt-1">
                        {badge.completed_requirement.description}
                        {/* COMMENTED OUT: Points feature disabled */}
                        {/* : <span className="font-bold">{badge.completed_requirement.points} points</span> */}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // No hay badges para mostrar
              <div className="flex flex-col items-center">
                <p className="text-sm text-gray-500 text-center">
                  No badges available
                </p>
              </div>
            )}
          </div>
        }
        className="z-50 inline-block!  w-auto! max-w-[75vw]! border border-red-500"
      />
    </div>
  );
};
