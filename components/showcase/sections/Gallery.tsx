import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import React from "react";
type Props = {
  projectGallery: string[];
};
export default function Gallery({ projectGallery }: Props) {
  return (
    <div>
      <h2 className="text-2xl">Gallery</h2>
      <Separator className="my-4 bg-zinc-300 dark:bg-zinc-800" />
      <div className="flex flex-wrap gap-4">
        {projectGallery.map((image, index) => (
          <Image
            key={index}
            src={image}
            alt={`Gallery Image ${index + 1}`}
            width={241}
            height={241}
            className="rounded-md"
          />
        ))}
      </div>
    </div>
  );
}
