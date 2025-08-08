import { useEffect, useRef, useState } from "react";
import { useBadgeAward } from "../hooks/useBadgeAward";
import Modal from "@/components/ui/Modal";
import { Fireworks } from "@fireworks-js/react";
import type { FireworksHandlers } from "@fireworks-js/react";
import { Badge } from "@/types/badge";
import Image from "next/image";
// components/quizzes/badge-notification.tsx
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
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [badge, setBadge] = useState<Badge | null>(null);

  useEffect(() => {
    if (isCompleted && session) {
      getBadge(courseId).then((badge) => {
        if (badge) {
          console.log("Badge obtenido", badge);
          setBadge(badge);
          awardBadge();
          console.log("Badge awarded");
          setShowFireworks(true);
          setIsModalOpen(true);
          // Pequeño delay para el fade in
          setTimeout(() => setIsModalVisible(true), 100);
          
          const timer = setTimeout(() => {
            setShowFireworks(false);
            setIsModalVisible(false);
          }, 5000);

          return () => clearTimeout(timer);
        }
      });
    }
  }, [isCompleted, session]);

  const handleModalClose = () => {
    setIsModalVisible(false);
    // Delay para permitir el fade out antes de cerrar
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
          <div className={`flex flex-col items-center justify-center transition-all duration-300 ease-in-out ${
            isModalVisible 
              ? 'opacity-100 scale-100' 
              : 'opacity-0 scale-95'
          }`}>
            <h3 className="text-lg font-bold text-center">
              {"Congratulations!"}
            </h3>
            <Image
              src={badge?.image_path || ""}
              alt={"badge"}
              width={100}
              height={100}
            />

            <p className="text-sm text-gray-500 text-center">
              {"You have been awarded with a new badge"}
            </p>
            <h3 className="text-lg font-bold text-center">{badge?.name}</h3>
          </div>
        }
        className="border border-red-500 z-50 w-[20%]! transition-all duration-300 ease-in-out"
      />
    </div>
  );
};
