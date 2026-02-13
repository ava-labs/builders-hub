"use client";

import { useRef } from "react";
import { useConsoleBadgeNotificationStore } from "@/stores/consoleBadgeNotificationStore";
import Modal from "@/components/ui/Modal";
import { Fireworks } from "@fireworks-js/react";
import type { FireworksHandlers } from "@fireworks-js/react";
import Image from "next/image";

export function ConsoleBadgeNotification() {
  const { pendingBadges, dismissAll } = useConsoleBadgeNotificationStore();
  const ref = useRef<FireworksHandlers>(null);

  const isOpen = pendingBadges.length > 0;

  const handleClose = () => {
    dismissAll();
  };

  if (!isOpen) return null;

  return (
    <>
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
      <Modal
        isOpen={isOpen}
        onOpenChange={handleClose}
        title=""
        className="z-50 inline-block! w-auto! max-w-[75vw]!"
        content={
          <div className="flex flex-col items-center justify-center">
            <h3 className="text-lg font-bold text-center">
              Console Badges have dropped!
            </h3>
            <p className="text-sm dark:text-zinc-400 text-gray-500 text-center mt-1 mb-2">
              We just launched console badges and your past activity has already earned you {pendingBadges.length === 1 ? "one" : "some"}!
            </p>

            {pendingBadges.length === 1 ? (
              <div className="flex flex-col items-center px-2 py-2 w-[250px]">
                <Image
                  src={pendingBadges[0].imagePath}
                  alt={pendingBadges[0].name}
                  width={100}
                  height={100}
                />
                <h3 className="text-base font-bold text-center mt-2">
                  {pendingBadges[0].name}
                </h3>
                <p className="text-sm dark:text-zinc-400 text-gray-500 text-center mt-1">
                  {pendingBadges[0].description}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className={`grid ${pendingBadges.length > 2 ? "grid-cols-3" : "grid-cols-2"} gap-4`}>
                  {pendingBadges.map((badge, index) => (
                    <div key={index} className="flex flex-col items-center px-2 py-2 gap-2 w-[200px]">
                      <Image
                        src={badge.imagePath}
                        alt={badge.name}
                        width={80}
                        height={80}
                      />
                      <p className="text-base font-bold text-center mt-1">
                        {badge.name}
                      </p>
                      <p className="text-sm dark:text-zinc-400 text-gray-500 text-center">
                        {badge.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        }
      />
    </>
  );
}
