"use client";

import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import React, { useState, useEffect } from "react";
import { ProjectBadge } from "@/types/badge";
import axios from "axios";

type Props = {
  projectId: string;
};

export const TeamBadge = ({ projectId }: Props) => {
  const [badges, setBadges] = useState<ProjectBadge[]>([]);
  useEffect(() => {
    if (!projectId) return;
    const bad = axios.get(`/api/badge/project-badge?project_id=${projectId}`);
    bad.then((res) => {
      setBadges(res.data);
    });
  }, [projectId]);

  return (
    <div>
      <h2 className="text-2xl font-bold">Project Reward Board</h2>
      <Separator className="my-8 bg-zinc-300 dark:bg-zinc-800" />

      <div className="flex flex-wrap justify-center gap-8 mt-8">
        {badges.map((item: ProjectBadge, index: number) => (
          <div
            key={index}
            className="flex flex-col justify-center items-center gap-4"
          >
            <Image
              src={item.image_path}
              alt={item.name}
              width={150}
              height={150}
              className="w-40 h-40 rounded-full"
            />
            <h3 className="text-center text-lg font-bold">{item.name}</h3>
          </div>
        ))}
      </div>
    </div>
  );
};
