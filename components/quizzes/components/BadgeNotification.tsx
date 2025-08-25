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
            // small delay for fade in
            const timer = setTimeout(() => {
              setShowFireworks(false);
              setIsModalOpen(false);
              handleModalClose();
            }, 15000);

            return () => clearTimeout(timer);
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
              <div className="flex flex-col items-center">
                <Image
                  src={badges[0]?.image_path || ""}
                  alt={"badge"}
                  width={100}
                  height={100}
                />
                <p className="text-sm text-gray-500 text-center mt-2">
                  {"You have been awarded with a new badge"}
                </p>
                <h3 className="text-lg font-bold text-center mt-2">
                  {badges[0]?.name}
                </h3>
              </div>
            ) : Array.isArray(badges) && badges.length > 1 ? (
              // Mostrar múltiples badges en mosaico
              <div className="flex flex-col items-center">
                <p className="text-sm text-gray-500 text-center mb-4">
                  {`You have been awarded with ${badges.length} new badges!`}
                </p>
                <div className="grid grid-cols-2 gap-4 max-w-md">
                  {badges.map((badge, index) => (
                    <div key={index} className="flex flex-col items-center">
                      <Image
                        src={badge.image_path}
                        alt={badge.name}
                        width={80}
                        height={80}
                      />
                      <p className="text-xs text-center mt-1 text-gray-600">
                        {badge.name}
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
        className="border border-red-500 z-50 w-[20%]! "
      />
    </div>
  );
};
